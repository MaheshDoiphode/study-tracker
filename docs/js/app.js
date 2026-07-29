/**
 * Study Tracker — application shell and views.
 */

import { isConfigured } from './config.js';
import * as store from './store.js';
import {
  buildSchedule,
  diffPlans,
  formatEffort,
  formatDate,
  computeStreak,
  toISODate,
  fromISODate,
  addDays,
  daysBetween,
  startOfDay,
} from './scheduler.js';

const $ = (sel) => document.querySelector(sel);
const el = (html) => {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
};

/** Escape untrusted text before inserting into markup. */
const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])
  );

const state = {
  user: null,
  settings: null,
  plans: [],
  enrollments: [],
  logs: [],
  view: 'dashboard',
  activeEnrollmentId: null,
  openChapters: new Set(),
};

/* ------------------------------------------------------------ feedback */

let toastTimer;
function toast(message, isError = false) {
  const node = $('#toast');
  node.textContent = message;
  node.classList.toggle('err', isError);
  node.classList.remove('hidden');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => node.classList.add('hidden'), 3200);
}

function openModal(html, wire) {
  const backdrop = $('#modal-backdrop');
  $('#modal').innerHTML = html;
  backdrop.classList.remove('hidden');
  wire?.($('#modal'));
}
function closeModal() {
  $('#modal-backdrop').classList.add('hidden');
  $('#modal').innerHTML = '';
}
$('#modal-backdrop').addEventListener('click', (e) => {
  if (e.target.id === 'modal-backdrop') closeModal();
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeModal();
});

/* ---------------------------------------------------------------- auth */

async function boot() {
  if (!isConfigured()) {
    $('#setup-notice').classList.remove('hidden');
    return;
  }
  const user = await store.currentUser();
  if (user) await enterApp(user);
  else showLogin();

  store.onAuthChange(async (u) => {
    if (u && !state.user) await enterApp(u);
    else if (!u && state.user) location.reload();
  });
}

function showLogin() {
  $('#login-view').classList.remove('hidden');
  $('#app').classList.add('hidden');
}

/** Turn Supabase auth errors into something you can act on. */
function authErrorHint(ex) {
  const code = ex?.code ?? ex?.error_code ?? '';
  const msg = (ex?.message ?? '').toLowerCase();

  if (code === 'email_not_confirmed' || msg.includes('not confirmed')) {
    return 'This account exists but its email was never confirmed. In the Supabase dashboard go to Authentication → Users, open the ⋯ menu on this user and choose "Confirm user".';
  }
  if (code === 'invalid_credentials' || msg.includes('invalid login')) {
    return 'Email or password is incorrect. If you created this user from the dashboard without setting a password, use Authentication → Users → ⋯ → "Reset password".';
  }
  if (msg.includes('failed to fetch') || msg.includes('networkerror')) {
    return 'Could not reach Supabase. Check the project URL and publishable key in docs/js/config.js.';
  }
  return ex?.message ?? 'Sign-in failed';
}

$('#login-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const btn = $('#login-btn');
  const err = $('#login-error');
  const email = $('#email').value.trim();
  const password = $('#password').value;

  // Safe diagnostic: never logs the password, only its length. Browser autofill
  // silently replacing a typed password is a common cause of "invalid
  // credentials" — an unexpected length here is the giveaway.
  console.info(
    `[auth] signing in as "${email}" (email length ${email.length}, password length ${password.length})`
  );

  btn.disabled = true;
  btn.textContent = 'Signing in…';
  err.classList.add('hidden');
  try {
    await store.signIn(email, password);
  } catch (ex) {
    console.warn('[auth] failed:', ex?.code ?? ex?.error_code ?? '', ex?.message ?? ex);
    err.textContent = authErrorHint(ex);
    err.classList.remove('hidden');
    btn.disabled = false;
    btn.textContent = 'Sign in';
  }
});

$('#logout-btn').addEventListener('click', async () => {
  await store.signOut();
  location.reload();
});

async function enterApp(user) {
  state.user = user;
  $('#login-view').classList.add('hidden');
  $('#app').classList.remove('hidden');
  $('#user-email').textContent = user.email;

  try {
    const [settings, plans, enrollments, logs] = await Promise.all([
      store.getSettings(user.id),
      store.loadPlans(),
      store.getEnrollments(user.id),
      store.getDailyLogs(user.id),
    ]);
    state.settings = settings;
    state.plans = plans;
    state.enrollments = enrollments;
    state.logs = logs;
    renderStreak();
    render();
  } catch (ex) {
    $('#main').innerHTML = `<div class="empty"><h3>Could not load your data</h3><p>${esc(
      ex.message
    )}</p></div>`;
  }
}

document.querySelectorAll('.tab').forEach((tab) => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach((t) => t.classList.remove('active'));
    tab.classList.add('active');
    state.view = tab.dataset.view;
    state.activeEnrollmentId = null;
    render();
  });
});

/* ------------------------------------------------------------- helpers */

function planFor(enrollment) {
  return enrollment.plan_snapshot;
}

function scheduleFor(enrollment, progress) {
  return buildSchedule(planFor(enrollment), enrollment, progress ?? new Map(), state.settings);
}

/** Total declared share across active plans — used to warn about over-commit. */
function allocatedShare() {
  return state.enrollments
    .filter((e) => e.status === 'active')
    .reduce((n, e) => n + Number(e.capacity_share), 0);
}

function driftBadge(driftDays, status) {
  if (status === 'paused') return '<span class="badge paused">paused</span>';
  if (driftDays > 3) return `<span class="badge behind">${driftDays}d behind</span>`;
  if (driftDays < -3) return `<span class="badge ahead">${Math.abs(driftDays)}d ahead</span>`;
  return '<span class="badge ontrack">on track</span>';
}

function renderStreak() {
  const { current } = computeStreak(state.logs);
  $('#streak-badge').textContent = current > 0 ? `🔥 ${current}d` : '';
}

/* -------------------------------------------------------------- router */

const progressCache = new Map();

async function progressFor(enrollmentId) {
  if (!progressCache.has(enrollmentId)) {
    progressCache.set(enrollmentId, await store.getProgress(enrollmentId));
  }
  return progressCache.get(enrollmentId);
}

async function render() {
  const main = $('#main');
  main.innerHTML = '<div class="loading">Loading…</div>';

  if (state.activeEnrollmentId) return renderPlanDetail(main);
  if (state.view === 'dashboard') return renderDashboard(main);
  if (state.view === 'plans') return renderPlans(main);
  if (state.view === 'calendar') return renderCalendar(main);
  if (state.view === 'notes') return renderNotes(main);
  if (state.view === 'settings') return renderSettings(main);
}

/* ----------------------------------------------------------- dashboard */

async function renderDashboard(main) {
  const active = state.enrollments.filter((e) => e.status !== 'abandoned');

  if (!active.length) {
    main.innerHTML = `
      <div class="empty">
        <h3>No plans started yet</h3>
        <p>Head to <strong>Plans</strong> and start one.</p>
      </div>`;
    return;
  }

  const cards = [];
  let totalRemaining = 0;
  let totalDone = 0;
  let totalTasks = 0;

  for (const enrollment of active) {
    const progress = await progressFor(enrollment.id);
    const sched = scheduleFor(enrollment, progress);
    const plan = planFor(enrollment);
    totalRemaining += sched.totals.remainingMinutes;
    totalDone += sched.totals.completedTasks;
    totalTasks += sched.totals.tasks;

    cards.push(`
      <div class="card plan-card" data-enrollment="${enrollment.id}">
        <div class="card-head">
          <div>
            <h3 class="plan-title">${esc(plan.title)}</h3>
            <div class="plan-meta">
              <span>${sched.totals.completedTasks}/${sched.totals.tasks} tasks</span>
              <span>${formatEffort(sched.totals.remainingMinutes, plan.effort)} left</span>
              <span>${Math.round(Number(enrollment.capacity_share) * 100)}% capacity</span>
            </div>
          </div>
          ${driftBadge(sched.driftDays, enrollment.status)}
        </div>
        <div class="progress-track">
          <div class="progress-fill ${sched.totals.percentComplete === 100 ? 'green' : ''}"
               style="width:${sched.totals.percentComplete}%"></div>
        </div>
        <div class="plan-meta" style="margin-top:10px">
          <span>Planned: <strong>${formatDate(sched.plannedFinish)}</strong></span>
          <span>Projected: <strong>${formatDate(sched.projectedFinish)}</strong></span>
        </div>
      </div>`);
  }

  const { current, longest } = computeStreak(state.logs);
  const weeklyHours = Number(state.settings.weekly_capacity_hours);
  const share = allocatedShare();

  main.innerHTML = `
    <div class="page-head">
      <div>
        <h1>Dashboard</h1>
        <p class="muted">${active.length} plan${active.length === 1 ? '' : 's'} in flight</p>
      </div>
    </div>

    ${
      share > 1.001
        ? `<div class="banner">⚠️ Your active plans claim ${Math.round(
            share * 100
          )}% of your weekly hours. Projections assume more time than you have.
           <button class="btn small" data-goto="settings">Rebalance</button></div>`
        : ''
    }

    <div class="card">
      <div class="grid grid-4">
        <div class="stat"><div class="stat-value">${totalDone}/${totalTasks}</div><div class="stat-label">Tasks done</div></div>
        <div class="stat"><div class="stat-value">${(totalRemaining / 60).toFixed(0)}h</div><div class="stat-label">Effort remaining</div></div>
        <div class="stat"><div class="stat-value ${current > 0 ? 'green' : ''}">${current}</div><div class="stat-label">Day streak</div></div>
        <div class="stat"><div class="stat-value">${weeklyHours}h</div><div class="stat-label">Weekly capacity</div></div>
      </div>
    </div>

    ${cards.join('')}

    <div class="card">
      <div class="card-head"><h2>Activity</h2><span class="muted small">Longest streak: ${longest}d</span></div>
      ${heatmapHTML(state.logs)}
    </div>`;

  main.querySelectorAll('[data-enrollment]').forEach((node) =>
    node.addEventListener('click', () => {
      state.activeEnrollmentId = node.dataset.enrollment;
      render();
    })
  );
  main.querySelector('[data-goto]')?.addEventListener('click', () => {
    document.querySelector('.tab[data-view="settings"]').click();
  });
}

/* --------------------------------------------------------------- plans */

async function renderPlans(main) {
  const enrolledIds = new Set(state.enrollments.map((e) => e.plan_id));

  const available = state.plans
    .map((plan) => {
      const enrollment = state.enrollments.find((e) => e.plan_id === plan.id);
      const outdated = enrollment && enrollment.plan_version !== plan.version;
      return `
        <div class="card">
          <div class="card-head">
            <div>
              <h3 class="plan-title">${esc(plan.title)}</h3>
              <div class="plan-meta">
                <span>${plan.totals.tasks} tasks</span>
                <span>${(plan.totals.minutes / 60).toFixed(0)}h total</span>
                <span>${plan.totals.chapters} ${esc(plan.labels.chapter)}s</span>
                ${plan.tags.map((t) => `<span>#${esc(t)}</span>`).join('')}
              </div>
            </div>
            ${
              enrollment
                ? `<div style="display:flex;gap:8px;align-items:center">
                     <span class="badge ${enrollment.status}">${enrollment.status}</span>
                     <button class="btn small" data-open="${enrollment.id}">Open</button>
                   </div>`
                : `<button class="btn primary small" data-start="${esc(plan.id)}">Start plan</button>`
            }
          </div>
          <p class="muted small" style="margin:0">${esc(plan.description)}</p>
          ${
            outdated
              ? `<div class="banner" style="margin:14px 0 0">
                   📋 A newer version of this plan is available.
                   <button class="btn small" data-upgrade="${enrollment.id}">Review changes</button>
                 </div>`
              : ''
          }
        </div>`;
    })
    .join('');

  main.innerHTML = `
    <div class="page-head">
      <div><h1>Plans</h1><p class="muted">${state.plans.length} available · ${enrolledIds.size} started</p></div>
    </div>
    ${available || '<div class="empty"><h3>No plans found</h3><p>Add markdown files to <code>/plans</code>.</p></div>'}`;

  main.querySelectorAll('[data-start]').forEach((b) =>
    b.addEventListener('click', () => startPlanDialog(b.dataset.start))
  );
  main.querySelectorAll('[data-open]').forEach((b) =>
    b.addEventListener('click', () => {
      state.activeEnrollmentId = b.dataset.open;
      render();
    })
  );
  main.querySelectorAll('[data-upgrade]').forEach((b) =>
    b.addEventListener('click', () => upgradeDialog(b.dataset.upgrade))
  );
}

function startPlanDialog(planId) {
  const plan = state.plans.find((p) => p.id === planId);
  const remainingShare = Math.max(0.05, Math.round((1 - allocatedShare()) * 100) / 100);

  openModal(
    `<h2>Start “${esc(plan.title)}”</h2>
     <label class="field"><span>Start date</span>
       <input type="date" id="start-date" value="${toISODate(new Date())}" /></label>
     <label class="field"><span>Share of your weekly hours</span>
       <input type="number" id="share" min="5" max="100" step="5" value="${Math.round(
         remainingShare * 100
       )}" /></label>
     <p class="muted small">You have ${Math.round(
       (1 - allocatedShare()) * 100
     )}% of your weekly capacity unallocated. Running plans in parallel splits your hours, so each one finishes later.</p>
     <div class="modal-actions">
       <button class="btn" id="cancel">Cancel</button>
       <button class="btn primary" id="confirm">Start</button>
     </div>`,
    (modal) => {
      modal.querySelector('#cancel').addEventListener('click', closeModal);
      modal.querySelector('#confirm').addEventListener('click', async () => {
        const share = Math.min(100, Math.max(5, Number(modal.querySelector('#share').value))) / 100;
        try {
          const enrollment = await store.enroll(state.user.id, plan, {
            startedOn: modal.querySelector('#start-date').value,
            capacityShare: share,
          });
          state.enrollments.push(enrollment);
          closeModal();
          toast('Plan started');
          state.activeEnrollmentId = enrollment.id;
          render();
        } catch (ex) {
          toast(ex.message, true);
        }
      });
    }
  );
}

async function upgradeDialog(enrollmentId) {
  const enrollment = state.enrollments.find((e) => e.id === enrollmentId);
  const latest = state.plans.find((p) => p.id === enrollment.plan_id);
  const diff = diffPlans(enrollment.plan_snapshot, latest);

  const rows = [
    ...diff.added.map((t) => `<li><span class="diff-tag add">added</span>${esc(t.title)}</li>`),
    ...diff.removed.map(
      (t) => `<li><span class="diff-tag rem">removed</span>${esc(t.title)}</li>`
    ),
    ...diff.changed.map((c) => `<li><span class="diff-tag chg">changed</span>${esc(c.title)}</li>`),
    ...diff.moved.map(
      (m) => `<li><span class="diff-tag mov">moved</span>${esc(m.title)} → ${esc(m.to)}</li>`
    ),
    ...diff.chapterChanges.map(
      (c) =>
        `<li><span class="diff-tag chg">weeks</span>${esc(c.title)}: ${esc(c.from)} → ${esc(
          c.to
        )}</li>`
    ),
  ];

  const hours = (diff.effortDelta / 60).toFixed(1);
  openModal(
    `<h2>Plan updated</h2>
     ${rows.length ? `<ul class="diff-list">${rows.join('')}</ul>` : '<p class="muted">No structural changes.</p>'}
     <p class="muted small">
       Effort change: <strong>${diff.effortDelta >= 0 ? '+' : ''}${hours}h</strong>.
       Your completed work is preserved — only remaining effort affects the forecast.
       ${diff.removed.length ? `${diff.removed.length} removed task(s) keep their history but leave your active list.` : ''}
     </p>
     <div class="modal-actions">
       <button class="btn" id="stay">Stay on current version</button>
       <button class="btn primary" id="apply">Apply update</button>
     </div>`,
    (modal) => {
      modal.querySelector('#stay').addEventListener('click', closeModal);
      modal.querySelector('#apply').addEventListener('click', async () => {
        try {
          const updated = await store.upgradeEnrollment(
            enrollment,
            latest,
            diff.removed.map((t) => t.id)
          );
          Object.assign(enrollment, updated);
          progressCache.delete(enrollment.id);
          closeModal();
          toast('Plan updated');
          render();
        } catch (ex) {
          toast(ex.message, true);
        }
      });
    }
  );
}

/* --------------------------------------------------------- plan detail */

async function renderPlanDetail(main) {
  const enrollment = state.enrollments.find((e) => e.id === state.activeEnrollmentId);
  if (!enrollment) {
    state.activeEnrollmentId = null;
    return render();
  }

  const plan = planFor(enrollment);
  const progress = await progressFor(enrollment.id);
  const sched = scheduleFor(enrollment, progress);
  const latest = state.plans.find((p) => p.id === enrollment.plan_id);
  const outdated = latest && latest.version !== enrollment.plan_version;

  const chapters = plan.chapters
    .map((chapter) => {
      const chapterTasks = sched.tasks.filter((t) => t.chapterId === chapter.id);
      const done = chapterTasks.filter((t) => t.status === 'done' || t.status === 'skipped').length;
      const pct = chapterTasks.length ? Math.round((done / chapterTasks.length) * 100) : 0;
      const isOpen = state.openChapters.has(chapter.id);

      const sections = chapter.sections
        .map((section) => {
          const tasks = sched.tasks.filter((t) => t.sectionId === section.id);
          return `
            <div class="section">
              <div class="section-head">
                <h4>${esc(section.title)}</h4>
                <span class="muted small">${tasks.filter((t) => t.status === 'done').length}/${
            tasks.length
          }</span>
                <button class="icon-btn" data-note-anchor="${esc(section.id)}"
                        data-note-kind="section" title="Add note">✎</button>
              </div>
              ${tasks.map(taskHTML).join('')}
            </div>`;
        })
        .join('');

      return `
        <div class="chapter">
          <div class="chapter-head" data-chapter="${esc(chapter.id)}">
            <span class="chevron ${isOpen ? 'open' : ''}">▶</span>
            <h3>${esc(chapter.title)}</h3>
            <span class="muted small">${done}/${chapterTasks.length}</span>
            <div style="width:80px"><div class="progress-track"><div class="progress-fill ${
              pct === 100 ? 'green' : ''
            }" style="width:${pct}%"></div></div></div>
          </div>
          <div class="chapter-body ${isOpen ? '' : 'hidden'}">${sections}</div>
        </div>`;
    })
    .join('');

  main.innerHTML = `
    <div class="page-head">
      <div>
        <button class="btn ghost small" id="back">← Back</button>
        <h1 style="margin-top:10px">${esc(plan.title)}</h1>
        <p class="muted">Started ${formatDate(sched.startDate)} · ${Math.round(
    Number(enrollment.capacity_share) * 100
  )}% of your weekly hours</p>
      </div>
      <div style="display:flex;gap:8px;align-items:center">
        ${driftBadge(sched.driftDays, enrollment.status)}
        <button class="btn small" id="toggle-pause">${
          enrollment.status === 'paused' ? 'Resume' : 'Pause'
        }</button>
      </div>
    </div>

    ${
      outdated
        ? `<div class="banner">📋 A newer version of this plan is available.
             <button class="btn small" id="upgrade">Review changes</button></div>`
        : ''
    }

    <div class="card">
      <div class="grid grid-4">
        <div class="stat"><div class="stat-value">${sched.totals.percentComplete}%</div><div class="stat-label">Complete</div></div>
        <div class="stat"><div class="stat-value">${formatEffort(
          sched.totals.remainingMinutes,
          plan.effort
        )}</div><div class="stat-label">Remaining</div></div>
        <div class="stat"><div class="stat-value">${formatDate(
          sched.plannedFinish
        )}</div><div class="stat-label">Planned finish</div></div>
        <div class="stat"><div class="stat-value ${
          sched.driftDays > 3 ? 'red' : sched.driftDays < -3 ? 'green' : ''
        }">${formatDate(sched.projectedFinish)}</div><div class="stat-label">Projected finish</div></div>
      </div>
      ${timelineHTML(sched)}
      <p class="muted small" style="margin:12px 0 0">
        ${velocityNote(sched, enrollment)}
      </p>
    </div>

    ${chapters}`;

  main.querySelector('#back').addEventListener('click', () => {
    state.activeEnrollmentId = null;
    render();
  });
  main.querySelector('#upgrade')?.addEventListener('click', () => upgradeDialog(enrollment.id));
  main.querySelector('#toggle-pause').addEventListener('click', async () => {
    const paused = enrollment.status === 'paused';
    const patch = paused
      ? {
          status: 'active',
          paused_at: null,
          total_paused_days:
            Number(enrollment.total_paused_days) +
            (enrollment.paused_at ? daysBetween(new Date(enrollment.paused_at), new Date()) : 0),
        }
      : { status: 'paused', paused_at: new Date().toISOString() };
    try {
      const updated = await store.updateEnrollment(enrollment.id, patch);
      Object.assign(enrollment, updated);
      toast(paused ? 'Plan resumed' : 'Plan paused — no slippage while paused');
      render();
    } catch (ex) {
      toast(ex.message, true);
    }
  });

  main.querySelectorAll('[data-chapter]').forEach((head) =>
    head.addEventListener('click', () => {
      const id = head.dataset.chapter;
      if (state.openChapters.has(id)) state.openChapters.delete(id);
      else state.openChapters.add(id);
      render();
    })
  );

  main.querySelectorAll('[data-task]').forEach((box) =>
    box.addEventListener('change', async () => {
      const taskId = box.dataset.task;
      const task = sched.tasks.find((t) => t.id === taskId);
      const status = box.checked ? 'done' : 'todo';
      try {
        const row = await store.setTaskStatus(enrollment.id, taskId, status, {
          minutes_spent: box.checked ? task.effortMinutes : 0,
        });
        progress.set(taskId, row);
        await store.logActivity(state.user.id, enrollment.id, {
          minutes: box.checked ? task.effortMinutes : -task.effortMinutes,
          tasksDone: box.checked ? 1 : -1,
        });
        state.logs = await store.getDailyLogs(state.user.id);
        renderStreak();
        render();
      } catch (ex) {
        toast(ex.message, true);
        box.checked = !box.checked;
      }
    })
  );

  main.querySelectorAll('[data-flag]').forEach((btn) =>
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const taskId = btn.dataset.flag;
      const existing = progress.get(taskId);
      try {
        const row = await store.setTaskStatus(enrollment.id, taskId, existing?.status ?? 'todo', {
          flagged: !(existing?.flagged ?? false),
          minutes_spent: existing?.minutes_spent ?? 0,
        });
        progress.set(taskId, row);
        render();
      } catch (ex) {
        toast(ex.message, true);
      }
    })
  );

  main.querySelectorAll('[data-note-anchor]').forEach((btn) =>
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      noteDialog(plan.id, btn.dataset.noteAnchor, btn.dataset.noteKind);
    })
  );
}

function taskHTML(task) {
  const done = task.status === 'done' || task.status === 'skipped';
  return `
    <div class="task ${done ? 'done' : ''}">
      <input type="checkbox" data-task="${esc(task.id)}" ${done ? 'checked' : ''} />
      <div class="task-body">
        <div class="task-title">${esc(task.title)}</div>
        <div class="task-meta">
          <span>${formatEffort(task.effortMinutes)}</span>
          ${task.difficulty ? `<span>${esc(task.difficulty)}</span>` : ''}
          <span>due ${formatDate(task.plannedDate)}</span>
          ${task.overdue ? '<span class="overdue-dot">● overdue</span>' : ''}
        </div>
      </div>
      <div class="task-actions">
        <button class="icon-btn ${task.flagged ? 'on' : ''}" data-flag="${esc(
    task.id
  )}" title="Flag for revision">⚑</button>
        <button class="icon-btn" data-note-anchor="${esc(
          task.id
        )}" data-note-kind="task" title="Add note">✎</button>
      </div>
    </div>`;
}

function velocityNote(sched, enrollment) {
  if (enrollment.status === 'paused') {
    return 'Paused — this plan is not consuming capacity and is not accruing slippage.';
  }
  const { measuredWeekly, declaredWeekly, confidence } = sched.velocity;
  if (measuredWeekly == null) {
    return `Forecast uses your declared capacity (${(declaredWeekly / 60).toFixed(
      1
    )}h/week). It will switch to your measured pace once you have a couple of weeks of history.`;
  }
  return `Measured pace: ${(measuredWeekly / 60).toFixed(1)}h/week vs ${(
    declaredWeekly / 60
  ).toFixed(1)}h/week planned (${Math.round(confidence * 100)}% weight on measured).`;
}

function timelineHTML(sched) {
  const start = sched.startDate;
  const end = sched.projectedFinish ?? sched.plannedFinish;
  const span = Math.max(1, daysBetween(start, end));
  const todayPct = Math.min(100, Math.max(0, (daysBetween(start, new Date()) / span) * 100));
  const plannedPct = Math.min(100, (daysBetween(start, sched.plannedFinish) / span) * 100);

  return `
    <div class="timeline">
      <div class="timeline-bar">
        <div class="timeline-seg done" style="width:${sched.totals.percentComplete}%"></div>
        <div class="timeline-marker" style="left:${todayPct}%" title="Today"></div>
        <div class="timeline-marker" style="left:${plannedPct}%;background:var(--accent)" title="Planned finish"></div>
      </div>
      <div class="timeline-labels">
        <span>${formatDate(start)}</span>
        <span>${formatDate(end)}</span>
      </div>
    </div>`;
}

/* ------------------------------------------------------------ calendar */

function heatmapHTML(logs) {
  const byDate = new Map();
  for (const log of logs) {
    byDate.set(log.log_date, (byDate.get(log.log_date) ?? 0) + log.minutes);
  }
  const today = startOfDay(new Date());
  const start = addDays(today, -181);
  const weeks = [];
  let cursor = addDays(start, -start.getDay());

  while (cursor <= today) {
    const days = [];
    for (let d = 0; d < 7; d++) {
      const day = addDays(cursor, d);
      const iso = toISODate(day);
      const mins = byDate.get(iso) ?? 0;
      const level = mins === 0 ? 0 : mins < 45 ? 1 : mins < 100 ? 2 : mins < 180 ? 3 : 4;
      days.push(
        `<div class="heat-day ${level ? `l${level}` : ''}" title="${iso}: ${Math.round(
          mins
        )} min"></div>`
      );
    }
    weeks.push(`<div class="heat-week">${days.join('')}</div>`);
    cursor = addDays(cursor, 7);
  }
  return `<div class="heatmap">${weeks.join('')}</div>`;
}

async function renderCalendar(main) {
  const active = state.enrollments.filter((e) => e.status === 'active');
  const upcoming = [];

  for (const enrollment of active) {
    const progress = await progressFor(enrollment.id);
    const sched = scheduleFor(enrollment, progress);
    for (const task of sched.tasks) {
      if (task.status === 'done' || task.status === 'skipped') continue;
      upcoming.push({ ...task, planTitle: planFor(enrollment).title, enrollmentId: enrollment.id });
    }
  }

  upcoming.sort((a, b) => a.plannedDate - b.plannedDate);
  const overdue = upcoming.filter((t) => t.overdue);
  const next = upcoming.filter((t) => !t.overdue).slice(0, 25);

  const row = (t) => `
    <div class="task">
      <div class="task-body">
        <div class="task-title">${esc(t.title)}</div>
        <div class="task-meta">
          <span>${esc(t.planTitle)}</span>
          <span>${esc(t.sectionTitle)}</span>
          <span>${formatDate(t.plannedDate)}</span>
        </div>
      </div>
    </div>`;

  main.innerHTML = `
    <div class="page-head"><div><h1>Calendar</h1><p class="muted">Derived from your capacity, not fixed dates</p></div></div>

    <div class="card">
      <div class="card-head"><h2>Activity</h2></div>
      ${heatmapHTML(state.logs)}
    </div>

    ${
      overdue.length
        ? `<div class="card">
             <div class="card-head"><h2>Overdue</h2><span class="badge behind">${overdue.length}</span></div>
             ${overdue.slice(0, 20).map(row).join('')}
           </div>`
        : ''
    }

    <div class="card">
      <div class="card-head"><h2>Coming up</h2></div>
      ${next.length ? next.map(row).join('') : '<p class="muted">Nothing scheduled.</p>'}
    </div>`;
}

/* --------------------------------------------------------------- notes */

async function renderNotes(main) {
  const planIds = [...new Set(state.enrollments.map((e) => e.plan_id))];
  const groups = [];

  for (const planId of planIds) {
    const notes = await store.getNotes(state.user.id, planId);
    if (!notes.length) continue;
    const plan = state.plans.find((p) => p.id === planId);
    groups.push(`
      <div class="card">
        <div class="card-head"><h2>${esc(plan?.title ?? planId)}</h2></div>
        ${notes
          .map(
            (n) => `
          <div class="note">
            <div class="note-head">
              <span class="note-title">${esc(n.title || n.anchor_id)}</span>
              <div>
                <button class="icon-btn" data-edit="${n.id}">✎</button>
                <button class="icon-btn" data-del="${n.id}">🗑</button>
              </div>
            </div>
            <div class="note-body">${esc(n.body_md)}</div>
          </div>`
          )
          .join('')}
      </div>`);
  }

  main.innerHTML = `
    <div class="page-head"><div><h1>Notes</h1><p class="muted">Private to you — stored in Supabase, never in git</p></div></div>
    ${groups.join('') || '<div class="empty"><h3>No notes yet</h3><p>Add notes from any task or week using the ✎ button.</p></div>'}`;

  main.querySelectorAll('[data-del]').forEach((b) =>
    b.addEventListener('click', async () => {
      try {
        await store.deleteNote(b.dataset.del);
        toast('Note deleted');
        render();
      } catch (ex) {
        toast(ex.message, true);
      }
    })
  );
}

async function noteDialog(planId, anchorId, anchorKind) {
  const existing = (await store.getNotes(state.user.id, planId, anchorId))[0];
  openModal(
    `<h2>${existing ? 'Edit note' : 'New note'}</h2>
     <label class="field"><span>Title</span>
       <input type="text" id="n-title" value="${esc(existing?.title ?? '')}" placeholder="Optional" /></label>
     <label class="field"><span>Note (markdown)</span>
       <textarea id="n-body" placeholder="What tripped you up? What's the pattern?">${esc(
         existing?.body_md ?? ''
       )}</textarea></label>
     <div class="modal-actions">
       <button class="btn" id="cancel">Cancel</button>
       <button class="btn primary" id="save">Save</button>
     </div>`,
    (modal) => {
      modal.querySelector('#cancel').addEventListener('click', closeModal);
      modal.querySelector('#save').addEventListener('click', async () => {
        try {
          await store.saveNote({
            id: existing?.id,
            userId: state.user.id,
            planId,
            anchorId,
            anchorKind,
            title: modal.querySelector('#n-title').value.trim(),
            body: modal.querySelector('#n-body').value,
          });
          closeModal();
          toast('Note saved');
        } catch (ex) {
          toast(ex.message, true);
        }
      });
    }
  );
}

/* ------------------------------------------------------------ settings */

function renderSettings(main) {
  const share = allocatedShare();
  const rows = state.enrollments
    .filter((e) => e.status !== 'abandoned')
    .map(
      (e) => `
      <div class="task">
        <div class="task-body">
          <div class="task-title">${esc(planFor(e).title)}</div>
          <div class="task-meta"><span class="badge ${e.status}">${e.status}</span>
            <span>started ${formatDate(fromISODate(e.started_on))}</span></div>
        </div>
        <div style="display:flex;gap:8px;align-items:center">
          <input type="number" min="5" max="100" step="5" style="width:80px"
                 value="${Math.round(Number(e.capacity_share) * 100)}" data-share="${e.id}" />
          <span class="muted small">%</span>
          <button class="btn small danger" data-remove="${e.id}">Remove</button>
        </div>
      </div>`
    )
    .join('');

  main.innerHTML = `
    <div class="page-head"><div><h1>Settings</h1></div></div>

    <div class="card">
      <div class="card-head"><h2>Weekly capacity</h2></div>
      <label class="field"><span>Hours available per week, across all plans</span>
        <input type="number" id="capacity" min="1" max="80" step="1"
               value="${Number(state.settings.weekly_capacity_hours)}" /></label>
      <button class="btn primary small" id="save-capacity">Save</button>
    </div>

    <div class="card">
      <div class="card-head">
        <h2>Capacity allocation</h2>
        <span class="badge ${share > 1.001 ? 'behind' : 'ontrack'}">${Math.round(share * 100)}% allocated</span>
      </div>
      <p class="muted small" style="margin-top:0">
        Plans running in parallel divide the same weekly hours. Give a plan a bigger share and it
        finishes sooner — at the cost of everything else.
      </p>
      ${rows || '<p class="muted">No plans yet.</p>'}
    </div>

    <div class="card">
      <div class="card-head"><h2>Account</h2></div>
      <p class="muted small">Signed in as ${esc(state.user.email)}</p>
    </div>`;

  main.querySelector('#save-capacity').addEventListener('click', async () => {
    try {
      state.settings = await store.updateSettings(state.user.id, {
        weekly_capacity_hours: Number(main.querySelector('#capacity').value),
      });
      toast('Capacity updated');
      render();
    } catch (ex) {
      toast(ex.message, true);
    }
  });

  main.querySelectorAll('[data-share]').forEach((input) =>
    input.addEventListener('change', async () => {
      const enrollment = state.enrollments.find((e) => e.id === input.dataset.share);
      try {
        const updated = await store.updateEnrollment(enrollment.id, {
          capacity_share: Math.min(100, Math.max(5, Number(input.value))) / 100,
        });
        Object.assign(enrollment, updated);
        toast('Allocation updated');
        render();
      } catch (ex) {
        toast(ex.message, true);
      }
    })
  );

  main.querySelectorAll('[data-remove]').forEach((btn) =>
    btn.addEventListener('click', () => {
      openModal(
        `<h2>Remove this plan?</h2>
         <p class="muted">All progress and completion history for it will be permanently deleted. Your notes are kept.</p>
         <div class="modal-actions">
           <button class="btn" id="cancel">Cancel</button>
           <button class="btn danger" id="confirm">Remove</button>
         </div>`,
        (modal) => {
          modal.querySelector('#cancel').addEventListener('click', closeModal);
          modal.querySelector('#confirm').addEventListener('click', async () => {
            try {
              await store.deleteEnrollment(btn.dataset.remove);
              state.enrollments = state.enrollments.filter((e) => e.id !== btn.dataset.remove);
              progressCache.delete(btn.dataset.remove);
              closeModal();
              toast('Plan removed');
              render();
            } catch (ex) {
              toast(ex.message, true);
            }
          });
        }
      );
    })
  );
}

boot();

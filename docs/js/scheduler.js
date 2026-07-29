/**
 * Scheduling engine.
 *
 * Core principle: DATES ARE NEVER STORED, ONLY DERIVED.
 *
 * We persist three facts — when a plan started, how much effort each task
 * costs, and when tasks were actually completed. Everything on the calendar is
 * computed from those. That is what makes editing a plan's markdown safe: a
 * phase growing from 3 weeks to 4 simply changes remaining effort, and the
 * projection re-derives. Nothing has to be migrated, and work you already
 * finished is unaffected because only REMAINING effort feeds the forecast.
 */

const MS_PER_DAY = 86_400_000;

export const addDays = (date, days) => new Date(date.getTime() + days * MS_PER_DAY);
export const startOfDay = (d) => {
  const c = new Date(d);
  c.setHours(0, 0, 0, 0);
  return c;
};
export const daysBetween = (a, b) =>
  Math.round((startOfDay(b) - startOfDay(a)) / MS_PER_DAY);

export function toISODate(date) {
  const d = startOfDay(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate()
  ).padStart(2, '0')}`;
}

export function fromISODate(iso) {
  const [y, m, d] = String(iso).split('-').map(Number);
  return new Date(y, m - 1, d);
}

/** Flatten a plan snapshot into an ordered task list with cumulative effort. */
export function flattenTasks(plan) {
  const out = [];
  for (const chapter of plan.chapters ?? []) {
    for (const section of chapter.sections ?? []) {
      for (const task of section.tasks ?? []) {
        out.push({
          ...task,
          chapterId: chapter.id,
          chapterTitle: chapter.title,
          sectionId: section.id,
          sectionTitle: section.title,
        });
      }
    }
  }
  return out;
}

/**
 * Weekly minutes actually available to one enrollment.
 * Parallel plans share a single pool, so each gets its declared slice.
 */
export function weeklyMinutesFor(enrollment, settings) {
  const totalWeekly = (Number(settings?.weekly_capacity_hours) || 15) * 60;
  const share = Number(enrollment?.capacity_share) || 1;
  return Math.max(30, totalWeekly * share);
}

/**
 * Measured throughput in minutes/week over a trailing window.
 * Days while the plan was paused are excluded so a deliberate break does not
 * read as failure.
 */
export function measuredVelocity(completedTasks, { windowDays = 28, activeDays = null } = {}) {
  if (!completedTasks.length) return null;

  const now = startOfDay(new Date());
  const windowStart = addDays(now, -windowDays);
  const recent = completedTasks.filter(
    (t) => t.completedAt && startOfDay(t.completedAt) >= windowStart
  );
  if (recent.length === 0) return null;

  const minutes = recent.reduce((sum, t) => sum + (t.minutesSpent || t.effortMinutes || 0), 0);
  const spanDays = Math.max(1, activeDays ?? windowDays);
  return (minutes / spanDays) * 7;
}

/**
 * Blend declared capacity with observed throughput.
 * Early on we trust the plan; as evidence accumulates, reality takes over.
 */
export function blendedVelocity(declaredWeekly, measuredWeekly, weeksOfData) {
  if (measuredWeekly == null || measuredWeekly <= 0) return declaredWeekly;
  const confidence = Math.min(1, Math.max(0, weeksOfData / 4));
  return declaredWeekly * (1 - confidence) + measuredWeekly * confidence;
}

/**
 * Build the full schedule for one enrollment.
 *
 * @param {object} plan        resolved plan snapshot
 * @param {object} enrollment  { started_on, status, capacity_share, total_paused_days }
 * @param {Map}    progressById  task_id -> { status, completed_at, minutes_spent }
 * @param {object} settings    user_settings row
 */
export function buildSchedule(plan, enrollment, progressById, settings) {
  const tasks = flattenTasks(plan);
  const weeklyMinutes = weeklyMinutesFor(enrollment, settings);
  const dailyMinutes = weeklyMinutes / 7;

  const startDate = fromISODate(enrollment.started_on);
  const today = startOfDay(new Date());
  const pausedDays = Number(enrollment.total_paused_days) || 0;

  let cumulativeMinutes = 0;
  let remainingMinutes = 0;
  let completedMinutes = 0;
  let completedCount = 0;
  const completedTasks = [];

  const scheduled = tasks.map((task) => {
    const progress = progressById.get(task.id);
    const status = progress?.status ?? 'todo';
    const isDone = status === 'done' || status === 'skipped';

    // Planned date: walk the plan in order, spending capacity as we go.
    cumulativeMinutes += task.effortMinutes;
    const plannedOffsetDays = cumulativeMinutes / dailyMinutes;
    const plannedDate = addDays(startDate, Math.ceil(plannedOffsetDays) + pausedDays);

    if (isDone) {
      const spent = progress?.minutes_spent || task.effortMinutes;
      completedMinutes += spent;
      completedCount += 1;
      if (progress?.completed_at) {
        completedTasks.push({
          ...task,
          completedAt: new Date(progress.completed_at),
          minutesSpent: spent,
        });
      }
    } else {
      remainingMinutes += task.effortMinutes;
    }

    return {
      ...task,
      status,
      flagged: progress?.flagged ?? false,
      minutesSpent: progress?.minutes_spent ?? 0,
      completedAt: progress?.completed_at ? new Date(progress.completed_at) : null,
      plannedDate,
      overdue: !isDone && plannedDate < today,
    };
  });

  const totalMinutes = cumulativeMinutes;

  // Planned finish: the original promise, from the declared capacity.
  const plannedFinish = addDays(
    startDate,
    Math.ceil(totalMinutes / dailyMinutes) + pausedDays
  );

  // Projected finish: where you are actually heading.
  const elapsedDays = Math.max(0, daysBetween(startDate, today) - pausedDays);
  const weeksOfData = elapsedDays / 7;
  const measured = measuredVelocity(completedTasks, { activeDays: Math.min(28, elapsedDays) });
  const velocity =
    enrollment.status === 'paused'
      ? 0
      : blendedVelocity(weeklyMinutes, measured, weeksOfData);

  let projectedFinish = null;
  let weeksRemaining = null;
  if (remainingMinutes === 0) {
    projectedFinish = completedTasks.length
      ? new Date(Math.max(...completedTasks.map((t) => t.completedAt.getTime())))
      : today;
    weeksRemaining = 0;
  } else if (velocity > 0) {
    weeksRemaining = remainingMinutes / velocity;
    projectedFinish = addDays(today, Math.ceil(weeksRemaining * 7));
  }

  const driftDays =
    projectedFinish && enrollment.status !== 'paused'
      ? daysBetween(plannedFinish, projectedFinish)
      : 0;

  return {
    tasks: scheduled,
    startDate,
    plannedFinish,
    projectedFinish,
    driftDays,
    weeksRemaining,
    velocity: {
      declaredWeekly: weeklyMinutes,
      measuredWeekly: measured,
      effectiveWeekly: velocity,
      confidence: Math.min(1, weeksOfData / 4),
    },
    totals: {
      tasks: tasks.length,
      completedTasks: completedCount,
      totalMinutes,
      completedMinutes,
      remainingMinutes,
      percentComplete: totalMinutes ? Math.round(((totalMinutes - remainingMinutes) / totalMinutes) * 100) : 0,
    },
  };
}

/**
 * Diff a pinned snapshot against a newer plan version.
 * Drives the "Plan updated — review changes" flow. Nothing here is
 * destructive: removed tasks keep their history, they just stop being active.
 */
export function diffPlans(oldPlan, newPlan) {
  const oldTasks = new Map(flattenTasks(oldPlan).map((t) => [t.id, t]));
  const newTasks = new Map(flattenTasks(newPlan).map((t) => [t.id, t]));

  const added = [];
  const removed = [];
  const changed = [];
  const moved = [];

  for (const [id, task] of newTasks) {
    const prev = oldTasks.get(id);
    if (!prev) {
      added.push(task);
      continue;
    }
    if (prev.title !== task.title || prev.effortMinutes !== task.effortMinutes) {
      changed.push({
        id,
        title: task.title,
        titleChanged: prev.title !== task.title,
        effortChanged: prev.effortMinutes !== task.effortMinutes,
        from: { title: prev.title, effortMinutes: prev.effortMinutes },
        to: { title: task.title, effortMinutes: task.effortMinutes },
      });
    }
    if (prev.sectionId !== task.sectionId || prev.chapterId !== task.chapterId) {
      moved.push({ id, title: task.title, from: prev.sectionTitle, to: task.sectionTitle });
    }
  }

  for (const [id, task] of oldTasks) {
    if (!newTasks.has(id)) removed.push(task);
  }

  const effortDelta =
    [...newTasks.values()].reduce((n, t) => n + t.effortMinutes, 0) -
    [...oldTasks.values()].reduce((n, t) => n + t.effortMinutes, 0);

  const chapterChanges = [];
  const oldChapters = new Map((oldPlan.chapters ?? []).map((c) => [c.id, c]));
  for (const chapter of newPlan.chapters ?? []) {
    const prev = oldChapters.get(chapter.id);
    if (prev && String(prev.meta?.weeks) !== String(chapter.meta?.weeks)) {
      chapterChanges.push({
        id: chapter.id,
        title: chapter.title,
        from: prev.meta?.weeks,
        to: chapter.meta?.weeks,
      });
    }
  }

  return {
    added,
    removed,
    changed,
    moved,
    chapterChanges,
    effortDelta,
    hasChanges:
      added.length + removed.length + changed.length + moved.length + chapterChanges.length > 0,
  };
}

/** Human-readable effort, shown in the plan's own display unit where sensible. */
export function formatEffort(minutes, effortConfig = null) {
  if (!minutes) return '0m';
  if (effortConfig?.minutesPerUnit && effortConfig.unit !== 'task') {
    const units = minutes / effortConfig.minutesPerUnit;
    if (units >= 1) {
      const rounded = Math.round(units * 10) / 10;
      const label = rounded === 1 ? effortConfig.unit : effortConfig.unitPlural ?? `${effortConfig.unit}s`;
      return `${rounded} ${label}`;
    }
  }
  const hours = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);
  if (hours && mins) return `${hours}h ${mins}m`;
  if (hours) return `${hours}h`;
  return `${mins}m`;
}

export function formatDate(date) {
  if (!date) return '—';
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

/** Current and longest streak of days with logged activity. */
export function computeStreak(dailyLogs) {
  const active = new Set(
    dailyLogs.filter((l) => (l.minutes > 0 || l.tasks_done > 0)).map((l) => l.log_date)
  );
  if (!active.size) return { current: 0, longest: 0 };

  const today = startOfDay(new Date());
  let current = 0;
  for (let i = 0; i < 3650; i++) {
    const day = toISODate(addDays(today, -i));
    if (active.has(day)) current++;
    else if (i > 0) break;
  }

  const sorted = [...active].sort();
  let longest = 0;
  let run = 0;
  let prev = null;
  for (const iso of sorted) {
    const d = fromISODate(iso);
    run = prev && daysBetween(prev, d) === 1 ? run + 1 : 1;
    longest = Math.max(longest, run);
    prev = d;
  }

  return { current, longest };
}

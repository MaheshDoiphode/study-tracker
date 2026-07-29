/**
 * Data layer — all Supabase access lives here so the UI never touches the
 * client directly.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, PLANS_URL } from './config.js';

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: { persistSession: true, autoRefreshToken: true },
});

/* ------------------------------------------------------------------ auth */

export async function signIn(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data.user;
}

export async function signOut() {
  await supabase.auth.signOut();
}

export async function currentUser() {
  const { data } = await supabase.auth.getSession();
  return data.session?.user ?? null;
}

export function onAuthChange(callback) {
  return supabase.auth.onAuthStateChange((_event, session) => callback(session?.user ?? null));
}

/* ----------------------------------------------------------------- plans */

let planCache = null;

/** Load the compiled plan manifest (cache-busted so edits show up on deploy). */
export async function loadPlans() {
  if (planCache) return planCache;
  const res = await fetch(`${PLANS_URL}?v=${Date.now()}`);
  if (!res.ok) throw new Error(`Could not load plans.json (${res.status})`);
  const manifest = await res.json();
  planCache = manifest.plans ?? [];
  return planCache;
}

export async function getPlan(planId) {
  const plans = await loadPlans();
  return plans.find((p) => p.id === planId) ?? null;
}

/* ------------------------------------------------------------- settings */

export async function getSettings(userId) {
  const { data, error } = await supabase
    .from('user_settings')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;

  if (!data) {
    const { data: created, error: insertError } = await supabase
      .from('user_settings')
      .insert({ user_id: userId })
      .select()
      .single();
    if (insertError) throw insertError;
    return created;
  }
  return data;
}

export async function updateSettings(userId, patch) {
  const { data, error } = await supabase
    .from('user_settings')
    .update(patch)
    .eq('user_id', userId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

/* ---------------------------------------------------------- enrollments */

export async function getEnrollments(userId) {
  const { data, error } = await supabase
    .from('enrollments')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

/**
 * Start a plan. The resolved plan is snapshotted onto the enrollment so later
 * edits to the markdown cannot disturb work already in progress.
 */
export async function enroll(userId, plan, { startedOn, capacityShare = 1.0 } = {}) {
  const { data, error } = await supabase
    .from('enrollments')
    .insert({
      user_id: userId,
      plan_id: plan.id,
      plan_version: plan.version,
      plan_snapshot: plan,
      started_on: startedOn ?? new Date().toISOString().slice(0, 10),
      capacity_share: capacityShare,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateEnrollment(enrollmentId, patch) {
  const { data, error } = await supabase
    .from('enrollments')
    .update(patch)
    .eq('id', enrollmentId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteEnrollment(enrollmentId) {
  const { error } = await supabase.from('enrollments').delete().eq('id', enrollmentId);
  if (error) throw error;
}

/**
 * Accept a newer plan version. Progress survives because task ids are stable;
 * tasks that vanished are marked orphaned rather than deleted, so history and
 * streaks stay truthful.
 */
export async function upgradeEnrollment(enrollment, newPlan, removedTaskIds) {
  if (removedTaskIds.length) {
    const { error } = await supabase
      .from('task_progress')
      .update({ orphaned: true })
      .eq('enrollment_id', enrollment.id)
      .in('task_id', removedTaskIds);
    if (error) throw error;
  }
  return updateEnrollment(enrollment.id, {
    plan_version: newPlan.version,
    plan_snapshot: newPlan,
  });
}

/* -------------------------------------------------------------- progress */

export async function getProgress(enrollmentId) {
  const { data, error } = await supabase
    .from('task_progress')
    .select('*')
    .eq('enrollment_id', enrollmentId);
  if (error) throw error;

  const map = new Map();
  for (const row of data ?? []) map.set(row.task_id, row);
  return map;
}

export async function setTaskStatus(enrollmentId, taskId, status, extra = {}) {
  const { data, error } = await supabase
    .from('task_progress')
    .upsert(
      { enrollment_id: enrollmentId, task_id: taskId, status, ...extra },
      { onConflict: 'enrollment_id,task_id' }
    )
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function toggleFlag(enrollmentId, taskId, flagged) {
  return setTaskStatus(enrollmentId, taskId, 'todo', { flagged });
}

/* ----------------------------------------------------------------- notes */

export async function getNotes(userId, planId, anchorId = null) {
  let query = supabase.from('notes').select('*').eq('user_id', userId).eq('plan_id', planId);
  if (anchorId) query = query.eq('anchor_id', anchorId);
  const { data, error } = await query.order('updated_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function saveNote({ id, userId, planId, anchorId, anchorKind, title, body }) {
  if (id) {
    const { data, error } = await supabase
      .from('notes')
      .update({ title, body_md: body })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  }
  const { data, error } = await supabase
    .from('notes')
    .insert({
      user_id: userId,
      plan_id: planId,
      anchor_id: anchorId,
      anchor_kind: anchorKind,
      title,
      body_md: body,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteNote(noteId) {
  const { error } = await supabase.from('notes').delete().eq('id', noteId);
  if (error) throw error;
}

/* ------------------------------------------------------------- activity */

export async function getDailyLogs(userId, sinceDays = 180) {
  const since = new Date(Date.now() - sinceDays * 86_400_000).toISOString().slice(0, 10);
  const { data, error } = await supabase
    .from('daily_log')
    .select('*')
    .eq('user_id', userId)
    .gte('log_date', since)
    .order('log_date', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

/** Record activity for today, accumulating rather than overwriting. */
export async function logActivity(userId, enrollmentId, { minutes = 0, tasksDone = 0 }) {
  const today = new Date().toISOString().slice(0, 10);

  const { data: existing } = await supabase
    .from('daily_log')
    .select('*')
    .eq('user_id', userId)
    .eq('enrollment_id', enrollmentId)
    .eq('log_date', today)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from('daily_log')
      .update({
        minutes: Math.max(0, existing.minutes + minutes),
        tasks_done: Math.max(0, existing.tasks_done + tasksDone),
      })
      .eq('id', existing.id);
    if (error) throw error;
    return;
  }

  const { error } = await supabase.from('daily_log').insert({
    user_id: userId,
    enrollment_id: enrollmentId,
    log_date: today,
    minutes: Math.max(0, minutes),
    tasks_done: Math.max(0, tasksDone),
  });
  if (error) throw error;
}

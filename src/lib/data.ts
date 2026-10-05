"use client"

import { supabase } from "./supabase"
import type { Exercise, ExerciseSession, Plan, PlanDay, PlanItem, Profile } from "./types"

export function todayStr(d = new Date()): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

/** ISO weekday, 1 = Monday … 7 = Sunday */
export function isoWeekday(d = new Date()): number {
  const js = d.getDay()
  return js === 0 ? 7 : js
}

function check<T>(res: { data: T; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message)
  return res.data
}

// ───────── profile ─────────

const PROFILE_COLS = "id, display_name, accent, lang, active_plan_id"

export async function loadProfile(uid: string): Promise<Profile> {
  const sb = supabase()
  const res = await sb.from("profiles").select(PROFILE_COLS).eq("id", uid).maybeSingle()
  if (res.error) throw new Error(res.error.message)
  if (res.data) return res.data as Profile
  // profile row is created by a trigger at sign-up; recreate if it is missing
  const created = await sb.from("profiles").insert({ id: uid }).select(PROFILE_COLS).single()
  return check(created) as Profile
}

export async function updateProfile(uid: string, patch: Partial<Omit<Profile, "id">>) {
  check(await supabase().from("profiles").update(patch).eq("id", uid))
}

// ───────── plan ─────────

const ITEM_COLS = "id, day_id, exercise_id, position, sets, reps_min, reps_max, rest_seconds, rest_max_seconds"

export async function loadPlan(): Promise<{ plans: Plan[]; exercises: Exercise[] }> {
  const sb = supabase()
  const [plansRes, exRes] = await Promise.all([
    sb
      .from("plans")
      .select(`id, name, created_at, plan_days(id, plan_id, weekdays, label, focus, plan_items(${ITEM_COLS}))`)
      .order("created_at"),
    sb.from("exercises").select("id, name, notes, archived").order("name"),
  ])
  type RawDay = Omit<PlanDay, "items"> & { plan_items: PlanItem[] }
  const plans = (check(plansRes) as unknown as { id: string; name: string; plan_days: RawDay[] }[]).map((p) => ({
    id: p.id,
    name: p.name,
    days: p.plan_days
      .map((d) => ({
        id: d.id,
        plan_id: d.plan_id,
        weekdays: [...(d.weekdays ?? [])].sort((a, b) => a - b),
        label: d.label,
        focus: d.focus,
        items: [...d.plan_items].sort((a, b) => a.position - b.position),
      }))
      .sort((a, b) => (a.weekdays[0] ?? 9) - (b.weekdays[0] ?? 9)),
  }))
  return { plans, exercises: check(exRes) as Exercise[] }
}

export async function createPlan(name: string): Promise<string> {
  const res = await supabase().from("plans").insert({ name: name.trim() }).select("id").single()
  return (check(res) as { id: string }).id
}

export async function duplicatePlan(planId: string, name: string): Promise<string> {
  return check(await supabase().rpc("duplicate_plan", { p_plan: planId, p_name: name.trim() })) as string
}

export async function renamePlan(planId: string, name: string) {
  check(await supabase().from("plans").update({ name: name.trim() }).eq("id", planId))
}

export async function deletePlan(planId: string) {
  check(await supabase().from("plans").delete().eq("id", planId))
}

export async function createExercise(name: string): Promise<Exercise> {
  const sb = supabase()
  const clean = name.trim().replace(/\s+/g, " ")
  const existing = await sb.from("exercises").select("id, name, notes, archived").ilike("name", clean).maybeSingle()
  if (existing.data) {
    if (existing.data.archived) await sb.from("exercises").update({ archived: false }).eq("id", existing.data.id)
    return { ...(existing.data as Exercise), archived: false }
  }
  return check(await sb.from("exercises").insert({ name: clean }).select("id, name, notes, archived").single()) as Exercise
}

export async function updateExercise(id: string, patch: Partial<Pick<Exercise, "name" | "notes" | "archived">>) {
  check(await supabase().from("exercises").update(patch).eq("id", id))
}

export async function addPlanItem(dayId: string, exerciseId: string, position: number): Promise<PlanItem> {
  return check(
    await supabase()
      .from("plan_items")
      .insert({ day_id: dayId, exercise_id: exerciseId, position, sets: 2, reps_min: 8, reps_max: 12, rest_seconds: 90 })
      .select(ITEM_COLS)
      .single(),
  ) as PlanItem
}

export async function updatePlanItem(id: string, patch: Partial<Omit<PlanItem, "id" | "day_id">>) {
  check(await supabase().from("plan_items").update(patch).eq("id", id))
}

export async function removePlanItem(id: string) {
  check(await supabase().from("plan_items").delete().eq("id", id))
}

export async function reorderPlanItems(dayId: string, ids: string[]) {
  check(await supabase().rpc("reorder_plan_items", { p_day: dayId, p_ids: ids }))
}

export async function addDay(planId: string, weekdays: number[], label: string, focus: string | null): Promise<string> {
  const res = await supabase()
    .from("plan_days")
    .insert({ plan_id: planId, weekday: weekdays[0], weekdays, label, focus })
    .select("id")
    .single()
  return (check(res) as { id: string }).id
}

export async function updateDay(id: string, patch: Partial<Pick<PlanDay, "label" | "focus" | "weekdays">>) {
  check(await supabase().from("plan_days").update(patch).eq("id", id))
}

/**
 * Give a weekday to a day. If another day of the same plan had that weekday, it loses it;
 * when that was its only weekday, the other day is merged in: its past workouts are moved
 * to this day and the other day is removed.
 */
export async function takeWeekday(days: PlanDay[], dayId: string, weekday: number) {
  const sb = supabase()
  const target = days.find((d) => d.id === dayId)
  if (!target || target.weekdays.includes(weekday)) return
  const other = days.find((d) => d.id !== dayId && d.weekdays.includes(weekday))
  if (other) {
    if (other.weekdays.length > 1) {
      check(await sb.from("plan_days").update({ weekdays: other.weekdays.filter((w) => w !== weekday) }).eq("id", other.id))
    } else {
      check(await sb.from("sessions").update({ day_id: dayId }).eq("day_id", other.id))
      check(await sb.from("plan_days").delete().eq("id", other.id))
    }
  }
  const next = [...target.weekdays, weekday].sort((a, b) => a - b)
  check(await sb.from("plan_days").update({ weekdays: next }).eq("id", dayId))
  target.weekdays = next
  if (other) other.weekdays = other.weekdays.filter((w) => w !== weekday)
}

export async function deleteDay(id: string) {
  check(await supabase().from("plan_days").delete().eq("id", id))
}

// ───────── training ─────────

export interface TodayLog {
  exercise_id: string
  set_index: number
  weight: number | null
  reps: number | null
}

export async function loadToday(date: string, exerciseIds: string[]) {
  const sb = supabase()
  const [todayRes, prevRes] = await Promise.all([
    sb.from("sessions").select("id, day_id, set_logs(exercise_id, set_index, weight, reps)").eq("date", date).maybeSingle(),
    exerciseIds.length
      ? sb
          .from("sessions")
          .select("date, set_logs!inner(exercise_id, set_index, weight, reps)")
          .lt("date", date)
          .in("set_logs.exercise_id", exerciseIds)
          .order("date", { ascending: false })
          .limit(60)
      : Promise.resolve({ data: [], error: null }),
  ])
  if (todayRes.error) throw new Error(todayRes.error.message)
  const prev = check(prevRes) as { date: string; set_logs: TodayLog[] }[]

  const last = new Map<string, ExerciseSession>()
  for (const s of prev) {
    const byEx = new Map<string, TodayLog[]>()
    for (const l of s.set_logs) {
      if (!byEx.has(l.exercise_id)) byEx.set(l.exercise_id, [])
      byEx.get(l.exercise_id)!.push(l)
    }
    for (const [ex, logs] of byEx) {
      if (last.has(ex)) continue
      logs.sort((a, b) => a.set_index - b.set_index)
      last.set(ex, { date: s.date, sets: logs.map((l) => ({ weight: num(l.weight), reps: l.reps })) })
    }
  }
  const today = (todayRes.data?.set_logs ?? []).map((l: TodayLog) => ({ ...l, weight: num(l.weight) }))
  return { sessionId: (todayRes.data?.id as string | undefined) ?? null, today, last }
}

function num(v: unknown): number | null {
  if (v === null || v === undefined) return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

export async function ensureSession(uid: string, date: string, dayId: string | null): Promise<string> {
  const res = await supabase()
    .from("sessions")
    .upsert({ user_id: uid, date, day_id: dayId }, { onConflict: "user_id,date", ignoreDuplicates: false })
    .select("id")
    .single()
  return (check(res) as { id: string }).id
}

export async function upsertSet(uid: string, sessionId: string, log: TodayLog) {
  check(
    await supabase()
      .from("set_logs")
      .upsert(
        { user_id: uid, session_id: sessionId, exercise_id: log.exercise_id, set_index: log.set_index, weight: log.weight, reps: log.reps, done: true },
        { onConflict: "session_id,exercise_id,set_index" },
      ),
  )
}

export async function deleteSet(sessionId: string, exerciseId: string, setIndex: number) {
  check(
    await supabase().from("set_logs").delete().eq("session_id", sessionId).eq("exercise_id", exerciseId).eq("set_index", setIndex),
  )
}

// ───────── offline outbox ─────────

type OutboxOp =
  | { kind: "upsert"; date: string; dayId: string | null; log: TodayLog }
  | { kind: "delete"; date: string; dayId: string | null; exercise_id: string; set_index: number }

const OUTBOX_KEY = "gt-outbox"

function readOutbox(): OutboxOp[] {
  try {
    return JSON.parse(localStorage.getItem(OUTBOX_KEY) ?? "[]")
  } catch {
    return []
  }
}
function writeOutbox(ops: OutboxOp[]) {
  try {
    localStorage.setItem(OUTBOX_KEY, JSON.stringify(ops))
  } catch {}
}

export function isNetworkError(e: unknown): boolean {
  if (typeof navigator !== "undefined" && !navigator.onLine) return true
  const msg = e instanceof Error ? e.message : String(e)
  return /fetch|network|load failed/i.test(msg)
}

export function enqueue(op: OutboxOp) {
  const ops = readOutbox().filter((o) => {
    const a = o.kind === "upsert" ? o.log : o
    const b = op.kind === "upsert" ? op.log : op
    return !(o.date === op.date && a.exercise_id === b.exercise_id && a.set_index === b.set_index)
  })
  ops.push(op)
  writeOutbox(ops)
}

export function outboxSize() {
  return readOutbox().length
}

/** Sends queued offline changes. Returns how many were sent. */
export async function flushOutbox(uid: string): Promise<number> {
  const ops = readOutbox()
  if (!ops.length) return 0
  let sent = 0
  const rest: OutboxOp[] = []
  for (const op of ops) {
    try {
      const sid = await ensureSession(uid, op.date, op.dayId)
      if (op.kind === "upsert") await upsertSet(uid, sid, op.log)
      else await deleteSet(sid, op.exercise_id, op.set_index)
      sent++
    } catch (e) {
      rest.push(op)
      if (isNetworkError(e)) {
        rest.push(...ops.slice(ops.indexOf(op) + 1))
        break
      }
    }
  }
  writeOutbox(rest)
  return sent
}

// ───────── progress ─────────

export async function loadHistory(exerciseId: string): Promise<ExerciseSession[]> {
  const rows = check(
    await supabase()
      .from("sessions")
      .select("date, set_logs!inner(exercise_id, set_index, weight, reps)")
      .eq("set_logs.exercise_id", exerciseId)
      .order("date", { ascending: true }),
  ) as { date: string; set_logs: TodayLog[] }[]
  return rows.map((r) => ({
    date: r.date,
    sets: [...r.set_logs].sort((a, b) => a.set_index - b.set_index).map((l) => ({ weight: num(l.weight), reps: l.reps })),
  }))
}

/** exercise ids that have at least one logged set, with counts */
export async function loadLoggedExerciseIds(): Promise<Map<string, number>> {
  const rows = check(await supabase().from("exercises").select("id, set_logs(count)").eq("set_logs.set_index", 0)) as {
    id: string
    set_logs: { count: number }[]
  }[]
  const m = new Map<string, number>()
  for (const r of rows) {
    const n = r.set_logs?.[0]?.count ?? 0
    if (n > 0) m.set(r.id, n)
  }
  return m
}

export async function countSessions(): Promise<{ count: number; first: string | null }> {
  const sb = supabase()
  const [c, f] = await Promise.all([
    sb.from("sessions").select("id", { count: "exact", head: true }),
    sb.from("sessions").select("date").order("date").limit(1).maybeSingle(),
  ])
  return { count: c.count ?? 0, first: (f.data?.date as string | undefined) ?? null }
}

// ───────── import / export ─────────

export async function importLegacy(payload: unknown): Promise<{ sessions: number; sets: number; new_exercises: number }> {
  return check(await supabase().rpc("import_legacy", { payload })) as { sessions: number; sets: number; new_exercises: number }
}

export async function exportCsv(): Promise<string> {
  const rows = check(
    await supabase()
      .from("sessions")
      .select("date, plan_days(label), set_logs(set_index, weight, reps, exercises(name))")
      .order("date"),
  ) as unknown as {
    date: string
    plan_days: { label: string } | null
    set_logs: { set_index: number; weight: number | null; reps: number | null; exercises: { name: string } | null }[]
  }[]
  const esc = (v: unknown) => {
    const s = v === null || v === undefined ? "" : String(v)
    return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  const lines = ["date,day,exercise,set,weight_kg,reps"]
  for (const r of rows) {
    const logs = [...r.set_logs].sort(
      (a, b) => (a.exercises?.name ?? "").localeCompare(b.exercises?.name ?? "") || a.set_index - b.set_index,
    )
    for (const l of logs) {
      lines.push([r.date, r.plan_days?.label ?? "", l.exercises?.name ?? "", l.set_index + 1, l.weight ?? "", l.reps ?? ""].map(esc).join(","))
    }
  }
  return lines.join("\n")
}

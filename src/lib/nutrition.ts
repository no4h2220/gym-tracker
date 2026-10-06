"use client"

import { supabase } from "./supabase"
import { todayStr } from "./data"

/**
 * Ernährungsplan (Cut / Aufbau).
 * Sichtbarkeit wird in der Datenbank geprüft: RLS auf beiden Tabellen + can_see_nutrition().
 * Alle Kalorien sind Foodvisor-Kalorien.
 */

export interface NutritionPhase {
  id: string
  position: number
  key: string
  name: string
  start_date: string
  end_date: string
  /** null = wird berechnet (Cut) oder nicht getrackt (Roadtrip) */
  kcal: number | null
  protein_g: number
  fat_g: number | null
  carbs_g: number | null
  goal_text: string | null
  /** Overlay-Phase, in der nicht getrackt wird (Roadtrip) */
  is_tracking_paused: boolean
}

export interface NutritionAdjustment {
  id: string
  phase_id: string
  date: string
  delta_kcal: number
  new_kcal: number
  note: string | null
  created_at: string
}

export interface NutritionData {
  phases: NutritionPhase[]
  adjustments: NutritionAdjustment[]
}

/** Schritte der Anpassen-Buttons */
export const ADJUST_STEP = 150
/** Cut-Kalorien = letzte Aufbau-Kalorien − 150 − 300 */
const CUT_OFFSET = 150 + 300
/** Phasen mit 2-Wochen-Check */
const CHECK_PHASES = new Set(["bulk", "cut"])
const CHECK_INTERVAL_DAYS = 14

// ───────── Daten ─────────

export async function canSeeNutrition(): Promise<boolean> {
  const { data, error } = await supabase().rpc("can_see_nutrition")
  if (error) throw new Error(error.message)
  return data === true
}

export async function loadNutrition(): Promise<NutritionData> {
  const sb = supabase()
  const [p, a] = await Promise.all([
    sb
      .from("nutrition_phases")
      .select("id, position, key, name, start_date, end_date, kcal, protein_g, fat_g, carbs_g, goal_text, is_tracking_paused")
      .order("start_date")
      .order("position"),
    sb
      .from("nutrition_adjustments")
      .select("id, phase_id, date, delta_kcal, new_kcal, note, created_at")
      .order("date", { ascending: false })
      .order("created_at", { ascending: false }),
  ])
  if (p.error) throw new Error(p.error.message)
  if (a.error) throw new Error(a.error.message)
  return { phases: p.data as NutritionPhase[], adjustments: a.data as NutritionAdjustment[] }
}

export async function addAdjustment(input: { phaseId: string; delta: number; newKcal: number; note: string }): Promise<NutritionAdjustment> {
  const res = await supabase()
    .from("nutrition_adjustments")
    .insert({
      phase_id: input.phaseId,
      date: todayStr(),
      delta_kcal: input.delta,
      new_kcal: input.newKcal,
      note: input.note.trim() || null,
    })
    .select("id, phase_id, date, delta_kcal, new_kcal, note, created_at")
    .single()
  if (res.error) throw new Error(res.error.message)
  return res.data as NutritionAdjustment
}

// ───────── Rechnen ─────────

export function carbsFor(kcal: number, protein: number, fat: number | null): number {
  return Math.max(0, Math.round((kcal - protein * 4 - (fat ?? 0) * 9) / 4))
}

/** Tage zwischen zwei Daten (YYYY-MM-DD), b − a */
export function daysBetween(a: string, b: string): number {
  const ms = Date.parse(b + "T12:00:00") - Date.parse(a + "T12:00:00")
  return Math.round(ms / 86_400_000)
}

function addDays(d: string, n: number): string {
  const x = new Date(d + "T12:00:00")
  x.setDate(x.getDate() + n)
  return todayStr(x)
}

const inRange = (p: NutritionPhase, day: string) => p.start_date <= day && day <= p.end_date

/** Anpassungen einer Phase, neueste zuerst */
export function adjustmentsOf(data: NutritionData, phaseId: string) {
  return data.adjustments.filter((a) => a.phase_id === phaseId)
}

/** Kalorien zu Beginn der Phase (ohne eigene Anpassungen) */
export function baseKcal(data: NutritionData, phase: NutritionPhase): number | null {
  if (phase.is_tracking_paused) return null
  if (phase.kcal != null) return phase.kcal
  if (phase.key === "cut") {
    const bulk = data.phases.find((p) => p.key === "bulk")
    const bulkKcal = bulk ? currentKcal(data, bulk) : null
    return bulkKcal == null ? null : bulkKcal - CUT_OFFSET
  }
  return null
}

/** Aktuelles Kalorienziel der Phase inkl. Anpassungen */
export function currentKcal(data: NutritionData, phase: NutritionPhase): number | null {
  if (phase.is_tracking_paused) return null
  const last = adjustmentsOf(data, phase.id)[0]
  return last ? last.new_kcal : baseKcal(data, phase)
}

export interface Macros {
  kcal: number
  protein: number
  fat: number
  carbs: number
}

export function macrosOf(data: NutritionData, phase: NutritionPhase): Macros | null {
  const kcal = currentKcal(data, phase)
  if (kcal == null) return null
  const fat = phase.fat_g ?? 0
  return { kcal, protein: phase.protein_g, fat, carbs: carbsFor(kcal, phase.protein_g, fat) }
}

export type PhaseState = "past" | "current" | "future"

export function phaseState(p: NutritionPhase, today: string): PhaseState {
  if (p.end_date < today) return "past"
  if (p.start_date > today) return "future"
  return "current"
}

export interface Today {
  /** Hauptphase, die heute läuft (ohne Overlay) */
  phase: NutritionPhase | null
  /** nächste Phase, falls heute keine läuft */
  next: NutritionPhase | null
  /** aktives Overlay (Roadtrip) */
  overlay: NutritionPhase | null
  dayOf: number
  totalDays: number
  /** 2-Wochen-Check fällig */
  checkDue: boolean
  daysSinceCheck: number
}

export function todayView(data: NutritionData, today = todayStr()): Today {
  const main = data.phases.filter((p) => !p.is_tracking_paused)
  const phase = main.find((p) => inRange(p, today)) ?? null
  const next = phase ? null : (main.find((p) => p.start_date > today) ?? null)
  const overlay = data.phases.find((p) => p.is_tracking_paused && inRange(p, today)) ?? null

  let dayOf = 0
  let totalDays = 0
  let checkDue = false
  let daysSinceCheck = 0
  if (phase) {
    dayOf = daysBetween(phase.start_date, today) + 1
    totalDays = daysBetween(phase.start_date, phase.end_date) + 1
    if (CHECK_PHASES.has(phase.key) && !overlay) {
      // letzte Prüfung: Phasenstart, letzte Anpassung oder Ende eines Overlays (Roadtrip) in dieser Phase
      let since = phase.start_date
      const last = adjustmentsOf(data, phase.id)[0]
      if (last && last.date > since) since = last.date
      for (const o of data.phases) {
        if (!o.is_tracking_paused || o.end_date >= today || !inRange(phase, o.end_date)) continue
        const after = addDays(o.end_date, 1)
        if (after > since) since = after
      }
      daysSinceCheck = daysBetween(since, today)
      checkDue = daysSinceCheck > CHECK_INTERVAL_DAYS
    }
  }
  return { phase, next, overlay, dayOf, totalDays, checkDue, daysSinceCheck }
}

/** Phasen in Zeitstrahl-Reihenfolge; Overlays direkt nach der Phase, in der sie liegen */
export function timeline(data: NutritionData): { phase: NutritionPhase; overlay: boolean }[] {
  const main = data.phases.filter((p) => !p.is_tracking_paused)
  const overlays = data.phases.filter((p) => p.is_tracking_paused)
  const out: { phase: NutritionPhase; overlay: boolean }[] = []
  for (const p of main) {
    out.push({ phase: p, overlay: false })
    for (const o of overlays) if (inRange(p, o.start_date)) out.push({ phase: o, overlay: true })
  }
  for (const o of overlays) if (!out.some((x) => x.phase.id === o.id)) out.push({ phase: o, overlay: true })
  return out
}

import type { ExerciseSession } from "./types"

/** Epley estimate of a one-rep max. */
export function e1rm(weight: number, reps: number): number {
  if (!weight || !reps) return 0
  if (reps === 1) return weight
  return weight * (1 + reps / 30)
}

export interface SessionPoint {
  date: string
  maxWeight: number
  /** best reps achieved at the max weight of this session */
  repsAtMax: number
  e1rm: number
  volume: number
}

export function toPoints(history: ExerciseSession[]): SessionPoint[] {
  return history
    .map((s) => {
      const valid = s.sets.filter((x) => (x.weight ?? 0) > 0 || (x.reps ?? 0) > 0)
      if (!valid.length) return null
      const maxWeight = Math.max(...valid.map((x) => x.weight ?? 0))
      const repsAtMax = Math.max(0, ...valid.filter((x) => (x.weight ?? 0) === maxWeight).map((x) => x.reps ?? 0))
      const best = Math.max(0, ...valid.map((x) => e1rm(x.weight ?? 0, x.reps ?? 0)))
      const volume = valid.reduce((sum, x) => sum + (x.weight ?? 0) * (x.reps ?? 0), 0)
      return { date: s.date, maxWeight, repsAtMax, e1rm: best, volume }
    })
    .filter((p): p is SessionPoint => p !== null)
    .sort((a, b) => a.date.localeCompare(b.date))
}

/** Personal record: heaviest weight, ties broken by more reps. */
export function personalRecord(points: SessionPoint[]): SessionPoint | null {
  let pr: SessionPoint | null = null
  for (const p of points) {
    if (!pr || p.maxWeight > pr.maxWeight || (p.maxWeight === pr.maxWeight && p.repsAtMax > pr.repsAtMax)) pr = p
  }
  return pr
}

export interface PlateauInsight {
  weight: number
  since: string
  firstReps: number
  bestReps: number
  sessions: number
}

/**
 * When the current weight has been used for several sessions,
 * report how the reps developed at that weight.
 */
export function plateauInsight(points: SessionPoint[]): PlateauInsight | null {
  if (points.length < 3) return null
  const pr = personalRecord(points)
  if (!pr) return null
  const atTop = points.filter((p) => p.maxWeight === pr.maxWeight)
  if (atTop.length < 3) return null
  return {
    weight: pr.maxWeight,
    since: atTop[0].date,
    firstReps: atTop[0].repsAtMax,
    bestReps: Math.max(...atTop.map((p) => p.repsAtMax)),
    sessions: atTop.length,
  }
}

/** Suggestion for today based on last session and the rep range. */
export function nextTarget(
  last: { weight: number | null; reps: number | null }[] | undefined,
  repsMin: number,
  repsMax: number,
  step = 2.5,
): { weight: number; reps: number; increase: boolean } | null {
  if (!last || !last.length) return null
  const weights = last.map((s) => s.weight ?? 0)
  const top = Math.max(...weights)
  if (!top) return null
  const repsAtTop = last.filter((s) => (s.weight ?? 0) === top).map((s) => s.reps ?? 0)
  if (repsAtTop.every((r) => r >= repsMax)) {
    return { weight: Math.round((top + step) * 100) / 100, reps: repsMin, increase: true }
  }
  const best = Math.max(...repsAtTop)
  return { weight: top, reps: Math.min(repsMax, Math.max(repsMin, best + 1)), increase: false }
}

export function formatKg(n: number | null | undefined): string {
  if (n === null || n === undefined) return "–"
  return Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/0$/, "")
}

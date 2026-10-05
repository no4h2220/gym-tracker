/**
 * Parser for the JSON export of the old localStorage gym tracker.
 * Pure functions only — the result is sent to the `import_legacy` RPC.
 */

export interface LegacySet {
  weight?: string | number
  reps?: string | number
  done?: boolean
}

export interface LegacyEntry {
  exercise: string
  date: string
  phase?: number
  day?: string
  sets: LegacySet[]
}

export interface LegacyExport {
  app: string
  version: number
  gymLogs: Record<string, LegacyEntry>
}

export interface ImportSession {
  date: string
  weekday: number
  entries: { name: string; sets: { w: number | null; r: number | null }[] }[]
}

export interface ImportPreview {
  sessions: ImportSession[]
  /** unique exercise-per-date entries that will be imported */
  entryCount: number
  setCount: number
  /** entries that were the same exercise on the same date (e.g. "Incline barbell" vs "incline barbell") and got merged */
  mergedDuplicates: number
  firstDate: string | null
  lastDate: string | null
  /** canonical exercise name → number of entries, with whether it is in the current plan */
  exercises: { name: string; count: number; inPlan: boolean; variants: string[] }[]
}

const DAY_TO_WEEKDAY: Record<string, number> = { mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6, sun: 7 }

function toNum(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null
  const n = typeof v === "number" ? v : Number(String(v).replace(",", "."))
  return Number.isFinite(n) && n >= 0 ? n : null
}

function weekdayOfDate(date: string): number {
  const d = new Date(date + "T12:00:00")
  const js = d.getDay() // 0 = Sunday
  return js === 0 ? 7 : js
}

export class LegacyParseError extends Error {}

export function parseLegacyExport(raw: unknown, planExerciseNames: string[]): ImportPreview {
  if (!raw || typeof raw !== "object") throw new LegacyParseError("not-json-object")
  const data = raw as Partial<LegacyExport>
  if (!data.gymLogs || typeof data.gymLogs !== "object") throw new LegacyParseError("no-gym-logs")

  const planLower = new Map(planExerciseNames.map((n) => [n.trim().toLowerCase(), n]))
  // name used for the database: plan spelling if known, else the first spelling seen
  const canonical = new Map<string, string>()
  const variants = new Map<string, Set<string>>()
  const counts = new Map<string, number>()

  const byDate = new Map<string, { days: Map<number, number>; entries: Map<string, { w: number | null; r: number | null }[]> }>()
  let mergedDuplicates = 0

  for (const entry of Object.values(data.gymLogs)) {
    if (!entry || typeof entry !== "object") continue
    const name = String(entry.exercise ?? "").trim()
    const date = String(entry.date ?? "")
    if (!name || !/^\d{4}-\d{2}-\d{2}$/.test(date)) continue
    const sets = (Array.isArray(entry.sets) ? entry.sets : [])
      .map((s) => ({ w: toNum(s?.weight), r: toNum(s?.reps) }))
      .filter((s) => s.w !== null || s.r !== null)
      .slice(0, 10)
    if (!sets.length) continue

    const key = name.toLowerCase()
    if (!canonical.has(key)) canonical.set(key, planLower.get(key) ?? name)
    if (!variants.has(key)) variants.set(key, new Set())
    variants.get(key)!.add(name)
    counts.set(key, (counts.get(key) ?? 0) + 1)

    if (!byDate.has(date)) byDate.set(date, { days: new Map(), entries: new Map() })
    const bucket = byDate.get(date)!
    const wd = DAY_TO_WEEKDAY[String(entry.day ?? "")] ?? weekdayOfDate(date)
    bucket.days.set(wd, (bucket.days.get(wd) ?? 0) + 1)
    // same exercise twice on one date: keep the entry with more sets
    const prev = bucket.entries.get(key)
    if (prev) mergedDuplicates++
    if (!prev || sets.length > prev.length) bucket.entries.set(key, sets)
  }

  const sessions: ImportSession[] = [...byDate.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, b]) => {
      // the plan day most entries of this date were logged under
      const weekday = [...b.days.entries()].sort((x, y) => y[1] - x[1])[0][0]
      return {
        date,
        weekday,
        entries: [...b.entries.entries()].map(([key, sets]) => ({ name: canonical.get(key)!, sets })),
      }
    })

  const exercises = [...counts.entries()]
    .map(([key, count]) => ({
      name: canonical.get(key)!,
      count,
      inPlan: planLower.has(key),
      variants: [...(variants.get(key) ?? [])],
    }))
    .sort((a, b) => Number(b.inPlan) - Number(a.inPlan) || b.count - a.count)

  const entryCount = sessions.reduce((n, s) => n + s.entries.length, 0)
  const setCount = sessions.reduce((n, s) => n + s.entries.reduce((m, e) => m + e.sets.length, 0), 0)
  return {
    sessions,
    entryCount,
    setCount,
    mergedDuplicates,
    firstDate: sessions[0]?.date ?? null,
    lastDate: sessions[sessions.length - 1]?.date ?? null,
    exercises,
  }
}

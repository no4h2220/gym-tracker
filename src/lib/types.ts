export type Lang = "de" | "en"

export interface Profile {
  id: string
  display_name: string | null
  accent: string
  lang: Lang
  active_plan_id: string | null
}

export interface Plan {
  id: string
  name: string
  days: PlanDay[]
}

export interface Exercise {
  id: string
  name: string
  notes: string | null
  archived: boolean
}

export interface PlanItem {
  id: string
  day_id: string
  exercise_id: string
  position: number
  sets: number
  reps_min: number
  reps_max: number
  rest_seconds: number
  rest_max_seconds: number | null
}

export interface PlanDay {
  id: string
  plan_id: string
  /** ISO weekdays this day is trained on (1 = Monday … 7 = Sunday), sorted */
  weekdays: number[]
  label: string
  focus: string | null
  items: PlanItem[]
}

export interface SetLog {
  id?: string
  session_id: string
  exercise_id: string
  set_index: number
  weight: number | null
  reps: number | null
  done: boolean
}

/** One exercise's sets in one session, with the session date. */
export interface ExerciseSession {
  date: string // YYYY-MM-DD
  sets: { weight: number | null; reps: number | null }[]
}

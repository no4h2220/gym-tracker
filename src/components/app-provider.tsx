"use client"

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react"
import type { Session } from "@supabase/supabase-js"
import { supabase } from "@/lib/supabase"
import { DICTS, type Dict } from "@/lib/i18n"
import { ACCENTS, LANG_STORAGE_KEY, applyAccent } from "@/lib/accent"
import { flushOutbox, loadPlan, loadProfile, updateProfile } from "@/lib/data"
import type { Exercise, Lang, Plan, PlanDay, Profile } from "@/lib/types"
import { toast } from "sonner"

interface AppState {
  session: Session | null
  authReady: boolean
  profile: Profile | null
  plans: Plan[]
  /** the plan used for training (falls back to the first plan) */
  activePlan: Plan | null
  /** days of the active plan */
  days: PlanDay[]
  exercises: Exercise[]
  planReady: boolean
  lang: Lang
  t: Dict
  setLang: (l: Lang) => void
  setAccent: (id: string) => void
  setDisplayName: (n: string) => Promise<void>
  reloadPlan: () => Promise<void>
  setPlans: (fn: (p: Plan[]) => Plan[]) => void
  setActivePlan: (id: string) => void
  setExercises: (fn: (e: Exercise[]) => Exercise[]) => void
}

const Ctx = createContext<AppState | null>(null)

export function useApp() {
  const v = useContext(Ctx)
  if (!v) throw new Error("useApp outside AppProvider")
  return v
}

function initialLang(): Lang {
  if (typeof document !== "undefined" && document.documentElement.lang === "en") return "en"
  return "de"
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [authReady, setAuthReady] = useState(false)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [plans, setPlansState] = useState<Plan[]>([])
  const [exercises, setExercisesState] = useState<Exercise[]>([])
  const [planReady, setPlanReady] = useState(false)
  const [lang, setLangState] = useState<Lang>(initialLang)

  useEffect(() => {
    // A password-reset link signs the user in; make sure they land on the page that sets the new password.
    const toReset = () => {
      if (window.location.pathname !== "/reset-password") window.location.replace("/reset-password")
    }
    const recovering = /type=recovery/.test(window.location.hash)
    const sb = supabase()
    sb.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setAuthReady(true)
      if (recovering && data.session) toReset()
    })
    const { data: sub } = sb.auth.onAuthStateChange((e, s) => {
      setSession(s)
      setAuthReady(true)
      if (e === "PASSWORD_RECOVERY") toReset()
      if (!s) {
        setProfile(null)
        setPlansState([])
        setExercisesState([])
        setPlanReady(false)
      }
    })
    return () => sub.subscription.unsubscribe()
  }, [])

  const uid = session?.user.id ?? null

  const reloadPlan = useCallback(async () => {
    const p = await loadPlan()
    setPlansState(p.plans)
    setExercisesState(p.exercises)
    setPlanReady(true)
  }, [])

  useEffect(() => {
    if (!uid) return
    let alive = true
    loadProfile(uid)
      .then((p) => {
        if (!alive) return
        setProfile(p)
        applyAccent(p.accent)
        setLangState(p.lang)
        document.documentElement.lang = p.lang
        try {
          localStorage.setItem(LANG_STORAGE_KEY, p.lang)
        } catch {}
      })
      .catch(() => {})
    loadPlan()
      .then((p) => {
        if (!alive) return
        setPlansState(p.plans)
        setExercisesState(p.exercises)
      })
      .catch((e: unknown) => {
        if (!alive) return
        toast.error(DICTS[initialLang()].error, { description: e instanceof Error ? e.message : String(e) })
      })
      .finally(() => alive && setPlanReady(true))
    return () => {
      alive = false
    }
  }, [uid])

  // offline sets: send them when we're back online
  useEffect(() => {
    if (!uid) return
    const t = DICTS[lang]
    const flush = () =>
      flushOutbox(uid)
        .then((n) => {
          if (n > 0) toast.success(t.synced)
        })
        .catch(() => {})
    flush()
    window.addEventListener("online", flush)
    return () => window.removeEventListener("online", flush)
  }, [uid, lang])

  const setLang = useCallback(
    (l: Lang) => {
      setLangState(l)
      document.documentElement.lang = l
      try {
        localStorage.setItem(LANG_STORAGE_KEY, l)
      } catch {}
      setProfile((p) => (p ? { ...p, lang: l } : p))
      if (uid) updateProfile(uid, { lang: l }).catch(() => {})
    },
    [uid],
  )

  const setAccent = useCallback(
    (id: string) => {
      if (!ACCENTS.some((a) => a.id === id)) return
      applyAccent(id)
      setProfile((p) => (p ? { ...p, accent: id } : p))
      if (uid) updateProfile(uid, { accent: id }).catch(() => {})
    },
    [uid],
  )

  const setDisplayName = useCallback(
    async (n: string) => {
      const v = n.trim().slice(0, 40) || null
      setProfile((p) => (p ? { ...p, display_name: v } : p))
      if (uid) await updateProfile(uid, { display_name: v })
    },
    [uid],
  )

  const setActivePlan = useCallback(
    (id: string) => {
      setProfile((p) => (p ? { ...p, active_plan_id: id } : p))
      if (uid) updateProfile(uid, { active_plan_id: id }).catch(() => {})
    },
    [uid],
  )

  const activePlan = useMemo(
    () => plans.find((p) => p.id === profile?.active_plan_id) ?? plans[0] ?? null,
    [plans, profile?.active_plan_id],
  )
  const days = useMemo(() => activePlan?.days ?? [], [activePlan])

  const value = useMemo<AppState>(
    () => ({
      session,
      authReady,
      profile,
      plans,
      activePlan,
      days,
      exercises,
      planReady,
      lang,
      t: DICTS[lang],
      setLang,
      setAccent,
      setDisplayName,
      reloadPlan,
      setPlans: (fn) => setPlansState(fn),
      setActivePlan,
      setExercises: (fn) => setExercisesState(fn),
    }),
    [session, authReady, profile, plans, activePlan, days, exercises, planReady, lang, setLang, setAccent, setDisplayName, reloadPlan, setActivePlan],
  )

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

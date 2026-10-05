"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { AnimatePresence, motion, useReducedMotion } from "motion/react"
import { toast } from "sonner"
import { useApp } from "@/components/app-provider"
import { ProgressRing } from "@/components/ring"
import { CheckIcon, StarIcon } from "@/components/icons"
import { Button } from "@/components/ui/button"
import {
  deleteSet,
  enqueue,
  ensureSession,
  isNetworkError,
  isoWeekday,
  loadToday,
  todayStr,
  upsertSet,
  type TodayLog,
} from "@/lib/data"
import { formatKg, nextTarget } from "@/lib/stats"
import { formatDate } from "@/lib/i18n"
import type { Exercise, ExerciseSession, PlanItem } from "@/lib/types"
import { cn } from "@/lib/utils"

type Logged = Map<string, { weight: number | null; reps: number | null }>
type Drafts = Record<string, { w?: string; r?: string }>
const key = (ex: string, i: number) => `${ex}:${i}`

function parseNum(v: string | undefined): number | null {
  if (v === undefined || v.trim() === "") return null
  const n = Number(v.replace(",", "."))
  return Number.isFinite(n) && n >= 0 ? n : null
}

function restLabel(it: PlanItem) {
  const fmt = (s: number) => (s >= 60 && s % 60 === 0 ? `${s / 60}` : `${s}`)
  const unit = it.rest_seconds >= 60 && it.rest_seconds % 60 === 0 ? "min" : "s"
  return it.rest_max_seconds ? `${fmt(it.rest_seconds)}–${fmt(it.rest_max_seconds)} ${unit}` : `${fmt(it.rest_seconds)} ${unit}`
}

export default function TrainingPage() {
  const { days, exercises, planReady, t, lang, session } = useApp()
  const uid = session!.user.id
  const date = todayStr()
  const reduce = useReducedMotion()

  const sortedDays = useMemo(() => [...days].sort((a, b) => a.weekday - b.weekday), [days])
  const [weekday, setWeekday] = useState<number | null>(null)
  const effectiveWeekday = weekday ?? (sortedDays.some((d) => d.weekday === isoWeekday()) ? isoWeekday() : null)
  const day = sortedDays.find((d) => d.weekday === effectiveWeekday) ?? null

  const exById = useMemo(() => new Map<string, Exercise>(exercises.map((e) => [e.id, e])), [exercises])
  const items = useMemo(() => day?.items ?? [], [day])
  // history for every exercise of the plan, loaded once: switching days is instant
  const exIds = useMemo(() => [...new Set(sortedDays.flatMap((d) => d.items.map((i) => i.exercise_id)))].sort(), [sortedDays])

  const [last, setLast] = useState<Map<string, ExerciseSession>>(new Map())
  const [logged, setLogged] = useState<Logged>(new Map())
  const [drafts, setDrafts] = useState<Drafts>({})
  const [expanded, setExpanded] = useState<string | null>(null)
  const loadKey = `${date}|${exIds.join(",")}`
  const [loadedKey, setLoadedKey] = useState<string | null>(null)
  const loading = loadedKey !== loadKey
  const sessionIdRef = useRef<string | null>(null)
  // staggered entrance only on first paint; afterwards rows must react instantly
  const [intro, setIntro] = useState(true)
  useEffect(() => {
    const id = setTimeout(() => setIntro(false), 900)
    return () => clearTimeout(id)
  }, [])

  useEffect(() => {
    if (!planReady) return
    let alive = true
    loadToday(date, exIds)
      .then((r) => {
        if (!alive) return
        sessionIdRef.current = r.sessionId
        setLast(r.last)
        const m: Logged = new Map()
        r.today.forEach((l: TodayLog) => m.set(key(l.exercise_id, l.set_index), { weight: l.weight, reps: l.reps }))
        setLogged(m)
      })
      .catch(() => {})
      .finally(() => alive && setLoadedKey(loadKey))
    return () => {
      alive = false
    }
  }, [date, exIds, planReady, loadKey])

  const doneCount = (it: PlanItem) => Array.from({ length: it.sets }, (_, i) => logged.has(key(it.exercise_id, i))).filter(Boolean).length
  const isComplete = (it: PlanItem) => doneCount(it) >= it.sets
  const completed = items.filter(isComplete).length

  // open the first unfinished exercise once data is in
  const firstOpen = items.find((it) => !isComplete(it))?.exercise_id ?? null
  const active = expanded ?? (loading ? null : firstOpen)

  const placeholderFor = useCallback(
    (ex: string, i: number) => {
      const l = last.get(ex)?.sets
      const s = l?.[i] ?? l?.[l.length - 1]
      return { w: s?.weight ?? null, r: s?.reps ?? null }
    },
    [last],
  )

  async function persist(op: { kind: "upsert"; log: TodayLog } | { kind: "delete"; exercise_id: string; set_index: number }) {
    try {
      if (!sessionIdRef.current) sessionIdRef.current = await ensureSession(uid, date, day?.id ?? null)
      if (op.kind === "upsert") await upsertSet(uid, sessionIdRef.current, op.log)
      else await deleteSet(sessionIdRef.current, op.exercise_id, op.set_index)
    } catch (e) {
      if (isNetworkError(e)) {
        enqueue(op.kind === "upsert" ? { kind: "upsert", date, dayId: day?.id ?? null, log: op.log } : { kind: "delete", date, dayId: day?.id ?? null, exercise_id: op.exercise_id, set_index: op.set_index })
        toast(t.offlineSaved)
      } else {
        toast.error(t.error)
      }
    }
  }

  function toggleSet(it: PlanItem, i: number) {
    const k = key(it.exercise_id, i)
    if (logged.has(k)) {
      const prev = logged.get(k)!
      setLogged((m) => {
        const n = new Map(m)
        n.delete(k)
        return n
      })
      setDrafts((d) => ({ ...d, [k]: { w: prev.weight?.toString() ?? "", r: prev.reps?.toString() ?? "" } }))
      persist({ kind: "delete", exercise_id: it.exercise_id, set_index: i })
      return
    }
    const ph = placeholderFor(it.exercise_id, i)
    const weight = parseNum(drafts[k]?.w) ?? ph.w
    const reps = parseNum(drafts[k]?.r) ?? ph.r
    if (reps === null) {
      document.getElementById(`r-${k}`)?.focus()
      return
    }
    setLogged((m) => new Map(m).set(k, { weight, reps }))
    if (typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate?.(12)
    persist({ kind: "upsert", log: { exercise_id: it.exercise_id, set_index: i, weight, reps } })

    // last set of this exercise → glide to the next unfinished one
    const doneAfter = doneCount(it) + 1
    if (doneAfter >= it.sets) {
      const next = items.find((x) => x.exercise_id !== it.exercise_id && !isComplete(x))
      setTimeout(() => setExpanded(next?.exercise_id ?? "__none__"), 650)
    }
  }

  const header = (
    <header className="sticky-head anim-rise flex items-end justify-between gap-4">
      <div className="flex min-w-0 flex-col gap-1.5">
        <span className="num text-xs tracking-[.08em] text-muted-foreground uppercase">
          {formatDate(date, lang, { weekday: "long", day: "numeric", month: "short" })}
        </span>
        <h1 className="font-wide truncate text-[44px] leading-[.9] font-black tracking-tight uppercase">{day?.label ?? t.tabTraining}</h1>
        {day?.focus && <span className="truncate text-sm text-muted-foreground">{day.focus}</span>}
      </div>
      {day && items.length > 0 && <ProgressRing done={completed} total={items.length} label={t.doneOf(completed, items.length)} />}
    </header>
  )

  const daySelector = (
    <nav aria-label={t.weekday} className="anim-rise flex gap-1.5" style={{ "--i": 1 } as React.CSSProperties}>
      {sortedDays.map((d) => {
        const on = d.weekday === effectiveWeekday
        return (
          <button
            key={d.id}
            type="button"
            aria-pressed={on}
            onClick={() => {
              setWeekday(d.weekday)
              setExpanded(null)
            }}
            className={cn(
              "h-11 flex-1 rounded-xl text-[13px] transition-[background-color,color,transform] duration-200 active:scale-95",
              on ? "bg-primary font-extrabold text-primary-foreground" : "border border-border font-semibold text-muted-foreground",
            )}
          >
            {t.weekdaysShort[d.weekday - 1]}
          </button>
        )
      })}
    </nav>
  )

  if (!planReady) return <p className="num text-sm text-muted-foreground">{t.loading}</p>

  return (
    <div className="flex flex-col gap-5">
      {header}
      {sortedDays.length > 0 && daySelector}

      {!day && (
        <div className="anim-rise flex flex-col gap-2 rounded-2xl bg-card p-5" style={{ "--i": 2 } as React.CSSProperties}>
          <p className="font-semibold">{t.restDay}</p>
          <p className="text-sm text-muted-foreground">{sortedDays.length ? t.restDayHint : t.emptyDay}</p>
        </div>
      )}

      {day && items.length === 0 && (
        <div className="anim-rise flex flex-col items-start gap-3 rounded-2xl bg-card p-5" style={{ "--i": 2 } as React.CSSProperties}>
          <p className="text-muted-foreground">{t.emptyDay}</p>
          <Button asChild variant="secondary">
            <Link href="/plan">{t.toPlan}</Link>
          </Button>
        </div>
      )}

      <motion.section
        key={day?.id ?? "none"}
        initial={reduce ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.16, ease: "easeOut" }}
        className="flex flex-col gap-2"
      >
        {items.map((it, idx) => {
          const ex = exById.get(it.exercise_id)
          if (!ex) return null
          return (
            <ExerciseItem
              key={it.id}
              index={idx}
              intro={intro}
              item={it}
              exercise={ex}
              last={last.get(it.exercise_id)}
              logged={logged}
              drafts={drafts}
              setDraft={(k, v) => setDrafts((d) => ({ ...d, [k]: { ...d[k], ...v } }))}
              placeholderFor={placeholderFor}
              onToggle={(i) => toggleSet(it, i)}
              open={active === it.exercise_id}
              onOpenChange={(o) => setExpanded(o ? it.exercise_id : "__none__")}
              rest={restLabel(it)}
            />
          )
        })}
      </motion.section>
    </div>
  )
}

function ExerciseItem({
  index,
  intro,
  item,
  exercise,
  last,
  logged,
  drafts,
  setDraft,
  placeholderFor,
  onToggle,
  open,
  onOpenChange,
  rest,
}: {
  index: number
  intro: boolean
  item: PlanItem
  exercise: Exercise
  last: ExerciseSession | undefined
  logged: Logged
  drafts: Drafts
  setDraft: (k: string, v: { w?: string; r?: string }) => void
  placeholderFor: (ex: string, i: number) => { w: number | null; r: number | null }
  onToggle: (i: number) => void
  open: boolean
  onOpenChange: (open: boolean) => void
  rest: string
}) {
  const { t } = useApp()
  const reduce = useReducedMotion()
  const doneSets = Array.from({ length: item.sets }, (_, i) => logged.get(key(item.exercise_id, i)))
  const doneCount = doneSets.filter(Boolean).length
  const complete = doneCount >= item.sets
  const firstOpenSet = doneSets.findIndex((s) => !s)
  const target = nextTarget(last?.sets, item.reps_min, item.reps_max)

  let hint: string | null = null
  if (target) {
    const bestToday = Math.max(0, ...doneSets.filter((s) => s && (s.weight ?? 0) >= target.weight).map((s) => s!.reps ?? 0))
    if (target.increase && !bestToday) hint = `${t.goalIncrease}: ${formatKg(target.weight)} kg × ${target.reps}`
    else if (bestToday >= target.reps) hint = t.goalReached
    else if (bestToday > 0) hint = t.repsToGoal(target.reps - bestToday)
    else hint = `${t.goal}: ${formatKg(target.weight)} × ${target.reps}`
  }

  const done = doneSets.filter(Boolean) as { weight: number | null; reps: number | null }[]
  const summary = done.length
    ? `${formatKg(done[0].weight)} kg · ${done.map((s) => s.reps ?? "–").join("/")}`
    : last
      ? `${t.last} ${formatKg(last.sets[0]?.weight)} × ${last.sets[0]?.reps ?? "–"}`
      : `${item.sets} × ${item.reps_min}–${item.reps_max}`

  const bodyId = `ex-body-${item.id}`

  return (
    <article
      className={cn(
        intro && "anim-rise",
        "rounded-[20px] transition-[background-color,box-shadow] duration-200",
        open ? "anim-glow bg-surface-hi" : "bg-card",
      )}
      style={{ "--i": index + 2 } as React.CSSProperties}
    >
      <button
        type="button"
        onClick={() => onOpenChange(!open)}
        aria-expanded={open}
        aria-controls={bodyId}
        className="flex min-h-14 w-full items-center gap-3 px-4 py-3.5 text-left"
      >
        <span
          className={cn(
            "flex size-[26px] shrink-0 items-center justify-center rounded-[8px] transition-colors duration-200",
            complete ? "bg-primary text-primary-foreground" : done.length ? "border-[1.5px] border-primary" : "border-[1.5px] border-line-2",
          )}
        >
          {complete && <CheckIcon />}
        </span>
        <span className={cn("min-w-0 flex-1 text-base font-bold transition-colors", open ? "leading-snug" : "truncate", complete && !open && "text-muted-foreground")}>{exercise.name}</span>
        {!open && <span className="num shrink-0 text-[13px] text-muted-foreground">{summary}</span>}
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            id={bodyId}
            key="body"
            initial={reduce ? false : { height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={reduce ? { opacity: 0 } : { height: 0, opacity: 0 }}
            transition={{ height: { duration: 0.24, ease: [0.2, 0.8, 0.2, 1] }, opacity: { duration: 0.16 } }}
            className="overflow-hidden"
          >
            <div className="flex flex-col gap-3 px-4 pb-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="num text-xs text-muted-foreground">
                  {item.sets} × {item.reps_min}–{item.reps_max} · {rest}
                </span>
                <span className="rounded-full bg-[color-mix(in_srgb,var(--primary)_14%,transparent)] px-2.5 py-1 text-xs font-semibold text-primary">
                  {last ? `${t.lastTime} ${formatKg(last.sets[0]?.weight)} × ${last.sets.map((s) => s.reps ?? "–").join(" · ")}` : t.noHistory}
                </span>
              </div>
              {exercise.notes && <p className="text-[13px] text-text-2">{exercise.notes}</p>}

              <div className="flex flex-col gap-2">
                {Array.from({ length: item.sets }, (_, i) => {
                  const k = key(item.exercise_id, i)
                  const d = logged.get(k)
                  const ph = placeholderFor(item.exercise_id, i)
                  const lastSet = last?.sets[i]
                  const isCurrent = i === firstOpenSet
                  let delta: string | null = null
                  if (d && lastSet) {
                    if ((d.weight ?? 0) > (lastSet.weight ?? 0)) delta = `+${formatKg((d.weight ?? 0) - (lastSet.weight ?? 0))}kg`
                    else if ((d.weight ?? 0) === (lastSet.weight ?? 0) && (d.reps ?? 0) > (lastSet.reps ?? 0)) delta = `+${(d.reps ?? 0) - (lastSet.reps ?? 0)}`
                  }
                  return (
                    <div
                      key={k}
                      className={cn(
                        "flex items-center gap-2 rounded-[18px] bg-background p-1.5 transition-shadow duration-200",
                        isCurrent && "shadow-[inset_0_0_0_1.5px_var(--primary)]",
                      )}
                    >
                      <span className="num w-8 shrink-0 text-center text-xs text-muted-foreground">{i + 1}</span>
                      <label className="flex h-11 min-w-0 flex-1 items-center justify-center gap-1">
                        <span className="sr-only">{t.weightOf(i + 1)}</span>
                        {d ? (
                          <span className="num text-xl font-semibold">{formatKg(d.weight)}</span>
                        ) : (
                          <input
                            inputMode="decimal"
                            enterKeyHint="next"
                            className="num w-full min-w-0 bg-transparent text-center text-xl font-semibold outline-none placeholder:text-[#5A5F55]"
                            placeholder={ph.w !== null ? formatKg(ph.w) : "0"}
                            value={drafts[k]?.w ?? ""}
                            onChange={(e) => setDraft(k, { w: e.target.value })}
                            name={`w-${i}`}
                            autoComplete="off"
                          />
                        )}
                        <span className="text-xs text-muted-foreground">kg</span>
                      </label>
                      <span className="text-line-2" aria-hidden="true">
                        ×
                      </span>
                      <label className="relative flex h-11 min-w-0 flex-1 items-center justify-center gap-1">
                        <span className="sr-only">{t.repsOf(i + 1)}</span>
                        {d ? (
                          <span className="num text-xl font-semibold">{d.reps ?? "–"}</span>
                        ) : (
                          <input
                            id={`r-${k}`}
                            inputMode="numeric"
                            enterKeyHint="done"
                            className="num w-full min-w-0 bg-transparent text-center text-xl font-semibold outline-none placeholder:text-[#5A5F55]"
                            placeholder={ph.r !== null ? String(ph.r) : "0"}
                            value={drafts[k]?.r ?? ""}
                            onChange={(e) => setDraft(k, { r: e.target.value })}
                            onKeyDown={(e) => e.key === "Enter" && onToggle(i)}
                            name={`r-${i}`}
                            autoComplete="off"
                          />
                        )}
                        <span className="text-xs text-muted-foreground">{t.reps}</span>
                        <AnimatePresence>
                          {delta && (
                            <motion.span
                              key={delta}
                              initial={{ scale: 0, opacity: 0 }}
                              animate={{ scale: 1, opacity: 1 }}
                              exit={{ scale: 0, opacity: 0 }}
                              transition={{ type: "spring", stiffness: 600, damping: 18 }}
                              className="num absolute top-0 right-1 text-[10px] font-bold text-primary"
                            >
                              {delta}
                            </motion.span>
                          )}
                        </AnimatePresence>
                      </label>
                      <motion.button
                        type="button"
                        whileTap={{ scale: 0.88 }}
                        onClick={() => onToggle(i)}
                        aria-label={d ? t.setUndo(i + 1) : t.setDone(i + 1)}
                        aria-pressed={!!d}
                        className={cn(
                          "flex size-11 shrink-0 items-center justify-center rounded-full transition-colors duration-200",
                          d ? "bg-primary text-primary-foreground" : "border-[1.5px] border-line-2 text-transparent",
                        )}
                      >
                        {d && <CheckIcon size={18} draw />}
                      </motion.button>
                    </div>
                  )
                })}
              </div>

              {hint && (
                <p className="flex items-center gap-2 text-[13px] text-primary" aria-live="polite">
                  <StarIcon />
                  {hint}
                </p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </article>
  )
}

"use client"

import { Suspense, useEffect, useMemo, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { motion, useReducedMotion } from "motion/react"
import { useApp } from "@/components/app-provider"
import { ProgressChart, type Metric } from "@/components/progress-chart"
import { ChevronDown, TrendIcon } from "@/components/icons"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { loadHistory, loadLoggedExerciseIds } from "@/lib/data"
import { formatKg, personalRecord, plateauInsight, toPoints, type SessionPoint } from "@/lib/stats"
import { formatDate, formatNumber } from "@/lib/i18n"
import { cn } from "@/lib/utils"

export default function ProgressPage() {
  return (
    <Suspense>
      <Progress />
    </Suspense>
  )
}

function Progress() {
  const { exercises, days, t, lang, planReady } = useApp()
  const router = useRouter()
  const params = useSearchParams()
  const reduce = useReducedMotion()
  const [logged, setLogged] = useState<Map<string, number> | null>(null)
  const [hist, setHist] = useState<{ id: string; points: SessionPoint[] } | null>(null)
  const [metric, setMetric] = useState<Metric>("kgreps")
  const [pickerOpen, setPickerOpen] = useState(false)

  useEffect(() => {
    loadLoggedExerciseIds()
      .then(setLogged)
      .catch(() => setLogged(new Map()))
  }, [])

  const inPlan = useMemo(() => {
    const m = new Map<string, string>()
    for (const d of [...days].sort((a, b) => a.weekday - b.weekday)) for (const it of d.items) if (!m.has(it.exercise_id)) m.set(it.exercise_id, d.label)
    return m
  }, [days])

  // plan exercises first (in plan order), then archived ones that have data
  const options = useMemo(() => {
    const planOrder = [...inPlan.keys()]
    const rest = exercises.filter((e) => !inPlan.has(e.id) && logged?.has(e.id)).map((e) => e.id)
    return [...planOrder, ...rest].map((id) => exercises.find((e) => e.id === id)).filter((e) => !!e)
  }, [exercises, inPlan, logged])

  const requested = params.get("ex")
  const selected =
    options.find((e) => e.id === requested) ?? options.find((e) => logged?.has(e.id)) ?? options[0] ?? null

  const selectedId = selected?.id ?? null
  useEffect(() => {
    if (!selectedId) return
    let alive = true
    loadHistory(selectedId)
      .then((h) => alive && setHist({ id: selectedId, points: toPoints(h) }))
      .catch(() => alive && setHist({ id: selectedId, points: [] }))
    return () => {
      alive = false
    }
  }, [selectedId])
  const points = hist && hist.id === selectedId ? hist.points : selectedId ? null : []

  const pr = points ? personalRecord(points) : null
  const insight = points ? plateauInsight(points) : null
  const bestE1rm = points?.length ? Math.max(...points.map((p) => p.e1rm)) : 0
  const firstE1rm = points?.[0]?.e1rm ?? 0
  const growth = firstE1rm ? Math.round(((bestE1rm - firstE1rm) / firstE1rm) * 100) : 0
  const recent = points ? [...points].slice(-5).reverse() : []

  if (!planReady || logged === null) return <p className="num text-sm text-muted-foreground">{t.loading}</p>

  return (
    <div className="flex flex-col gap-4">
      <div className="sticky-head flex flex-col gap-4">
      <h1 className="anim-rise font-wide text-[30px] font-black tracking-tight uppercase">{t.progressTitle}</h1>

      <button
        type="button"
        onClick={() => setPickerOpen(true)}
        className="anim-rise flex h-[52px] items-center justify-between rounded-2xl bg-card px-4 text-[17px] font-bold transition-transform active:scale-[.98]"
        style={{ "--i": 1 } as React.CSSProperties}
        aria-haspopup="dialog"
      >
        <span className="flex min-w-0 items-center gap-2.5">
          <span className="truncate">{selected?.name ?? t.chooseExercise}</span>
          {selected && (
            <span className="num shrink-0 text-[11px] font-medium text-muted-foreground uppercase">
              {inPlan.get(selected.id) ?? t.archived}
            </span>
          )}
        </span>
        <span className="text-muted-foreground">
          <ChevronDown />
        </span>
      </button>
      </div>

      <div role="tablist" aria-label={t.weight} className="anim-rise relative grid grid-cols-3 gap-1 rounded-2xl bg-card p-1" style={{ "--i": 2 } as React.CSSProperties}>
        {(
          [
            ["kgreps", t.metricKgReps],
            ["e1rm", t.metric1rm],
            ["volume", t.metricVolume],
          ] as const
        ).map(([m, label]) => (
          <button
            key={m}
            role="tab"
            type="button"
            aria-selected={metric === m}
            onClick={() => setMetric(m)}
            className={cn("relative h-9 rounded-xl text-xs font-bold transition-colors", metric === m ? "text-foreground" : "text-muted-foreground")}
          >
            {metric === m && (
              <motion.span
                layoutId="metric-rail"
                className="absolute inset-0 rounded-xl bg-secondary"
                transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 520, damping: 40 }}
                aria-hidden="true"
              />
            )}
            <span className="relative">{label}</span>
          </button>
        ))}
      </div>

      {points === null ? (
        <div className="h-[260px] rounded-3xl bg-card" aria-busy="true" />
      ) : points.length === 0 ? (
        <div className="flex flex-col gap-1 rounded-3xl bg-card p-5">
          <p className="font-semibold">{t.noData}</p>
          <p className="text-sm text-muted-foreground">{t.noDataHint}</p>
        </div>
      ) : (
        <>
          <figure className="anim-rise m-0 flex flex-col gap-2 rounded-3xl bg-card px-3 pt-[18px] pb-3" style={{ "--i": 3 } as React.CSSProperties}>
            <div className="flex items-end justify-between gap-2 px-1.5">
              <div className="flex flex-col gap-1">
                <span className="text-xs text-muted-foreground">{t.best}</span>
                <span className="font-narrow text-[40px] leading-none font-extrabold">
                  {formatKg(pr?.maxWeight)} kg <span className="text-2xl text-muted-foreground">× {pr?.repsAtMax}</span>
                </span>
              </div>
              {pr && (
                <span className="anim-wobble rounded-full bg-primary px-2.5 py-1.5 text-xs font-bold text-primary-foreground">
                  PR · {formatDate(pr.date, lang)}
                </span>
              )}
            </div>
            {metric === "kgreps" && (
              <div className="num flex gap-3.5 px-1.5 pt-1 text-[11px] text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <span className="h-[3px] w-3.5 rounded-sm bg-primary" />
                  {t.weight}
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-2.5 w-1.5 rounded-sm bg-foreground" />
                  {t.repetitions}
                </span>
              </div>
            )}
            <ProgressChart points={points} metric={metric} prWeight={pr?.maxWeight ?? 0} />
          </figure>

          <div className="anim-rise grid grid-cols-2 gap-2" style={{ "--i": 4 } as React.CSSProperties}>
            <div className="flex flex-col gap-1 rounded-[18px] bg-card px-4 py-3.5">
              <span className="text-xs text-muted-foreground">{t.est1rm}</span>
              <span className="font-narrow text-[28px] leading-none font-extrabold">{formatNumber(bestE1rm, lang)} kg</span>
              {growth !== 0 && (
                <span className={cn("num text-[11px]", growth > 0 ? "text-primary" : "text-muted-foreground")}>
                  {growth > 0 ? "▲ +" : "▼ "}
                  {growth} % {t.since} {formatDate(points[0].date, lang, { month: "short" })}
                </span>
              )}
            </div>
            <div className="flex flex-col gap-1 rounded-[18px] bg-card px-4 py-3.5">
              <span className="text-xs text-muted-foreground">{t.sessions}</span>
              <span className="font-narrow text-[28px] leading-none font-extrabold">{points.length}</span>
              <span className="num text-[11px] text-muted-foreground">
                {t.since} {formatDate(points[0].date, lang)}
              </span>
            </div>
          </div>

          {insight && (
            <div className="anim-rise flex items-start gap-3 rounded-[18px] bg-card px-4 py-3.5" style={{ "--i": 5 } as React.CSSProperties}>
              <span className="flex size-8 shrink-0 items-center justify-center rounded-[10px] bg-primary text-primary-foreground">
                <TrendIcon />
              </span>
              <p className="text-sm leading-snug text-text-2">
                <strong className="text-foreground">{insight.bestReps > insight.firstReps ? t.plateauTitle : t.plateauTitleFlat}</strong>{" "}
                {t.plateauText(formatKg(insight.weight), formatDate(insight.since, lang, { day: "numeric", month: "long" }), insight.firstReps, insight.bestReps)}
              </p>
            </div>
          )}

          <section className="anim-rise flex flex-col gap-2" style={{ "--i": 6 } as React.CSSProperties}>
            <h2 className="num text-[11px] tracking-[.06em] text-muted-foreground uppercase">{t.recent}</h2>
            <ul className="flex flex-col overflow-hidden rounded-[18px] bg-card">
              {recent.map((p, i) => {
                const prev = points[points.length - 1 - i - 1]
                const up = prev && (p.maxWeight > prev.maxWeight || (p.maxWeight === prev.maxWeight && p.repsAtMax > prev.repsAtMax))
                return (
                  <li key={p.date} className="flex h-12 items-center gap-3 border-b border-border px-4 last:border-0">
                    <span className="num w-[84px] shrink-0 text-[13px] whitespace-nowrap text-muted-foreground">{formatDate(p.date, lang)}</span>
                    <span className="num flex-1 text-[13px]">
                      {formatKg(p.maxWeight)} kg × {p.repsAtMax}
                    </span>
                    {up && (
                      <span className="text-primary" aria-label="▲">
                        ▲
                      </span>
                    )}
                  </li>
                )
              })}
            </ul>
          </section>
        </>
      )}

      <Sheet open={pickerOpen} onOpenChange={setPickerOpen}>
        <SheetContent side="bottom" className="gap-0">
          <SheetHeader className="px-5 pt-5">
            <SheetTitle className="text-xl font-extrabold">{t.chooseExercise}</SheetTitle>
            <SheetDescription className="sr-only">{t.chooseExercise}</SheetDescription>
          </SheetHeader>
          <ul className="flex flex-col gap-1.5 px-5 pb-6">
            {options.map((e) => (
              <li key={e.id}>
                <button
                  type="button"
                  onClick={() => {
                    router.replace(`/progress?ex=${e.id}`, { scroll: false })
                    setPickerOpen(false)
                  }}
                  aria-current={e.id === selected?.id}
                  className={cn(
                    "flex min-h-12 w-full items-center justify-between gap-3 rounded-xl px-4 text-left text-[15px] font-semibold transition-transform active:scale-[.98]",
                    e.id === selected?.id ? "bg-primary text-primary-foreground" : "bg-background",
                  )}
                >
                  <span className="truncate">{e.name}</span>
                  <span className={cn("num shrink-0 text-[11px] uppercase", e.id === selected?.id ? "opacity-70" : "text-muted-foreground")}>
                    {inPlan.get(e.id) ?? t.archived}
                    {logged.get(e.id) ? ` · ${logged.get(e.id)}` : ""}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </SheetContent>
      </Sheet>
    </div>
  )
}

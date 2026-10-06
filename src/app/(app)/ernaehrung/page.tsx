"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { AnimatePresence, motion, useReducedMotion } from "motion/react"
import { toast } from "sonner"
import { useApp } from "@/components/app-provider"
import { ProgressRing } from "@/components/ring"
import { ChevronDown, ChevronRight, StarIcon } from "@/components/icons"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { todayStr } from "@/lib/data"
import { formatDate, type Dict } from "@/lib/i18n"
import {
  ADJUST_STEP,
  addAdjustment,
  adjustmentsOf,
  baseKcal,
  canSeeNutrition,
  carbsFor,
  currentKcal,
  daysBetween,
  loadNutrition,
  macrosOf,
  phaseState,
  timeline,
  todayView,
  type Macros,
  type NutritionAdjustment,
  type NutritionData,
  type NutritionPhase,
} from "@/lib/nutrition"
import type { Lang } from "@/lib/types"
import { cn } from "@/lib/utils"

type CSS = React.CSSProperties

// ───────── helpers ─────────

function phaseName(p: NutritionPhase, t: Dict, lang: Lang) {
  return lang === "en" ? (t.nutPhaseNames[p.key] ?? p.name) : p.name
}
function phaseGoal(p: NutritionPhase, t: Dict, lang: Lang) {
  return lang === "en" ? (t.nutPhaseGoals[p.key] ?? p.goal_text) : p.goal_text
}
/** "0 · Cut abschliessen" – Nummer nur für Hauptphasen */
function phaseLabel(data: NutritionData, p: NutritionPhase, t: Dict, lang: Lang) {
  const main = data.phases.filter((x) => !x.is_tracking_paused)
  const i = main.findIndex((x) => x.id === p.id)
  return i >= 0 ? `${i} · ${phaseName(p, t, lang)}` : phaseName(p, t, lang)
}
const signed = (n: number) => (n > 0 ? `+${n}` : n < 0 ? `−${Math.abs(n)}` : "±0")
const short = (d: string, lang: Lang) => formatDate(d, lang, { day: "numeric", month: "short" })
const long = (d: string, lang: Lang) => formatDate(d, lang, { day: "numeric", month: "short", year: "numeric" })

function vibrate() {
  try {
    navigator.vibrate?.(10)
  } catch {}
}

// ───────── page ─────────

export default function NutritionPage() {
  const { t } = useApp()
  const router = useRouter()
  const [allowed, setAllowed] = useState<boolean | null>(null)
  const [data, setData] = useState<NutritionData | null>(null)
  const [failed, setFailed] = useState(false)

  // Berechtigung kommt aus der Datenbank – bei false zurück zum Training
  useEffect(() => {
    let alive = true
    canSeeNutrition()
      .then((ok) => alive && setAllowed(ok))
      .catch(() => alive && setAllowed(false))
    return () => {
      alive = false
    }
  }, [])
  useEffect(() => {
    if (allowed === false) router.replace("/training")
  }, [allowed, router])

  useEffect(() => {
    if (!allowed) return
    let alive = true
    loadNutrition()
      .then((d) => alive && setData(d))
      .catch(() => alive && setFailed(true))
    return () => {
      alive = false
    }
  }, [allowed])

  if (allowed !== true || (!data && !failed)) {
    return (
      <p className="num text-sm text-muted-foreground" role="status">
        {t.loading}
      </p>
    )
  }
  if (!data) {
    return (
      <div className="flex flex-col gap-3 rounded-3xl bg-card p-5">
        <p className="font-semibold">{t.error}</p>
        <Button variant="secondary" onClick={() => window.location.reload()}>
          {t.retry}
        </Button>
      </div>
    )
  }
  return <Nutrition data={data} onAdded={(a) => setData((d) => (d ? { ...d, adjustments: [a, ...d.adjustments] } : d))} />
}

function Nutrition({ data, onAdded }: { data: NutritionData; onAdded: (a: NutritionAdjustment) => void }) {
  const { t } = useApp()
  const today = todayStr()
  const view = useMemo(() => todayView(data, today), [data, today])
  const [adjustDelta, setAdjustDelta] = useState<number | null>(null)
  const [detail, setDetail] = useState<NutritionPhase | null>(null)
  const [busy, setBusy] = useState(false)

  const phase = view.phase
  const kcalNow = phase ? currentKcal(data, phase) : null

  async function save(delta: number, note: string) {
    if (!phase || kcalNow == null) return
    setBusy(true)
    try {
      const a = await addAdjustment({ phaseId: phase.id, delta, newKcal: kcalNow + delta, note })
      onAdded(a)
      vibrate()
      toast.success(delta === 0 ? t.nutCheckSaved : t.nutAdjustSaved(a.new_kcal))
      setAdjustDelta(null)
    } catch (e) {
      toast.error(t.error, { description: e instanceof Error ? e.message : String(e) })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="sticky-head">
        <h1 className="anim-rise font-wide text-[30px] font-black tracking-tight uppercase">{t.nutTitle}</h1>
      </div>

      <TodayCard data={data} view={view} busy={busy} onAdjust={setAdjustDelta} onCheck={() => save(0, "")} />

      {phase && !view.overlay && <History data={data} phase={phase} />}

      <Timeline data={data} today={today} onOpen={setDetail} />

      <Rules />

      <p className="anim-rise px-1 text-xs text-muted-foreground" style={{ "--i": 6 } as CSS}>
        {t.nutAllKcalFoodvisor}
      </p>

      <AdjustSheet
        open={adjustDelta !== null}
        delta={adjustDelta ?? 0}
        phase={phase}
        kcal={kcalNow}
        busy={busy}
        onClose={() => setAdjustDelta(null)}
        onSave={(note) => adjustDelta !== null && save(adjustDelta, note)}
      />
      <PhaseSheet data={data} phase={detail} today={today} onClose={() => setDetail(null)} />
    </div>
  )
}

// ───────── Heute ─────────

function TodayCard({
  data,
  view,
  busy,
  onAdjust,
  onCheck,
}: {
  data: NutritionData
  view: ReturnType<typeof todayView>
  busy: boolean
  onAdjust: (delta: number) => void
  onCheck: () => void
}) {
  const { t, lang } = useApp()
  const reduce = useReducedMotion()
  const { phase, overlay, next } = view

  if (!phase) {
    return (
      <section className="anim-rise anim-glow flex flex-col gap-2 rounded-3xl bg-surface-hi p-5" style={{ "--i": 1 } as CSS}>
        <span className="num text-[11px] font-medium text-muted-foreground uppercase">{next ? t.nutNext : t.nutPlanDone}</span>
        <p className="text-2xl font-extrabold">{next ? phaseLabel(data, next, t, lang) : t.nutPlanDoneHint}</p>
        {next && <p className="text-sm text-muted-foreground">{t.nutStartsOn(long(next.start_date, lang))}</p>}
      </section>
    )
  }

  const macros = macrosOf(data, phase)
  const progress = view.totalDays ? view.dayOf / view.totalDays : 0
  const daysLeft = view.totalDays - view.dayOf
  const goal = overlay ? null : phaseGoal(phase, t, lang)

  return (
    <section
      aria-label={t.nutToday}
      className="anim-rise anim-glow flex flex-col gap-4 rounded-3xl bg-surface-hi p-5"
      style={{ "--i": 1 } as CSS}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="num text-[11px] font-medium text-muted-foreground uppercase">{t.nutToday}</span>
          <span className="truncate text-[17px] font-bold">{phaseLabel(data, phase, t, lang)}</span>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-0.5">
          <span className="num text-[13px] font-semibold">{t.nutDayOf(view.dayOf, view.totalDays)}</span>
          <span className="num text-[11px] text-muted-foreground">{t.nutDaysLeft(daysLeft)}</span>
        </div>
      </div>

      <div className="h-1.5 overflow-hidden rounded-full bg-border" aria-hidden="true">
        <motion.div
          className="h-full origin-left rounded-full bg-primary"
          initial={reduce ? false : { scaleX: 0 }}
          animate={{ scaleX: progress }}
          transition={{ type: "spring", stiffness: 90, damping: 20, delay: 0.15 }}
        />
      </div>

      {overlay ? (
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-[color-mix(in_srgb,var(--primary)_14%,transparent)] px-2.5 py-1 text-xs font-semibold text-primary">
              {phaseName(overlay, t, lang)}
            </span>
            <span className="num text-xs text-muted-foreground">
              {short(overlay.start_date, lang)} – {short(overlay.end_date, lang)}
            </span>
          </div>
          <p className="font-narrow text-[40px] leading-[.95] font-extrabold">{t.nutNoTracking}</p>
          <div className="flex items-center gap-4">
            <ProgressRing
              done={1}
              total={1}
              size={64}
              label={`${t.nutProtein} ${overlay.protein_g} g`}
              center={<span className="text-[13px]">{overlay.protein_g}g</span>}
            />
            <p className="text-sm text-text-2">{t.nutNoTrackingHint(overlay.protein_g)}</p>
          </div>
        </div>
      ) : (
        macros && (
          <>
            <div className="flex items-end justify-between gap-3">
              <div className="flex flex-col gap-1">
                <span className="text-xs text-muted-foreground">{t.nutKcalGoal}</span>
                <AnimatedKcal value={macros.kcal} />
              </div>
            </div>
            <MacroRings macros={macros} />
          </>
        )
      )}

      {goal && (
        <p className="flex items-start gap-2 text-[13px] text-text-2">
          <span className="mt-0.5 text-primary">
            <StarIcon />
          </span>
          <span>
            <span className="text-muted-foreground">{t.nutGoal}: </span>
            {goal}
          </span>
        </p>
      )}

      <AnimatePresence initial={false}>
        {view.checkDue && (
          <motion.div
            key="check"
            initial={reduce ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.25, ease: [0.2, 0.8, 0.2, 1] }}
            className="flex flex-col gap-3 rounded-[18px] bg-[color-mix(in_srgb,var(--primary)_10%,transparent)] p-4 shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--primary)_35%,transparent)]"
            role="status"
          >
            <div className="flex flex-col gap-1">
              <p className="font-bold text-primary">{t.nutCheckDue}</p>
              <p className="text-[13px] text-text-2">{t.nutCheckDueHint(view.daysSinceCheck)}</p>
            </div>
            <Button variant="secondary" disabled={busy} onClick={onCheck}>
              {t.nutChecked}
            </Button>
          </motion.div>
        )}
      </AnimatePresence>

      {!overlay && macros && (
        <div className="flex items-center gap-2">
          <span className="flex-1 text-[13px] font-semibold text-muted-foreground">{t.nutAdjust}</span>
          {[-ADJUST_STEP, ADJUST_STEP].map((d) => (
            <Button
              key={d}
              variant="secondary"
              className="num h-11 min-w-[84px] text-[15px]"
              disabled={busy}
              onClick={() => onAdjust(d)}
              aria-label={t.nutAdjustBy(`${signed(d)} kcal`)}
            >
              {signed(d)}
            </Button>
          ))}
        </div>
      )}
    </section>
  )
}

/** Zahl zählt kurz hoch/runter, wenn sich das Ziel ändert */
function AnimatedKcal({ value }: { value: number }) {
  const reduce = useReducedMotion()
  return (
    <span className="flex items-baseline gap-2">
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={value}
          initial={reduce ? false : { opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          exit={reduce ? { opacity: 0 } : { opacity: 0, y: -14 }}
          transition={{ duration: 0.3, ease: [0.2, 0.8, 0.2, 1] }}
          className="num font-narrow text-[64px] leading-[.9] font-extrabold tracking-tight"
        >
          {value}
        </motion.span>
      </AnimatePresence>
      <span className="text-xl font-bold text-muted-foreground">kcal</span>
    </span>
  )
}

function MacroRings({ macros }: { macros: Macros }) {
  const { t } = useApp()
  const items = [
    { label: t.nutProtein, g: macros.protein, kcal: macros.protein * 4 },
    { label: t.nutFat, g: macros.fat, kcal: macros.fat * 9 },
    { label: t.nutCarbs, g: macros.carbs, kcal: macros.carbs * 4 },
  ]
  return (
    <div className="grid grid-cols-3 gap-2">
      {items.map((m, i) => {
        const pct = macros.kcal ? Math.round((m.kcal / macros.kcal) * 100) : 0
        return (
          <div key={m.label} className="flex flex-col items-center gap-1.5 rounded-[18px] bg-background px-2 py-3">
            <ProgressRing
              done={m.kcal}
              total={macros.kcal}
              size={64}
              delay={0.1 + i * 0.08}
              label={t.nutShareOfKcal(m.label, pct)}
              center={
                <motion.span key={m.g} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-[13px]">
                  {m.g}g
                </motion.span>
              }
            />
            <span className="text-xs font-semibold">{m.label}</span>
            <span className="num text-[11px] text-muted-foreground">{pct} %</span>
          </div>
        )
      })}
    </div>
  )
}

// ───────── Verlauf ─────────

function History({ data, phase }: { data: NutritionData; phase: NutritionPhase }) {
  const { t, lang } = useApp()
  const list = adjustmentsOf(data, phase.id)
  return (
    <section className="anim-rise flex flex-col gap-2" style={{ "--i": 2 } as CSS} aria-labelledby="nut-history">
      <h2 id="nut-history" className="px-1 text-[13px] font-semibold text-muted-foreground">
        {t.nutHistory}
      </h2>
      {list.length === 0 ? (
        <p className="rounded-2xl bg-card px-4 py-3.5 text-sm text-muted-foreground">{t.nutNoAdjustments}</p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          <AnimatePresence initial={false}>
            {list.map((a) => (
              <motion.li
                key={a.id}
                layout="position"
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.28, ease: [0.2, 0.8, 0.2, 1] }}
              >
                <AdjustmentRow a={a} lang={lang} t={t} />
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
      )}
    </section>
  )
}

function AdjustmentRow({ a, lang, t }: { a: NutritionAdjustment; lang: Lang; t: Dict }) {
  const check = a.delta_kcal === 0
  return (
    <div className="flex items-center gap-3 rounded-2xl bg-card px-4 py-3">
      <span
        className={cn(
          "num flex h-8 min-w-14 shrink-0 items-center justify-center rounded-[10px] px-2 text-[13px] font-semibold",
          check ? "bg-secondary text-text-2" : "bg-[color-mix(in_srgb,var(--primary)_14%,transparent)] text-primary",
        )}
      >
        {check ? t.nutCheckedShort : signed(a.delta_kcal)}
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="num text-[15px] font-semibold">{a.new_kcal} kcal</span>
        {a.note && <span className="truncate text-xs text-muted-foreground">{a.note}</span>}
      </span>
      <span className="num shrink-0 text-xs text-muted-foreground">{short(a.date, lang)}</span>
    </div>
  )
}

// ───────── Zeitstrahl ─────────

function Timeline({ data, today, onOpen }: { data: NutritionData; today: string; onOpen: (p: NutritionPhase) => void }) {
  const { t, lang } = useApp()
  const rows = timeline(data)
  return (
    <section className="anim-rise flex flex-col gap-2" style={{ "--i": 3 } as CSS} aria-labelledby="nut-timeline">
      <h2 id="nut-timeline" className="px-1 text-[13px] font-semibold text-muted-foreground">
        {t.nutTimeline}
      </h2>
      <ol className="flex flex-col">
        {rows.map(({ phase: p, overlay }, i) => {
          const state = phaseState(p, today)
          const kcal = currentKcal(data, p)
          const last = i === rows.length - 1
          return (
            <li key={p.id} className="relative flex gap-3">
              {/* Schiene */}
              <div className={cn("relative flex w-5 shrink-0 justify-center", overlay && "ml-4")} aria-hidden="true">
                {!last && <span className={cn("absolute top-6 -bottom-0 w-[2px] rounded-full", state === "past" ? "bg-primary/40" : "bg-border")} />}
                <span
                  className={cn(
                    "relative mt-[18px] rounded-full",
                    overlay ? "size-2.5" : "size-3.5",
                    state === "current" ? "bg-primary" : state === "past" ? "bg-primary/40" : "border-2 border-line-2 bg-background",
                  )}
                >
                  {state === "current" && <span className="anim-ping absolute inset-0 rounded-full bg-primary" />}
                </span>
              </div>
              <button
                type="button"
                onClick={() => onOpen(p)}
                aria-haspopup="dialog"
                className={cn(
                  "mb-2 flex min-h-14 min-w-0 flex-1 items-center gap-3 rounded-2xl px-4 py-3 text-left transition-[transform,opacity] duration-150 active:scale-[.98]",
                  state === "current" ? "bg-surface-hi shadow-[inset_0_0_0_1.5px_var(--primary)]" : "bg-card",
                  state === "past" && "opacity-45",
                  overlay && "py-2.5",
                )}
              >
                <span className="flex min-w-0 flex-1 flex-col gap-1">
                  <span className={cn("truncate font-bold", overlay ? "text-sm" : "text-[15px]")}>
                    {phaseLabel(data, p, t, lang)}
                    {state === "past" && <span className="sr-only"> ({t.nutDone})</span>}
                  </span>
                  <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    {state === "current" && (
                      <span className="rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold text-primary-foreground uppercase">{t.nutCurrent}</span>
                    )}
                    <span className="num text-xs whitespace-nowrap text-muted-foreground">
                      {short(p.start_date, lang)} – {long(p.end_date, lang)}
                    </span>
                  </span>
                </span>
                <span className="num flex shrink-0 flex-col items-end leading-tight">
                  {kcal != null ? (
                    <>
                      <span className="text-[15px] font-semibold">{kcal}</span>
                      <span className="text-[11px] text-muted-foreground">kcal</span>
                    </>
                  ) : (
                    <span className="max-w-[72px] text-right text-[11px] text-muted-foreground">{t.nutNotTracked}</span>
                  )}
                </span>
                <span className="shrink-0 text-muted-foreground">
                  <ChevronRight />
                </span>
              </button>
            </li>
          )
        })}
      </ol>
    </section>
  )
}

function PhaseSheet({ data, phase, today, onClose }: { data: NutritionData; phase: NutritionPhase | null; today: string; onClose: () => void }) {
  const { t, lang } = useApp()
  // letzten Inhalt behalten, damit das Sheet beim Schliessen nicht leer wird
  const [shown, setShown] = useState<NutritionPhase | null>(phase)
  if (phase && phase !== shown) setShown(phase)
  const p = phase ?? shown
  const macros = p ? macrosOf(data, p) : null
  const base = p ? baseKcal(data, p) : null
  const list = p ? adjustmentsOf(data, p.id) : []
  const state = p ? phaseState(p, today) : null

  return (
    <Sheet open={!!phase} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="bottom" className="gap-0">
        {p && (
          <>
            <SheetHeader className="px-5 pt-5">
              <SheetTitle className="text-xl font-extrabold">{phaseLabel(data, p, t, lang)}</SheetTitle>
              <SheetDescription>{phaseGoal(p, t, lang)}</SheetDescription>
            </SheetHeader>
            <div className="flex max-h-[65dvh] flex-col gap-4 overflow-y-auto px-5 pb-6">
              <dl className="grid grid-cols-2 gap-2">
                <Stat label={t.nutPeriod} value={`${long(p.start_date, lang)} – ${long(p.end_date, lang)}`} wide />
                <Stat label={t.nutDuration} value={t.nutDays(daysBetween(p.start_date, p.end_date) + 1)} wide />
                {p.is_tracking_paused ? (
                  <Stat label={t.nutProtein} value={`~${p.protein_g} g`} wide />
                ) : (
                  <>
                    <Stat label={t.nutStartKcal} value={base != null ? `${base} kcal` : "–"} />
                    <Stat label={t.nutNowKcal} value={macros ? `${macros.kcal} kcal` : "–"} accent={state === "current"} />
                  </>
                )}
              </dl>
              {p.is_tracking_paused && <p className="text-sm text-text-2">{t.nutNoTrackingHint(p.protein_g)}</p>}
              {p.key === "cut" && <p className="text-[13px] text-muted-foreground">{t.nutCutCalc}</p>}
              {macros && (
                <div className="flex flex-col gap-2">
                  <h3 className="text-[13px] font-semibold text-muted-foreground">{t.nutMacros}</h3>
                  <MacroRings macros={macros} />
                </div>
              )}
              {!p.is_tracking_paused && (
                <div className="flex flex-col gap-2">
                  <h3 className="text-[13px] font-semibold text-muted-foreground">{t.nutHistory}</h3>
                  {list.length === 0 ? (
                    <p className="text-sm text-muted-foreground">{t.nutNoAdjustments}</p>
                  ) : (
                    <ul className="flex flex-col gap-1.5">
                      {list.map((a) => (
                        <li key={a.id}>
                          <AdjustmentRow a={a} lang={lang} t={t} />
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}

function Stat({ label, value, accent, wide }: { label: string; value: string; accent?: boolean; wide?: boolean }) {
  return (
    <div className={cn("flex flex-col gap-1 rounded-2xl bg-background px-3.5 py-3", wide && "col-span-2")}>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className={cn("num text-[15px] font-semibold", accent && "text-primary")}>{value}</dd>
    </div>
  )
}

// ───────── Anpassen ─────────

function AdjustSheet({
  open,
  delta,
  phase,
  kcal,
  busy,
  onClose,
  onSave,
}: {
  open: boolean
  delta: number
  phase: NutritionPhase | null
  kcal: number | null
  busy: boolean
  onClose: () => void
  onSave: (note: string) => void
}) {
  const { t } = useApp()
  const [note, setNote] = useState("")
  const [last, setLast] = useState({ delta, kcal })
  if (open && (delta !== last.delta || kcal !== last.kcal)) setLast({ delta, kcal })
  const d = open ? delta : last.delta
  const k = (open ? kcal : last.kcal) ?? 0
  const fat = phase?.fat_g ?? 0
  const protein = phase?.protein_g ?? 0
  const carbsBefore = carbsFor(k, protein, fat)
  const carbsAfter = carbsFor(k + d, protein, fat)

  return (
    <Sheet
      open={open}
      onOpenChange={(o) => {
        if (!o) {
          onClose()
          setNote("")
        }
      }}
    >
      <SheetContent side="bottom" className="gap-0">
        <SheetHeader className="px-5 pt-5">
          <SheetTitle className="text-xl font-extrabold">{t.nutAdjustTitle(signed(d))}</SheetTitle>
          <SheetDescription>{t.nutAdjustIntro}</SheetDescription>
        </SheetHeader>
        <form
          className="flex flex-col gap-4 px-5 pb-6"
          onSubmit={(e) => {
            e.preventDefault()
            onSave(note)
            setNote("")
          }}
        >
          <div className="grid grid-cols-2 gap-2">
            <div className="flex flex-col gap-1 rounded-2xl bg-background px-3.5 py-3">
              <span className="text-xs text-muted-foreground">{t.nutKcalGoal}</span>
              <span className="num text-[15px] font-semibold">
                <span className="text-muted-foreground">{k} → </span>
                <span className="text-primary">{k + d}</span>
              </span>
            </div>
            <div className="flex flex-col gap-1 rounded-2xl bg-background px-3.5 py-3">
              <span className="text-xs text-muted-foreground">{t.nutCarbs}</span>
              <span className="num text-[15px] font-semibold">
                <span className="text-muted-foreground">{carbsBefore} → </span>
                <span className="text-primary">{carbsAfter} g</span>
              </span>
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="adj-note">{t.nutNote}</Label>
            <Input
              id="adj-note"
              name="note"
              autoComplete="off"
              value={note}
              maxLength={200}
              onChange={(e) => setNote(e.target.value)}
              placeholder={t.nutNotePlaceholder}
            />
          </div>
          <Button type="submit" size="lg" disabled={busy}>
            {busy ? t.loading : t.nutSaveAdjust}
          </Button>
        </form>
      </SheetContent>
    </Sheet>
  )
}

// ───────── Regeln ─────────

function Rules() {
  const { t } = useApp()
  const reduce = useReducedMotion()
  const [open, setOpen] = useState(false)
  return (
    <section className="anim-rise rounded-[20px] bg-card" style={{ "--i": 4 } as CSS}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-controls="nut-rules"
        className="flex min-h-14 w-full items-center justify-between gap-3 px-4 py-3.5 text-left"
      >
        <span className="text-base font-bold">{t.nutRules}</span>
        <motion.span
          className="text-muted-foreground"
          animate={{ rotate: open ? 180 : 0 }}
          transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 400, damping: 30 }}
        >
          <ChevronDown />
        </motion.span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            id="nut-rules"
            key="rules"
            initial={reduce ? false : { height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={reduce ? { opacity: 0 } : { height: 0, opacity: 0 }}
            transition={{ height: { duration: 0.24, ease: [0.2, 0.8, 0.2, 1] }, opacity: { duration: 0.16 } }}
            className="overflow-hidden"
          >
            <div className="flex flex-col gap-4 px-4 pb-4">
              {t.nutRulesList.map((g) => (
                <div key={g.title} className="flex flex-col gap-1.5">
                  <h3 className="text-[13px] font-semibold text-primary">{g.title}</h3>
                  <ul className="flex flex-col gap-1">
                    {g.items.map((it) => (
                      <li key={it} className="flex gap-2 text-sm text-text-2">
                        <span className="mt-[7px] size-1.5 shrink-0 rounded-full bg-line-2" aria-hidden="true" />
                        <span>{it}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  )
}

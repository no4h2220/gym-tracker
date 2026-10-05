"use client"

import { useMemo, useState } from "react"
import { motion, useReducedMotion } from "motion/react"
import { toast } from "sonner"
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  DragOverlay,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core"
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable"
import { restrictToVerticalAxis } from "@dnd-kit/modifiers"
import { CSS } from "@dnd-kit/utilities"
import { useApp } from "@/components/app-provider"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import {
  addDay,
  addPlanItem,
  createExercise,
  createPlan,
  deleteDay,
  deletePlan,
  duplicatePlan,
  isoWeekday,
  removePlanItem,
  renamePlan,
  reorderPlanItems,
  updateDay,
  updateExercise,
  updatePlanItem,
} from "@/lib/data"
import type { Exercise, PlanDay, PlanItem } from "@/lib/types"
import { cn } from "@/lib/utils"

function GripIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <circle cx="9" cy="6" r="1.6" /><circle cx="15" cy="6" r="1.6" />
      <circle cx="9" cy="12" r="1.6" /><circle cx="15" cy="12" r="1.6" />
      <circle cx="9" cy="18" r="1.6" /><circle cx="15" cy="18" r="1.6" />
    </svg>
  )
}

function PlusIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
      <path d="M12 5v14M5 12h14" />
    </svg>
  )
}

export default function PlanPage() {
  const { plans, activePlan, exercises, setPlans, setExercises, setActivePlan, reloadPlan, t, planReady } = useApp()
  const reduce = useReducedMotion()
  const [planId, setPlanId] = useState<string | null>(null)
  const plan = plans.find((p) => p.id === planId) ?? activePlan ?? plans[0] ?? null
  const sorted = useMemo(() => [...(plan?.days ?? [])].sort((a, b) => a.weekday - b.weekday), [plan])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const day = sorted.find((d) => d.id === selectedId) ?? sorted.find((d) => d.weekday === isoWeekday()) ?? sorted[0] ?? null
  const exById = useMemo(() => new Map(exercises.map((e) => [e.id, e])), [exercises])

  const [editItem, setEditItem] = useState<PlanItem | null>(null)
  const [addOpen, setAddOpen] = useState(false)
  const [dayEdit, setDayEdit] = useState<PlanDay | "new" | null>(null)
  const [plansOpen, setPlansOpen] = useState(false)
  const [dragId, setDragId] = useState<string | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 3 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  function patchDay(dayId: string, fn: (d: PlanDay) => PlanDay) {
    setPlans((ps) => ps.map((p) => ({ ...p, days: p.days.map((d) => (d.id === dayId ? fn(d) : d)) })))
  }

  async function onDragEnd(e: DragEndEvent) {
    setDragId(null)
    if (!day || !e.over || e.active.id === e.over.id) return
    const oldIdx = day.items.findIndex((i) => i.id === e.active.id)
    const newIdx = day.items.findIndex((i) => i.id === e.over!.id)
    const items = arrayMove(day.items, oldIdx, newIdx).map((it, i) => ({ ...it, position: i + 1 }))
    patchDay(day.id, (d) => ({ ...d, items }))
    navigator.vibrate?.(10)
    try {
      await reorderPlanItems(day.id, items.map((i) => i.id))
    } catch {
      toast.error(t.error)
      reloadPlan()
    }
  }

  const dragItem = day?.items.find((i) => i.id === dragId) ?? null
  const isActive = !!plan && plan.id === activePlan?.id

  if (!planReady) return <p className="num text-sm text-muted-foreground">{t.loading}</p>

  return (
    <div className="flex flex-col gap-5">
      <h1 className="anim-rise font-wide text-[30px] font-black tracking-tight uppercase">{t.planTitle}</h1>

      <button
        type="button"
        onClick={() => setPlansOpen(true)}
        aria-haspopup="dialog"
        className="anim-rise -mt-1 flex h-[52px] items-center justify-between gap-3 rounded-2xl bg-card px-4 text-left transition-transform active:scale-[.98]"
        style={{ "--i": 1 } as React.CSSProperties}
      >
        <span className="flex min-w-0 items-center gap-2.5">
          <span className="truncate text-[17px] font-bold">{plan?.name ?? t.newPlan}</span>
          {isActive && <span className="num shrink-0 rounded-md bg-primary px-1.5 py-0.5 text-[10px] font-semibold text-primary-foreground uppercase">{t.activePlan}</span>}
        </span>
        <span className="num shrink-0 text-xs text-muted-foreground">
          {plans.length > 1 ? t.plansCount(plans.length) : t.morePlans}
        </span>
      </button>

      {plan && !isActive && (
        <Button variant="secondary" onClick={() => setActivePlan(plan.id)} className="-mt-2">
          {t.useThisPlan}
        </Button>
      )}

      {plan && (
        <nav aria-label={t.weekday} className="anim-rise -mx-5 flex gap-2 overflow-x-auto px-5 pb-1" style={{ "--i": 2 } as React.CSSProperties}>
          {sorted.map((d) => {
            const on = day?.id === d.id
            return (
              <button
                key={d.id}
                type="button"
                aria-pressed={on}
                onClick={() => setSelectedId(d.id)}
                className={cn(
                  "relative flex h-14 shrink-0 flex-col items-start justify-center rounded-2xl px-4 text-left transition-colors duration-200",
                  on ? "text-primary-foreground" : "bg-card text-foreground",
                )}
              >
                {on && (
                  <motion.span
                    layoutId="plan-day-rail"
                    className="absolute inset-0 rounded-2xl bg-primary"
                    transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 520, damping: 40 }}
                    aria-hidden="true"
                  />
                )}
                <span className={cn("num relative text-[11px]", on ? "opacity-70" : "text-muted-foreground")}>{t.weekdaysShort[d.weekday - 1]}</span>
                <span className="relative text-sm font-bold">{d.label}</span>
              </button>
            )
          })}
          {sorted.length < 7 && (
            <button
              type="button"
              onClick={() => setDayEdit("new")}
              aria-label={t.addDay}
              className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-dashed border-line-2 text-muted-foreground"
            >
              <PlusIcon />
            </button>
          )}
        </nav>
      )}

      {day && (
        <>
          <div className="anim-rise flex items-end justify-between gap-3" style={{ "--i": 3 } as React.CSSProperties}>
            <div className="min-w-0">
              <h2 className="truncate text-2xl font-extrabold">{day.label}</h2>
              {day.focus && <p className="truncate text-sm text-muted-foreground">{day.focus}</p>}
            </div>
            <Button variant="secondary" size="sm" onClick={() => setDayEdit(day)}>
              {t.editDay}
            </Button>
          </div>

          <p className="text-xs text-muted-foreground">{t.dragHint}</p>

          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            modifiers={[restrictToVerticalAxis]}
            onDragStart={(e) => {
              setDragId(String(e.active.id))
              navigator.vibrate?.(8)
            }}
            onDragOver={() => navigator.vibrate?.(4)}
            onDragCancel={() => setDragId(null)}
            onDragEnd={onDragEnd}
          >
            <SortableContext items={day.items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
              <ul className="flex flex-col gap-2">
                {day.items.map((it, idx) => (
                  <SortableRow key={it.id} item={it} index={idx} exercise={exById.get(it.exercise_id)} onOpen={() => setEditItem(it)} />
                ))}
              </ul>
            </SortableContext>
            <DragOverlay dropAnimation={reduce ? null : { duration: 220, easing: "cubic-bezier(.2,.8,.2,1)" }}>
              {dragItem ? <RowCard item={dragItem} exercise={exById.get(dragItem.exercise_id)} lifted /> : null}
            </DragOverlay>
          </DndContext>

          <Button variant="outline" size="lg" className="border-dashed border-line-2 bg-transparent" onClick={() => setAddOpen(true)}>
            <PlusIcon />
            {t.addExercise}
          </Button>
        </>
      )}

      <ItemSheet
        item={editItem}
        exercise={editItem ? exById.get(editItem.exercise_id) : undefined}
        onClose={() => setEditItem(null)}
        onSaved={(it, ex) => {
          patchDay(it.day_id, (d) => ({ ...d, items: d.items.map((x) => (x.id === it.id ? it : x)) }))
          setExercises((es) => es.map((e) => (e.id === ex.id ? ex : e)))
        }}
        onRemoved={(it) => patchDay(it.day_id, (d) => ({ ...d, items: d.items.filter((x) => x.id !== it.id) }))}
      />

      {day && (
        <AddSheet
          open={addOpen}
          onClose={() => setAddOpen(false)}
          day={day}
          exercises={exercises}
          onAdded={(it, ex) => {
            setExercises((es) => (es.some((e) => e.id === ex.id) ? es.map((e) => (e.id === ex.id ? ex : e)) : [...es, ex].sort((a, b) => a.name.localeCompare(b.name))))
            patchDay(day.id, (d) => ({ ...d, items: [...d.items, it] }))
          }}
        />
      )}

      {plan && (
        <DaySheet
          value={dayEdit}
          planId={plan.id}
          usedWeekdays={sorted.map((d) => d.weekday)}
          onClose={() => setDayEdit(null)}
          onChanged={async (selectId) => {
            await reloadPlan()
            if (selectId !== undefined) setSelectedId(selectId)
          }}
        />
      )}

      <PlansSheet
        open={plansOpen}
        onClose={() => setPlansOpen(false)}
        current={plan?.id ?? null}
        onPick={(id) => {
          setPlanId(id)
          setSelectedId(null)
        }}
      />
    </div>
  )
}

function RowCard({ item, exercise, lifted, handle }: { item: PlanItem; exercise?: Exercise; lifted?: boolean; handle?: React.ReactNode }) {
  const name = exercise?.name ?? "?"
  return (
    <div
      className={cn(
        "flex items-center gap-1 rounded-2xl bg-card pr-1",
        lifted && "scale-[1.03] bg-surface-hi shadow-[0_18px_40px_rgba(0,0,0,.6),0_0_0_1.5px_var(--primary)]",
      )}
    >
      {handle ?? (
        <span className="flex size-12 shrink-0 items-center justify-center text-primary" aria-hidden="true">
          <GripIcon />
        </span>
      )}
      <span className="flex min-h-14 min-w-0 flex-1 items-center justify-between gap-3 py-3 pr-3">
        <span className="min-w-0 truncate text-[15px] font-semibold">{name}</span>
        <span className="num shrink-0 text-xs text-muted-foreground">
          {item.sets} × {item.reps_min}–{item.reps_max}
        </span>
      </span>
    </div>
  )
}

function SortableRow({ item, index, exercise, onOpen }: { item: PlanItem; index: number; exercise?: Exercise; onOpen: () => void }) {
  const { t } = useApp()
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: item.id })
  const name = exercise?.name ?? "?"
  return (
    // the entrance animation sits on an inner element: a CSS animation on the sortable
    // element itself would override dnd-kit's transform and freeze the other rows
    <li ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }} className="relative">
      <div className="anim-rise" style={{ "--i": index + 4 } as React.CSSProperties}>
        {isDragging ? (
          // drop target: where the exercise will land
          <div className="flex min-h-14 items-center rounded-2xl border-[1.5px] border-dashed border-primary bg-[color-mix(in_srgb,var(--primary)_8%,transparent)] px-4" aria-hidden="true">
            <span className="truncate text-[15px] font-semibold text-primary/70">{name}</span>
          </div>
        ) : (
          <div className="flex items-center gap-1 rounded-2xl bg-card pr-1">
            <button
              ref={setActivatorNodeRef}
              type="button"
              {...attributes}
              {...listeners}
              aria-label={t.dragHandle(name)}
              className="flex size-12 shrink-0 cursor-grab touch-none items-center justify-center text-muted-foreground active:cursor-grabbing"
            >
              <GripIcon />
            </button>
            <button type="button" onClick={onOpen} className="flex min-h-14 min-w-0 flex-1 items-center justify-between gap-3 py-3 pr-3 text-left">
              <span className="min-w-0 truncate text-[15px] font-semibold">{name}</span>
              <span className="num shrink-0 text-xs text-muted-foreground">
                {item.sets} × {item.reps_min}–{item.reps_max}
              </span>
            </button>
          </div>
        )}
      </div>
    </li>
  )
}

function PlansSheet({ open, onClose, current, onPick }: { open: boolean; onClose: () => void; current: string | null; onPick: (id: string) => void }) {
  const { plans, activePlan, setActivePlan, reloadPlan, t } = useApp()
  const [mode, setMode] = useState<"list" | "new" | "rename">("list")
  const [name, setName] = useState("")
  const [copy, setCopy] = useState(true)
  const [busy, setBusy] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const cur = plans.find((p) => p.id === current) ?? null

  function reset() {
    setMode("list")
    setName("")
    setCopy(true)
    setConfirmDelete(false)
  }

  async function run(fn: () => Promise<void>) {
    setBusy(true)
    try {
      await fn()
    } catch {
      toast.error(t.error)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Sheet
      open={open}
      onOpenChange={(o) => {
        if (!o) {
          reset()
          onClose()
        }
      }}
    >
      <SheetContent side="bottom" className="gap-0">
        <SheetHeader className="px-5 pt-5">
          <SheetTitle className="text-xl font-extrabold">{mode === "new" ? t.newPlan : mode === "rename" ? t.renamePlan : t.plans}</SheetTitle>
          <SheetDescription className="sr-only">{t.plans}</SheetDescription>
        </SheetHeader>

        {mode === "list" && (
          <div className="flex flex-col gap-3 px-5 pb-6">
            <ul className="flex flex-col gap-1.5">
              {plans.map((p) => {
                const on = p.id === current
                return (
                  <li key={p.id}>
                    <button
                      type="button"
                      onClick={() => {
                        onPick(p.id)
                        reset()
                        onClose()
                      }}
                      aria-current={on}
                      className={cn(
                        "flex min-h-14 w-full items-center justify-between gap-3 rounded-xl px-4 text-left transition-transform active:scale-[.98]",
                        on ? "bg-surface-hi shadow-[inset_0_0_0_1.5px_var(--primary)]" : "bg-background",
                      )}
                    >
                      <span className="flex min-w-0 flex-col">
                        <span className="truncate text-[15px] font-semibold">{p.name}</span>
                        <span className="num text-[11px] text-muted-foreground">{p.days.map((d) => t.weekdaysShort[d.weekday - 1]).join(" · ") || "–"}</span>
                      </span>
                      {p.id === activePlan?.id && (
                        <span className="num shrink-0 rounded-md bg-primary px-1.5 py-0.5 text-[10px] font-semibold text-primary-foreground uppercase">{t.activePlan}</span>
                      )}
                    </button>
                  </li>
                )
              })}
            </ul>
            <Button size="lg" onClick={() => setMode("new")}>
              <PlusIcon />
              {t.newPlan}
            </Button>
            {cur && (
              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant="secondary"
                  onClick={() => {
                    setName(cur.name)
                    setMode("rename")
                  }}
                >
                  {t.renamePlan}
                </Button>
                <Button
                  variant="ghost"
                  className="text-destructive"
                  disabled={busy || plans.length < 2}
                  onClick={() => {
                    if (!confirmDelete) return setConfirmDelete(true)
                    run(async () => {
                      const next = plans.find((p) => p.id !== cur.id)!
                      if (cur.id === activePlan?.id) setActivePlan(next.id)
                      await deletePlan(cur.id)
                      await reloadPlan()
                      onPick(next.id)
                      reset()
                      onClose()
                    })
                  }}
                >
                  {confirmDelete ? `${t.deletePlan}?` : t.deletePlan}
                </Button>
              </div>
            )}
            {confirmDelete && (
              <p className="text-sm text-muted-foreground" role="alert">
                {t.deletePlanConfirm}
              </p>
            )}
          </div>
        )}

        {mode !== "list" && (
          <form
            className="flex flex-col gap-4 px-5 pb-6"
            onSubmit={(e) => {
              e.preventDefault()
              const n = name.trim()
              if (!n) return
              run(async () => {
                if (mode === "rename" && cur) {
                  await renamePlan(cur.id, n)
                  await reloadPlan()
                } else {
                  const id = copy && cur ? await duplicatePlan(cur.id, n) : await createPlan(n)
                  await reloadPlan()
                  onPick(id)
                }
                reset()
                onClose()
              })
            }}
          >
            <div className="flex flex-col gap-2">
              <Label htmlFor="plan-name">{t.planName}</Label>
              <Input id="plan-name" value={name} maxLength={40} placeholder="Push / Pull / Legs…" onChange={(e) => setName(e.target.value)} />
            </div>
            {mode === "new" && cur && (
              <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label={t.newPlan}>
                {[
                  [true, t.copyOf(cur.name)],
                  [false, t.emptyPlan],
                ].map(([v, label]) => (
                  <button
                    key={String(v)}
                    type="button"
                    role="radio"
                    aria-checked={copy === v}
                    onClick={() => setCopy(v as boolean)}
                    className={cn(
                      "min-h-12 rounded-xl px-3 text-sm font-semibold transition-colors",
                      copy === v ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground",
                    )}
                  >
                    {label as string}
                  </button>
                ))}
              </div>
            )}
            <Button type="submit" size="lg" disabled={busy || !name.trim()}>
              {t.save}
            </Button>
            <Button type="button" variant="ghost" onClick={reset}>
              {t.cancel}
            </Button>
          </form>
        )}
      </SheetContent>
    </Sheet>
  )
}

/**
 * Number input that lets you clear the field and type freely.
 * Only digits are accepted; the value is clamped when the field loses focus
 * (an empty field falls back to `fallback`, or stays empty when `optional`).
 */
function NumberField({
  id,
  label,
  value,
  onChange,
  min = 0,
  max = 999,
  optional = false,
  fallback,
}: {
  id: string
  label: string
  value: number | null
  onChange: (v: number | null) => void
  min?: number
  max?: number
  optional?: boolean
  fallback?: number
}) {
  const [text, setText] = useState<string | null>(null)
  const shown = text ?? (value === null ? "" : String(value))
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        inputMode="numeric"
        pattern="[0-9]*"
        enterKeyHint="done"
        autoComplete="off"
        className="num"
        value={shown}
        onFocus={(e) => e.currentTarget.select()}
        onChange={(e) => {
          const v = e.target.value.replace(/\D/g, "").slice(0, 4)
          setText(v)
          if (v !== "") onChange(Number(v))
        }}
        onBlur={() => {
          const v = text ?? shown
          if (v === "") onChange(optional ? null : (fallback ?? min))
          else onChange(Math.min(max, Math.max(min, Number(v))))
          setText(null)
        }}
      />
    </div>
  )
}

function ItemSheet({
  item,
  exercise,
  onClose,
  onSaved,
  onRemoved,
}: {
  item: PlanItem | null
  exercise?: Exercise
  onClose: () => void
  onSaved: (it: PlanItem, ex: Exercise) => void
  onRemoved: (it: PlanItem) => void
}) {
  const { t } = useApp()
  const [draft, setDraft] = useState<{ it: PlanItem; name: string; notes: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const cur = draft && item && draft.it.id === item.id ? draft : item && exercise ? { it: item, name: exercise.name, notes: exercise.notes ?? "" } : null

  function set(p: Partial<PlanItem>) {
    if (cur) setDraft({ ...cur, it: { ...cur.it, ...p } })
  }

  async function save() {
    if (!cur || !exercise) return
    setBusy(true)
    try {
      const clamp = (v: number | null, lo: number, hi: number, d: number) => (v === null || !Number.isFinite(v) ? d : Math.min(hi, Math.max(lo, Math.round(v))))
      const sets = clamp(cur.it.sets, 1, 10, 2)
      const repsMin = clamp(cur.it.reps_min, 1, 100, 8)
      const repsMax = Math.max(repsMin, clamp(cur.it.reps_max, 1, 100, repsMin))
      const restMax = cur.it.rest_max_seconds === null ? null : clamp(cur.it.rest_max_seconds, 0, 900, 0)
      const it = { ...cur.it, sets, reps_min: repsMin, reps_max: repsMax, rest_seconds: clamp(cur.it.rest_seconds, 0, 900, 90), rest_max_seconds: restMax }
      const name = cur.name.trim().replace(/\s+/g, " ") || exercise.name
      await updatePlanItem(it.id, {
        sets: it.sets,
        reps_min: it.reps_min,
        reps_max: it.reps_max,
        rest_seconds: it.rest_seconds,
        rest_max_seconds: it.rest_max_seconds,
      })
      const notes = cur.notes.trim() || null
      if (name !== exercise.name || notes !== exercise.notes) await updateExercise(exercise.id, { name, notes })
      onSaved(it, { ...exercise, name, notes })
      toast.success(t.saved)
      setDraft(null)
      onClose()
    } catch {
      toast.error(t.error)
    } finally {
      setBusy(false)
    }
  }

  async function remove() {
    if (!item) return
    setBusy(true)
    try {
      await removePlanItem(item.id)
      onRemoved(item)
      setDraft(null)
      onClose()
    } catch {
      toast.error(t.error)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Sheet open={!!item} onOpenChange={(o) => !o && (setDraft(null), onClose())}>
      <SheetContent side="bottom" className="gap-0">
        <SheetHeader className="px-5 pt-5">
          <SheetTitle className="text-xl font-extrabold">{exercise?.name}</SheetTitle>
          <SheetDescription className="sr-only">{exercise?.name}</SheetDescription>
        </SheetHeader>
        {cur && (
          <div className="flex flex-col gap-4 px-5 pb-6">
            <div className="flex flex-col gap-2">
              <Label htmlFor="ex-name">{t.exerciseName}</Label>
              <Input id="ex-name" value={cur.name} maxLength={80} onChange={(e) => setDraft({ ...cur, name: e.target.value })} />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <NumberField id="sets" label={t.sets} value={cur.it.sets} min={1} max={10} fallback={item?.sets} onChange={(v) => set({ sets: v ?? 1 })} />
              <NumberField id="rmin" label={t.repsMin} value={cur.it.reps_min} min={1} max={100} fallback={item?.reps_min} onChange={(v) => set({ reps_min: v ?? 1 })} />
              <NumberField id="rmax" label={t.repsMax} value={cur.it.reps_max} min={1} max={100} fallback={item?.reps_max} onChange={(v) => set({ reps_max: v ?? 1 })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <NumberField id="rest" label={t.restSec} value={cur.it.rest_seconds} max={900} fallback={item?.rest_seconds} onChange={(v) => set({ rest_seconds: v ?? 0 })} />
              <NumberField id="restmax" label={`${t.restSec} max`} value={cur.it.rest_max_seconds} max={900} optional onChange={(v) => set({ rest_max_seconds: v })} />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="ex-notes">{t.notes}</Label>
              <textarea
                id="ex-notes"
                rows={2}
                maxLength={300}
                value={cur.notes}
                placeholder={t.notesPlaceholder}
                onChange={(e) => setDraft({ ...cur, notes: e.target.value })}
                className="rounded-xl border border-input bg-background px-4 py-3 text-base outline-none placeholder:text-muted-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50"
              />
            </div>
            <Button size="lg" onClick={save} disabled={busy}>
              {t.save}
            </Button>
            <Button variant="ghost" className="text-destructive" onClick={remove} disabled={busy}>
              {t.removeFromDay}
            </Button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}

function AddSheet({
  open,
  onClose,
  day,
  exercises,
  onAdded,
}: {
  open: boolean
  onClose: () => void
  day: PlanDay
  exercises: Exercise[]
  onAdded: (it: PlanItem, ex: Exercise) => void
}) {
  const { t } = useApp()
  const [name, setName] = useState("")
  const [busy, setBusy] = useState(false)
  const inDay = new Set(day.items.map((i) => i.exercise_id))
  const q = name.trim().toLowerCase()
  const candidates = exercises.filter((e) => !inDay.has(e.id) && (!q || e.name.toLowerCase().includes(q)))

  async function add(ex: Exercise | null) {
    setBusy(true)
    try {
      const e = ex ? (ex.archived ? await createExercise(ex.name) : ex) : await createExercise(name)
      const pos = (day.items.at(-1)?.position ?? 0) + 1
      const it = await addPlanItem(day.id, e.id, pos)
      onAdded(it, { ...e, archived: false })
      setName("")
      onClose()
    } catch {
      toast.error(t.error)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="bottom" className="gap-0">
        <SheetHeader className="px-5 pt-5">
          <SheetTitle className="text-xl font-extrabold">{t.addExercise}</SheetTitle>
          <SheetDescription className="sr-only">{t.addExercise}</SheetDescription>
        </SheetHeader>
        <form
          className="flex flex-col gap-4 px-5 pb-6"
          onSubmit={(e) => {
            e.preventDefault()
            if (name.trim()) add(candidates.find((c) => c.name.toLowerCase() === q) ?? null)
          }}
        >
          <div className="flex gap-2">
            <Input aria-label={t.newExercise} placeholder={`${t.newExercise}…`} value={name} maxLength={80} onChange={(e) => setName(e.target.value)} />
            <Button type="submit" size="icon-lg" disabled={!name.trim() || busy} aria-label={t.addExercise}>
              <PlusIcon />
            </Button>
          </div>
          {candidates.length > 0 && (
            <div className="flex flex-col gap-2">
              <span className="num text-[11px] tracking-[.06em] text-muted-foreground uppercase">{t.existingExercises}</span>
              <ul className="flex max-h-[40dvh] flex-col gap-1.5 overflow-y-auto overscroll-contain">
                {candidates.map((e) => (
                  <li key={e.id}>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => add(e)}
                      className="flex min-h-12 w-full items-center justify-between rounded-xl bg-background px-4 text-left text-[15px] font-semibold transition-transform active:scale-[.98]"
                    >
                      <span className="truncate">{e.name}</span>
                      {e.archived && <span className="num shrink-0 text-[11px] text-muted-foreground">{t.archived}</span>}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </form>
      </SheetContent>
    </Sheet>
  )
}

function DaySheet({
  value,
  planId,
  usedWeekdays,
  onClose,
  onChanged,
}: {
  value: PlanDay | "new" | null
  planId: string
  usedWeekdays: number[]
  onClose: () => void
  onChanged: (selectId?: string | null) => Promise<void>
}) {
  const { t } = useApp()
  const isNew = value === "new"
  const base = value && value !== "new" ? value : null
  const free = [1, 2, 3, 4, 5, 6, 7].filter((w) => !usedWeekdays.includes(w) || w === base?.weekday)
  const [draft, setDraft] = useState<{ key: string; label: string; focus: string; weekday: number } | null>(null)
  const k = isNew ? "new" : (base?.id ?? "")
  const cur = draft && draft.key === k ? draft : { key: k, label: base?.label ?? "", focus: base?.focus ?? "", weekday: base?.weekday ?? free[0] ?? 1 }
  const [busy, setBusy] = useState(false)
  const [confirm, setConfirm] = useState(false)

  async function save() {
    const label = cur.label.trim()
    if (!label) return
    setBusy(true)
    try {
      if (isNew) await addDay(planId, cur.weekday, label, cur.focus.trim() || null)
      else if (base) await updateDay(base.id, { label, focus: cur.focus.trim() || null, weekday: cur.weekday })
      await onChanged()
      setDraft(null)
      onClose()
    } catch {
      toast.error(t.error)
    } finally {
      setBusy(false)
    }
  }

  async function remove() {
    if (!base) return
    if (!confirm) return setConfirm(true)
    setBusy(true)
    try {
      await deleteDay(base.id)
      await onChanged(null)
      setConfirm(false)
      onClose()
    } catch {
      toast.error(t.error)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Sheet
      open={!!value}
      onOpenChange={(o) => {
        if (!o) {
          setDraft(null)
          setConfirm(false)
          onClose()
        }
      }}
    >
      <SheetContent side="bottom" className="gap-0">
        <SheetHeader className="px-5 pt-5">
          <SheetTitle className="text-xl font-extrabold">{isNew ? t.addDay : t.editDay}</SheetTitle>
          <SheetDescription className="sr-only">{isNew ? t.addDay : t.editDay}</SheetDescription>
        </SheetHeader>
        <form
          className="flex flex-col gap-4 px-5 pb-6"
          onSubmit={(e) => {
            e.preventDefault()
            save()
          }}
        >
          <div className="flex flex-col gap-2">
            <Label htmlFor="day-label">{t.dayName}</Label>
            <Input id="day-label" value={cur.label} maxLength={40} placeholder="Push…" onChange={(e) => setDraft({ ...cur, label: e.target.value })} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="day-focus">{t.dayFocus}</Label>
            <Input id="day-focus" value={cur.focus} maxLength={80} placeholder="Brust · Schultern…" onChange={(e) => setDraft({ ...cur, focus: e.target.value })} />
          </div>
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-2 text-sm font-medium">{t.weekday}</legend>
            <div className="grid grid-cols-7 gap-1.5">
              {[1, 2, 3, 4, 5, 6, 7].map((w) => {
                const allowed = free.includes(w)
                const on = cur.weekday === w
                return (
                  <button
                    key={w}
                    type="button"
                    disabled={!allowed}
                    aria-pressed={on}
                    onClick={() => setDraft({ ...cur, weekday: w })}
                    className={cn(
                      "h-11 rounded-xl text-xs font-bold transition-colors disabled:opacity-30",
                      on ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground",
                    )}
                  >
                    {t.weekdaysShort[w - 1]}
                  </button>
                )
              })}
            </div>
          </fieldset>
          <Button type="submit" size="lg" disabled={busy || !cur.label.trim()}>
            {t.save}
          </Button>
          {base && (
            <div className="flex flex-col gap-2">
              {confirm && (
                <p className="text-sm text-muted-foreground" role="alert">
                  {t.deleteDayConfirm}
                </p>
              )}
              <Button type="button" variant="ghost" className="text-destructive" onClick={remove} disabled={busy}>
                {confirm ? `${t.deleteDay}?` : t.deleteDay}
              </Button>
            </div>
          )}
        </form>
      </SheetContent>
    </Sheet>
  )
}

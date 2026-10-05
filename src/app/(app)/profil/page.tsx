"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { motion, useReducedMotion } from "motion/react"
import { toast } from "sonner"
import { useApp } from "@/components/app-provider"
import { CheckIcon, ChevronRight } from "@/components/icons"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { ACCENTS } from "@/lib/accent"
import { countSessions, exportCsv, importLegacy, todayStr } from "@/lib/data"
import { LegacyParseError, parseLegacyExport, type ImportPreview } from "@/lib/legacy"
import { formatDate } from "@/lib/i18n"
import { supabase } from "@/lib/supabase"
import { cn } from "@/lib/utils"

export default function ProfilPage() {
  const { profile, session, t, lang, setLang, setAccent, setDisplayName } = useApp()
  const reduce = useReducedMotion()
  const [stats, setStats] = useState<{ count: number; first: string | null } | null>(null)
  const [importOpen, setImportOpen] = useState(false)
  const [nameDraft, setNameDraft] = useState<string | null>(null)
  const accent = profile?.accent ?? "volt"
  const accentName = ACCENTS.find((a) => a.id === accent)?.[lang] ?? ""
  const name = profile?.display_name || session?.user.email?.split("@")[0] || "?"

  useEffect(() => {
    countSessions().then(setStats).catch(() => {})
  }, [importOpen])

  async function doExport() {
    try {
      const csv = await exportCsv()
      const file = new File([csv], `gym-tracker-${todayStr()}.csv`, { type: "text/csv" })
      if (navigator.canShare?.({ files: [file] })) {
        try {
          await navigator.share({ files: [file], title: "Gym Tracker" })
          return
        } catch (e) {
          if ((e as Error).name === "AbortError") return
        }
      }
      const url = URL.createObjectURL(file)
      const a = document.createElement("a")
      a.href = url
      a.download = file.name
      a.click()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
    } catch {
      toast.error(t.error)
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <h1 className="anim-rise font-wide text-[30px] font-black tracking-tight uppercase">{t.profileTitle}</h1>

      <div className="anim-rise flex items-center gap-3.5" style={{ "--i": 1 } as React.CSSProperties}>
        <span className="font-wide flex size-14 shrink-0 items-center justify-center rounded-[18px] bg-primary text-2xl font-black text-primary-foreground uppercase transition-colors duration-300">
          {name.slice(0, 1)}
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <Label htmlFor="display-name" className="sr-only">
            {t.displayName}
          </Label>
          <input
            id="display-name"
            value={nameDraft ?? name}
            maxLength={40}
            onChange={(e) => setNameDraft(e.target.value)}
            onBlur={() => {
              if (nameDraft !== null && nameDraft.trim() !== name) setDisplayName(nameDraft).catch(() => toast.error(t.error))
              setNameDraft(null)
            }}
            onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
            className="min-w-0 truncate bg-transparent text-xl font-bold outline-none"
          />
          <span className="num text-xs text-muted-foreground">
            {stats ? t.workouts(stats.count) : " "}
            {stats?.first ? ` · ${t.since} ${formatDate(stats.first, lang, { month: "long", year: "numeric" })}` : ""}
          </span>
        </div>
      </div>

      <section className="anim-rise flex flex-col gap-3.5 rounded-[20px] bg-card p-4" style={{ "--i": 2 } as React.CSSProperties}>
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold">{t.accent}</h2>
          <span className="num text-xs text-primary transition-colors duration-300">{accentName}</span>
        </div>
        <div role="radiogroup" aria-label={t.accent} className="grid grid-cols-6 gap-2">
          {ACCENTS.map((a) => {
            const on = a.id === accent
            return (
              <button
                key={a.id}
                type="button"
                role="radio"
                aria-checked={on}
                aria-label={a[lang]}
                onClick={() => {
                  setAccent(a.id)
                  navigator.vibrate?.(8)
                }}
                className="relative flex h-12 items-center justify-center rounded-[14px] bg-background"
                style={{ boxShadow: on ? `inset 0 0 0 2px ${a.hex}` : "inset 0 0 0 1px var(--border)" }}
              >
                <motion.span
                  className="flex size-[26px] items-center justify-center rounded-full text-[#0F100E]"
                  style={{ background: a.hex }}
                  animate={{ scale: on ? 1.08 : 1 }}
                  transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 500, damping: 18 }}
                >
                  {on && <CheckIcon size={14} stroke={3.5} draw />}
                </motion.span>
              </button>
            )
          })}
        </div>
        <div className="flex flex-col gap-2 rounded-[14px] bg-background p-3">
          <span className="num text-[10px] tracking-[.06em] text-muted-foreground uppercase">{t.preview}</span>
          <div className="flex items-center gap-2.5">
            <span className="flex h-11 flex-1 items-center justify-center rounded-xl bg-primary text-sm font-extrabold text-primary-foreground transition-colors duration-300">
              {t.saveSet}
            </span>
            <span className="flex size-11 items-center justify-center rounded-full bg-primary text-primary-foreground transition-colors duration-300">
              <CheckIcon size={18} />
            </span>
          </div>
          <svg width="100%" height="40" viewBox="0 0 310 40" preserveAspectRatio="none" aria-hidden="true">
            <polyline
              points="0,34 40,30 80,22 120,24 160,12 200,14 240,8 310,6"
              fill="none"
              stroke="var(--primary)"
              strokeWidth="3"
              strokeLinejoin="round"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
          </svg>
        </div>
      </section>

      <section className="anim-rise flex flex-col overflow-hidden rounded-[20px] bg-card" style={{ "--i": 3 } as React.CSSProperties}>
        <div className="flex min-h-14 items-center gap-3 border-b border-border px-4">
          <span className="flex-1 text-[15px]">{t.language}</span>
          <div className="flex gap-1 rounded-xl bg-background p-1" role="radiogroup" aria-label={t.language}>
            {(["de", "en"] as const).map((l) => (
              <button
                key={l}
                type="button"
                role="radio"
                aria-checked={lang === l}
                onClick={() => setLang(l)}
                className={cn("num h-9 min-w-11 rounded-lg px-3 text-xs uppercase transition-colors", lang === l ? "bg-secondary text-foreground" : "text-muted-foreground")}
              >
                {l}
              </button>
            ))}
          </div>
        </div>
        <button type="button" onClick={() => setImportOpen(true)} className="flex min-h-14 items-center gap-3 border-b border-border px-4 text-left">
          <span className="flex-1 text-[15px]">{t.importOld}</span>
          <span className="text-muted-foreground">
            <ChevronRight />
          </span>
        </button>
        <button type="button" onClick={doExport} className="flex min-h-14 items-center gap-3 border-b border-border px-4 text-left">
          <span className="flex-1 text-[15px]">{t.exportCsv}</span>
          <span className="text-muted-foreground">
            <ChevronRight />
          </span>
        </button>
        <button type="button" onClick={() => supabase().auth.signOut()} className="flex min-h-14 items-center px-4 text-left text-[15px] text-destructive">
          {t.logout}
        </button>
      </section>

      <ImportSheet open={importOpen} onOpenChange={setImportOpen} />
    </div>
  )
}

function ImportSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { t, lang, days, exercises, reloadPlan } = useApp()
  const fileRef = useRef<HTMLInputElement>(null)
  const [preview, setPreview] = useState<ImportPreview | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState(0)

  const planNames = useMemo(() => {
    const ids = new Set(days.flatMap((d) => d.items.map((i) => i.exercise_id)))
    return exercises.filter((e) => ids.has(e.id)).map((e) => e.name)
  }, [days, exercises])

  async function onFile(f: File | undefined) {
    setError(null)
    setPreview(null)
    if (!f) return
    try {
      const raw = JSON.parse(await f.text())
      setPreview(parseLegacyExport(raw, planNames))
    } catch (e) {
      setError(e instanceof LegacyParseError || e instanceof SyntaxError ? t.importError : t.error)
    }
  }

  async function run() {
    if (!preview) return
    setBusy(true)
    setProgress(0)
    try {
      const chunk = 60
      let done = 0
      for (let i = 0; i < preview.sessions.length; i += chunk) {
        const part = preview.sessions.slice(i, i + chunk)
        await importLegacy(part)
        done += part.length
        setProgress(done / preview.sessions.length)
      }
      await reloadPlan()
      toast.success(t.importDone(preview.sessions.length))
      setPreview(null)
      onOpenChange(false)
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
        if (busy) return
        if (!o) {
          setPreview(null)
          setError(null)
        }
        onOpenChange(o)
      }}
    >
      <SheetContent side="bottom" className="gap-0">
        <SheetHeader className="px-5 pt-5">
          <SheetTitle className="text-xl font-extrabold">{t.importTitle}</SheetTitle>
          <SheetDescription>{t.importIntro}</SheetDescription>
        </SheetHeader>
        <div className="flex flex-col gap-4 px-5 pb-6">
          <input ref={fileRef} type="file" accept="application/json,.json" className="sr-only" onChange={(e) => onFile(e.target.files?.[0])} tabIndex={-1} aria-hidden="true" />
          <Button variant={preview ? "secondary" : "default"} size="lg" onClick={() => fileRef.current?.click()} disabled={busy}>
            {t.chooseFile}
          </Button>
          <div aria-live="polite">{error && <p className="text-sm text-destructive">{error}</p>}</div>

          {preview && (
            <div className="flex flex-col gap-3">
              <p className="num text-sm">
                {t.importFound(
                  preview.entryCount,
                  preview.setCount,
                  preview.firstDate ? formatDate(preview.firstDate, lang) : "–",
                  preview.lastDate ? formatDate(preview.lastDate, lang) : "–",
                )}
              </p>
              {preview.mergedDuplicates > 0 && <p className="text-xs text-muted-foreground">{t.importMerged(preview.mergedDuplicates)}</p>}
              <ul className="flex max-h-[38dvh] flex-col gap-1.5 overflow-y-auto overscroll-contain">
                {preview.exercises.map((e) => (
                  <li key={e.name} className="flex items-center gap-3 rounded-xl bg-background px-3.5 py-2.5">
                    <span
                      className={cn(
                        "flex size-6 shrink-0 items-center justify-center rounded-md",
                        e.inPlan ? "bg-primary text-primary-foreground" : "border-[1.5px] border-line-2",
                      )}
                      aria-hidden="true"
                    >
                      {e.inPlan && <CheckIcon size={12} />}
                    </span>
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate text-sm font-semibold">{e.name}</span>
                      <span className="text-[11px] text-muted-foreground">
                        {e.inPlan ? t.importInPlan : t.importArchived}
                        {e.variants.length > 1 || (e.variants[0] && e.variants[0] !== e.name) ? ` · „${e.variants.join("“, „")}“` : ""}
                      </span>
                    </span>
                    <span className="num shrink-0 text-xs text-muted-foreground">{e.count}×</span>
                  </li>
                ))}
              </ul>
              <p className="text-xs text-muted-foreground">{t.importAgain}</p>
              <Button size="lg" onClick={run} disabled={busy} className="relative overflow-hidden">
                <span
                  className="absolute inset-0 origin-left bg-black/15 transition-transform duration-300"
                  style={{ transform: `scaleX(${progress})` }}
                  aria-hidden="true"
                />
                <span className="relative">{busy ? t.importing : t.importStart}</span>
              </Button>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}

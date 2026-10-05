"use client"

import { useEffect, useId, useMemo, useRef, useState } from "react"
import type { SessionPoint } from "@/lib/stats"
import { formatKg } from "@/lib/stats"
import { formatDate, formatNumber } from "@/lib/i18n"
import type { Lang } from "@/lib/types"
import { useApp } from "./app-provider"

export type Metric = "kgreps" | "e1rm" | "volume"

function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  const [w, setW] = useState(326)
  useEffect(() => {
    if (!ref.current) return
    const ro = new ResizeObserver(([e]) => setW(Math.max(200, Math.round(e.contentRect.width))))
    ro.observe(ref.current)
    return () => ro.disconnect()
  }, [])
  return [ref, w] as const
}

function monthTicks(points: SessionPoint[], lang: Lang, max = 5) {
  const seen = new Map<string, number>()
  points.forEach((p, i) => {
    const m = p.date.slice(0, 7)
    if (!seen.has(m)) seen.set(m, i)
  })
  let ticks = [...seen.entries()].map(([m, i]) => ({ i, label: formatDate(m + "-15", lang, { month: "short" }).replace(".", "") }))
  if (ticks.length > max) {
    const step = Math.ceil(ticks.length / max)
    ticks = ticks.filter((_, k) => k % step === 0)
  }
  return ticks
}

export function ProgressChart({ points, metric, prWeight }: { points: SessionPoint[]; metric: Metric; prWeight: number }) {
  const { t, lang } = useApp()
  const [ref, W] = useWidth<HTMLDivElement>()
  const gid = useId().replace(/:/g, "")
  const [sel, setSel] = useState<number | null>(null)

  const H = 120
  const PAD_X = 8
  const BARS_H = 40
  const n = points.length
  const xs = useMemo(() => points.map((_, i) => (n === 1 ? W / 2 : PAD_X + (i * (W - PAD_X * 2)) / (n - 1))), [points, n, W])

  const series = points.map((p) => (metric === "kgreps" ? p.maxWeight : metric === "e1rm" ? p.e1rm : p.volume))
  const lo = Math.min(...series)
  const hi = Math.max(...series)
  const pad = (hi - lo) * 0.12 || hi * 0.1 || 1
  const yMin = metric === "volume" ? 0 : Math.max(0, lo - pad)
  const yMax = hi + pad * 0.5
  const y = (v: number) => 8 + (1 - (v - yMin) / (yMax - yMin || 1)) * (H - 16)

  const line = xs.map((x, i) => `${i ? "L" : "M"}${x.toFixed(1)},${y(series[i]).toFixed(1)}`).join(" ")
  const area = `${line} L${xs[n - 1]?.toFixed(1)},${H} L${xs[0]?.toFixed(1)},${H} Z`
  const maxReps = Math.max(1, ...points.map((p) => p.repsAtMax))
  const barW = Math.max(3, Math.min(10, ((W - PAD_X * 2) / Math.max(n, 1)) * 0.55))
  const ticks = monthTicks(points, lang).filter((tk, i, arr) => i === 0 || xs[tk.i] - xs[arr[i - 1].i] >= 34)
  const unit = metric === "volume" ? "kg" : "kg"
  const fmt = (v: number) => (metric === "kgreps" ? formatKg(v) : formatNumber(v, lang, metric === "volume" ? 0 : 1))

  function pick(clientX: number, el: Element) {
    const r = el.getBoundingClientRect()
    const x = ((clientX - r.left) / r.width) * W
    let best = 0
    xs.forEach((xi, i) => {
      if (Math.abs(xi - x) < Math.abs(xs[best] - x)) best = i
    })
    setSel(best)
  }

  const shown = sel ?? n - 1
  const sp = points[shown]
  const animKey = `${metric}-${n}-${points[0]?.date}-${points[n - 1]?.date}`

  return (
    <div ref={ref} className="flex w-full flex-col gap-2">
      <div className="num flex min-h-5 items-baseline justify-between gap-2 px-1.5 text-[11px] text-muted-foreground" aria-live="polite">
        <span>{sp ? formatDate(sp.date, lang, { day: "numeric", month: "short", year: "2-digit" }) : ""}</span>
        {sp && (
          <span className="text-foreground">
            {metric === "kgreps" && (
              <>
                {formatKg(sp.maxWeight)} kg × {sp.repsAtMax}
              </>
            )}
            {metric === "e1rm" && <>{formatNumber(sp.e1rm, lang)} kg</>}
            {metric === "volume" && <>{formatNumber(sp.volume, lang, 0)} kg</>}
          </span>
        )}
      </div>

      <svg
        key={animKey}
        width={W}
        height={metric === "kgreps" ? H + BARS_H + 6 : H}
        viewBox={`0 0 ${W} ${metric === "kgreps" ? H + BARS_H + 6 : H}`}
        role="img"
        aria-label={`${t.weight}: ${fmt(series[0] ?? 0)} → ${fmt(series[n - 1] ?? 0)} ${unit}`}
        className="touch-pan-y select-none"
        onPointerDown={(e) => pick(e.clientX, e.currentTarget)}
        onPointerMove={(e) => e.buttons && pick(e.clientX, e.currentTarget)}
      >
        <defs>
          <linearGradient id={`g${gid}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="var(--primary)" stopOpacity=".28" />
            <stop offset="1" stopColor="var(--primary)" stopOpacity="0" />
          </linearGradient>
        </defs>

        {metric !== "volume" ? (
          <>
            <path className="anim-fade-late" d={area} fill={`url(#g${gid})`} />
            <path
              className="anim-draw"
              d={line}
              pathLength={1}
              style={{ "--len": 1 } as React.CSSProperties}
              fill="none"
              stroke="var(--primary)"
              strokeWidth="3"
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          </>
        ) : (
          <g>
            {points.map((p, i) => {
              const top = y(p.volume)
              return (
                <rect
                  key={p.date}
                  className="anim-grow"
                  style={{ animationDelay: `${300 + i * 18}ms` }}
                  x={xs[i] - barW / 2}
                  y={top}
                  width={barW}
                  height={Math.max(2, H - top)}
                  rx={barW / 2}
                  fill={i === shown ? "var(--primary)" : "color-mix(in srgb, var(--primary) 45%, transparent)"}
                />
              )
            })}
          </g>
        )}

        {sel !== null && <line x1={xs[shown]} x2={xs[shown]} y1={0} y2={H} stroke="var(--line-2)" strokeDasharray="3 4" />}

        {metric !== "volume" && n > 0 && (
          <>
            <circle className="anim-ping" cx={xs[shown]} cy={y(series[shown])} r={5} fill="none" stroke="var(--primary)" strokeWidth={2} />
            <circle cx={xs[shown]} cy={y(series[shown])} r={5} fill="var(--background)" stroke="var(--primary)" strokeWidth={3} />
          </>
        )}

        {metric === "kgreps" && (
          <g transform={`translate(0 ${H + 6})`}>
            {points.map((p, i) => {
              const h = Math.max(3, (p.repsAtMax / maxReps) * (BARS_H - 4))
              const atTop = p.maxWeight === prWeight
              return (
                <rect
                  key={p.date}
                  className="anim-grow"
                  style={{ animationDelay: `${500 + i * 18}ms` }}
                  x={xs[i] - barW / 2}
                  y={BARS_H - h}
                  width={barW}
                  height={h}
                  rx={Math.min(3, barW / 2)}
                  fill={i === shown ? "var(--primary)" : atTop ? "var(--foreground)" : "var(--bar-dim)"}
                />
              )
            })}
          </g>
        )}
      </svg>

      <div className="relative h-4" aria-hidden="true">
        {ticks.map((tk) => (
          <span key={tk.i} className="num absolute -translate-x-1/2 text-[10px] text-muted-foreground uppercase" style={{ left: Math.min(Math.max(xs[tk.i], 14), W - 14) }}>
            {tk.label}
          </span>
        ))}
      </div>
    </div>
  )
}

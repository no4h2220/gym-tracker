"use client"

import { motion, useReducedMotion } from "motion/react"

export function ProgressRing({ done, total, label }: { done: number; total: number; label: string }) {
  const reduce = useReducedMotion()
  const r = 20
  const c = 2 * Math.PI * r
  const frac = total ? done / total : 0
  return (
    <div className="relative size-14 shrink-0" role="img" aria-label={label}>
      <svg width="56" height="56" viewBox="0 0 48 48" aria-hidden="true">
        <circle cx="24" cy="24" r={r} fill="none" stroke="var(--border)" strokeWidth="4" />
        <motion.circle
          cx="24"
          cy="24"
          r={r}
          fill="none"
          stroke="var(--primary)"
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: c * (1 - frac) }}
          transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 120, damping: 20 }}
          transform="rotate(-90 24 24)"
        />
      </svg>
      <span className="num absolute inset-0 flex items-center justify-center text-sm font-semibold">
        {done}/{total}
      </span>
    </div>
  )
}

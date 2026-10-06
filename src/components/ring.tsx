"use client"

import type { ReactNode } from "react"
import { motion, useReducedMotion } from "motion/react"

/**
 * Animated ring. Default: "done/total" in the middle (training progress).
 * Pass `center` to show something else (e.g. grams for a macro) and `size` for a bigger ring.
 */
export function ProgressRing({
  done,
  total,
  label,
  center,
  size = 56,
  delay = 0,
}: {
  done: number
  total: number
  label: string
  center?: ReactNode
  size?: number
  delay?: number
}) {
  const reduce = useReducedMotion()
  const r = 20
  const c = 2 * Math.PI * r
  const frac = total ? Math.min(1, Math.max(0, done / total)) : 0
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }} role="img" aria-label={label}>
      <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true">
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
          transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 120, damping: 20, delay }}
          transform="rotate(-90 24 24)"
        />
      </svg>
      <span className="num absolute inset-0 flex items-center justify-center text-sm font-semibold">
        {center ?? (
          <>
            {done}/{total}
          </>
        )}
      </span>
    </div>
  )
}

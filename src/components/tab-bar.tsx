"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { motion, useReducedMotion } from "motion/react"
import { useApp } from "./app-provider"
import { cn } from "@/lib/utils"

function IconTraining() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <path d="M6 7v10M18 7v10M3 10v4M21 10v4M6 12h12" />
    </svg>
  )
}
function IconPlan() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <path d="M9 6h11M9 12h11M9 18h11M4 6h.01M4 12h.01M4 18h.01" />
    </svg>
  )
}
function IconProgress() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 20h18M6 16l4-5 3 3 5-7" />
    </svg>
  )
}
function IconProfile() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6" />
    </svg>
  )
}

function IconNutrition() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 7c-1.5-1.3-4-1.6-5.6-.2C4.5 8.5 4.6 12 6 15c1.2 2.6 3 5 4.6 5 .6 0 .9-.4 1.4-.4s.8.4 1.4.4c1.6 0 3.4-2.4 4.6-5 1.4-3 1.5-6.5-.4-8.2C16 5.4 13.5 5.7 12 7Z" />
      <path d="M12 7c0-2 1-3.5 3-4" />
    </svg>
  )
}

// wenn die Berechtigungs-Antwort hängt (schlechtes Netz), die Leiste trotzdem zeigen
const ACCESS_WAIT_MS = 2500

export function TabBar() {
  const pathname = usePathname()
  const { t, nutritionAccess } = useApp()
  const reduce = useReducedMotion()
  const [waited, setWaited] = useState(false)
  useEffect(() => {
    const id = window.setTimeout(() => setWaited(true), ACCESS_WAIT_MS)
    return () => window.clearTimeout(id)
  }, [])
  // erst zeigen, wenn klar ist, ob der Ernährungs-Tab dazugehört – so springt nichts
  const ready = nutritionAccess !== null || waited

  const tabs = [
    { href: "/training", label: t.tabTraining, Icon: IconTraining },
    { href: "/plan", label: t.tabPlan, Icon: IconPlan },
    { href: "/progress", label: t.tabProgress, Icon: IconProgress },
    ...(nutritionAccess ? [{ href: "/ernaehrung", label: t.tabNutrition, Icon: IconNutrition }] : []),
    { href: "/profil", label: t.tabProfile, Icon: IconProfile },
  ]
  const five = tabs.length === 5

  return (
    <motion.nav
      aria-label="Hauptnavigation"
      className="tab-bar absolute inset-x-0 z-40 mx-auto flex max-w-[448px] px-4"
      initial={false}
      animate={ready ? { opacity: 1, y: 0 } : { opacity: 0, y: 12 }}
      transition={reduce ? { duration: 0 } : { duration: 0.32, ease: [0.2, 0.8, 0.2, 1] }}
      style={{ pointerEvents: ready ? undefined : "none" }}
    >
      <div
        className={cn(
          "relative grid h-16 w-full rounded-[22px] bg-surface-2 p-1.5 shadow-[0_12px_32px_rgba(0,0,0,.5),inset_0_0_0_1px_#2C2F29]",
          five ? "grid-cols-5" : "grid-cols-4",
        )}
      >
        {tabs.map(({ href, label, Icon }) => {
          const active = pathname === href || pathname.startsWith(href + "/")
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "relative flex min-w-0 flex-col items-center justify-center gap-1 rounded-2xl font-semibold transition-colors duration-200",
                five ? "text-[10px] tracking-[-0.01em]" : "text-[11px]",
                active ? "text-primary-foreground" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {active && (
                <motion.span
                  layoutId="tab-rail"
                  className="absolute inset-0 rounded-2xl bg-primary"
                  transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 520, damping: 40, mass: 0.9 }}
                  aria-hidden="true"
                />
              )}
              <span className="relative flex max-w-full flex-col items-center gap-1">
                <Icon />
                <span className="max-w-full truncate">{label}</span>
              </span>
            </Link>
          )
        })}
      </div>
    </motion.nav>
  )
}

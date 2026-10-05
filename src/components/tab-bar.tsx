"use client"

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

export function TabBar() {
  const pathname = usePathname()
  const { t } = useApp()
  const reduce = useReducedMotion()

  const tabs = [
    { href: "/training", label: t.tabTraining, Icon: IconTraining },
    { href: "/plan", label: t.tabPlan, Icon: IconPlan },
    { href: "/progress", label: t.tabProgress, Icon: IconProgress },
    { href: "/profil", label: t.tabProfile, Icon: IconProfile },
  ]

  return (
    <nav
      aria-label="Hauptnavigation"
      className="absolute inset-x-0 z-40 mx-auto flex max-w-[448px] px-4"
      style={{ bottom: "max(10px, calc(env(safe-area-inset-bottom) - 10px))" }}
    >
      <div className="relative grid h-16 w-full grid-cols-4 rounded-[22px] bg-surface-2 p-1.5 shadow-[0_12px_32px_rgba(0,0,0,.5),inset_0_0_0_1px_#2C2F29]">
        {tabs.map(({ href, label, Icon }) => {
          const active = pathname === href || pathname.startsWith(href + "/")
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "relative flex flex-col items-center justify-center gap-1 rounded-2xl text-[11px] font-semibold transition-colors duration-200",
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
              <span className="relative flex flex-col items-center gap-1">
                <Icon />
                {label}
              </span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}

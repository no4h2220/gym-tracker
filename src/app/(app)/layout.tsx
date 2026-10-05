"use client"

import { useEffect } from "react"
import { usePathname, useRouter } from "next/navigation"
import { motion, useReducedMotion } from "motion/react"
import { useApp } from "@/components/app-provider"
import { TabBar } from "@/components/tab-bar"

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { session, authReady, t } = useApp()
  const router = useRouter()
  const pathname = usePathname()
  const reduce = useReducedMotion()

  useEffect(() => {
    if (authReady && !session) router.replace("/login")
  }, [authReady, session, router])

  // each tab starts at the top
  useEffect(() => {
    document.getElementById("app-scroll")?.scrollTo(0, 0)
  }, [pathname])

  if (!authReady || !session) {
    return (
      <div className="flex min-h-dvh items-center justify-center" role="status">
        <span className="num text-sm text-muted-foreground">{t.loading}</span>
      </div>
    )
  }

  // App shell: a fixed full-screen frame with its own scroll area.
  // The tab bar is pinned to the frame, not to the page, so it sits at the same
  // spot on every tab and doesn't depend on how long the page is or how iOS sizes
  // the viewport on launch.
  return (
    <div className="fixed inset-0 flex flex-col overflow-hidden bg-background">
      <div id="app-scroll" className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch]">
        <motion.main
          key={pathname}
          initial={reduce ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.28, ease: [0.2, 0.8, 0.2, 1] }}
          className="mx-auto w-full max-w-[480px] px-5 pb-safe-nav"
          style={{ paddingTop: "calc(20px + env(safe-area-inset-top))" }}
        >
          {children}
        </motion.main>
      </div>
      <TabBar />
    </div>
  )
}

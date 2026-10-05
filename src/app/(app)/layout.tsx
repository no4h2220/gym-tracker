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

  if (!authReady || !session) {
    return (
      <div className="flex min-h-dvh items-center justify-center" role="status">
        <span className="num text-sm text-muted-foreground">{t.loading}</span>
      </div>
    )
  }

  return (
    <>
      <motion.main
        key={pathname}
        initial={reduce ? false : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.28, ease: [0.2, 0.8, 0.2, 1] }}
        className="mx-auto min-h-dvh w-full max-w-[480px] px-5 pb-safe-nav"
        style={{ paddingTop: "calc(20px + env(safe-area-inset-top))" }}
      >
        {children}
      </motion.main>
      <TabBar />
    </>
  )
}

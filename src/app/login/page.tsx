"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { AnimatePresence, motion } from "motion/react"
import { supabase } from "@/lib/supabase"
import { useApp } from "@/components/app-provider"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export default function LoginPage() {
  const { session, t, lang, setLang } = useApp()
  const router = useRouter()
  const [mode, setMode] = useState<"login" | "signup">("login")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [name, setName] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)

  useEffect(() => {
    if (session) router.replace("/training")
  }, [session, router])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setInfo(null)
    setBusy(true)
    const sb = supabase()
    try {
      if (mode === "login") {
        const { error } = await sb.auth.signInWithPassword({ email: email.trim(), password })
        if (error) setError(t.authError)
      } else {
        const { data, error } = await sb.auth.signUp({
          email: email.trim(),
          password,
          options: { data: { display_name: name.trim() }, emailRedirectTo: `${window.location.origin}/training` },
        })
        if (error) setError(error.message)
        else if (!data.session) setInfo(t.checkMail)
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <main
      className="mx-auto flex min-h-dvh w-full max-w-[420px] flex-col justify-center gap-10 px-6"
      style={{ paddingTop: "env(safe-area-inset-top)", paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="flex flex-col gap-3">
        <div className="anim-rise flex size-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground" aria-hidden="true">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
            <path d="M6 7v10M18 7v10M3 10v4M21 10v4M6 12h12" />
          </svg>
        </div>
        <h1 className="anim-rise font-wide text-[40px] leading-[.95] font-black tracking-tight uppercase" style={{ "--i": 1 } as React.CSSProperties}>
          Gym
          <br />
          Tracker
        </h1>
        <p className="anim-rise text-muted-foreground" style={{ "--i": 2 } as React.CSSProperties}>
          {t.welcome}
        </p>
      </div>

      <form onSubmit={submit} className="anim-rise flex flex-col gap-4" style={{ "--i": 3 } as React.CSSProperties} noValidate>
        <AnimatePresence initial={false}>
          {mode === "signup" && (
            <motion.div
              key="name"
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="flex flex-col gap-2"
            >
              <Label htmlFor="name">{t.displayName}</Label>
              <Input id="name" name="name" autoComplete="nickname" value={name} onChange={(e) => setName(e.target.value)} placeholder="Noah…" />
            </motion.div>
          )}
        </AnimatePresence>
        <div className="flex flex-col gap-2">
          <Label htmlFor="email">{t.email}</Label>
          <Input
            id="email"
            name="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            spellCheck={false}
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="name@mail.ch…"
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="password">{t.password}</Label>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            minLength={8}
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            aria-describedby={mode === "signup" ? "pw-hint" : undefined}
          />
          {mode === "signup" && (
            <span id="pw-hint" className="text-xs text-muted-foreground">
              {t.pwHint}
            </span>
          )}
        </div>
        <div aria-live="polite" className="min-h-5 text-sm">
          {error && <p className="text-destructive">{error}</p>}
          {info && <p className="text-primary">{info}</p>}
        </div>
        <Button type="submit" size="lg" disabled={busy}>
          {busy ? t.loading : mode === "login" ? t.login : t.signup}
        </Button>
        <Button
          type="button"
          variant="ghost"
          className="text-muted-foreground"
          onClick={() => {
            setMode(mode === "login" ? "signup" : "login")
            setError(null)
            setInfo(null)
          }}
        >
          {mode === "login" ? t.noAccount : t.haveAccount}
        </Button>
      </form>

      <div className="flex justify-center gap-2">
        {(["de", "en"] as const).map((l) => (
          <button
            key={l}
            type="button"
            onClick={() => setLang(l)}
            aria-pressed={lang === l}
            className={`num h-11 min-w-11 rounded-xl px-3 text-xs uppercase transition-colors ${lang === l ? "bg-secondary text-foreground" : "text-muted-foreground"}`}
          >
            {l}
          </button>
        ))}
      </div>
    </main>
  )
}

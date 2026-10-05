"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { supabase } from "@/lib/supabase"
import { useApp } from "@/components/app-provider"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

/** Landing page of the password-reset mail: the link signs the user in, here they set a new password. */
export default function ResetPasswordPage() {
  const { session, authReady, t } = useApp()
  const router = useRouter()
  const [password, setPassword] = useState("")
  const [repeat, setRepeat] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (password.length < 8) return setError(t.pwTooShort)
    if (password !== repeat) return setError(t.pwMismatch)
    setBusy(true)
    try {
      const { error } = await supabase().auth.updateUser({ password })
      if (error) return setError(error.message)
      toast.success(t.pwSaved)
      router.replace("/training")
    } finally {
      setBusy(false)
    }
  }

  const invalid = authReady && !session

  return (
    <main
      className="mx-auto flex min-h-dvh w-full max-w-[420px] flex-col justify-center gap-10 px-6"
      style={{ paddingTop: "env(safe-area-inset-top)", paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="flex flex-col gap-3">
        <h1 className="anim-rise font-wide text-[40px] leading-[.95] font-black tracking-tight uppercase">{t.newPwTitle}</h1>
        <p className="anim-rise text-muted-foreground" style={{ "--i": 1 } as React.CSSProperties}>
          {invalid ? t.resetLinkInvalid : t.newPwIntro}
        </p>
      </div>

      {invalid ? (
        <Button size="lg" className="anim-rise" style={{ "--i": 2 } as React.CSSProperties} onClick={() => router.replace("/login")}>
          {t.backToLogin}
        </Button>
      ) : (
        <form onSubmit={submit} className="anim-rise flex flex-col gap-4" style={{ "--i": 2 } as React.CSSProperties} noValidate>
          <div className="flex flex-col gap-2">
            <Label htmlFor="new-password">{t.newPassword}</Label>
            <Input
              id="new-password"
              name="new-password"
              type="password"
              autoComplete="new-password"
              minLength={8}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              aria-describedby="pw-hint"
            />
            <span id="pw-hint" className="text-xs text-muted-foreground">
              {t.pwHint}
            </span>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="repeat-password">{t.confirmPassword}</Label>
            <Input
              id="repeat-password"
              name="repeat-password"
              type="password"
              autoComplete="new-password"
              minLength={8}
              required
              value={repeat}
              onChange={(e) => setRepeat(e.target.value)}
            />
          </div>
          <div aria-live="polite" className="min-h-5 text-sm">
            {error && <p className="text-destructive">{error}</p>}
          </div>
          <Button type="submit" size="lg" disabled={busy || !authReady}>
            {busy || !authReady ? t.loading : t.savePassword}
          </Button>
        </form>
      )}
    </main>
  )
}

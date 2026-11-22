"use client"
import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { AlertCircle } from "lucide-react"
import { setToken, me, logout } from "@/lib/api"
import { startSession } from "@/lib/auth"

export default function Callback() {
  const router = useRouter()
  const [err, setErr] = useState<string | null>(null)
  const ran = useRef(false)

  useEffect(() => {
    if (ran.current) return // React strict mode runs effects twice in dev
    ran.current = true
    ;(async () => {
      const token = location.hash.match(/(?:^|&|#)token=([^&]+)/)?.[1]
      history.replaceState(null, "", location.pathname) // keep the token out of history and the address bar
      if (!token) { setErr("The sign-in token is missing. Please try signing in again."); return }
      setToken(token, true)
      try {
        const p = await me()
        startSession({ name: p.name, email: p.email, verified: p.verified, avatar: p.avatar || undefined }, true)
        router.replace("/chat")
      } catch {
        logout()
        setErr("This sign-in session could not be verified. Please try again.")
      }
    })()
  }, [router])

  return (
    <main id="main" className="grid min-h-dvh place-items-center p-6">
      {err ? (
        <div role="alert" className="card max-w-sm p-6 text-center">
          <AlertCircle className="mx-auto text-clay" />
          <h1 className="mt-2 font-serif text-xl font-semibold">Sign-in failed</h1>
          <p className="mt-1 text-sm text-muted">{err}</p>
          <button onClick={() => router.replace("/")} className="btn btn-primary mt-5">Back to sign in</button>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-3" role="status">
          <span className="size-8 animate-spin rounded-full border-2 border-rule border-t-moss" />
          <p className="text-sm text-muted">Signing you in…</p>
        </div>
      )}
    </main>
  )
}

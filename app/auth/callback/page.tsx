"use client"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { setToken, me, logout } from "@/lib/api"
import { startSession } from "@/lib/auth"

export default function Callback() {
  const router = useRouter()
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    (async () => {
      const match = location.hash.match(/(?:^|&)token=([^&]+)/)
      const token = match?.[1]
      if (!token) {
        setErr("Sign-in token missing. Please try signing in again.")
        return
      }
      setToken(token, true)
      try {
        const profile = await me()
        startSession({ name: profile.name, email: profile.email, verified: profile.verified }, true)
        router.replace("/chat")
      } catch {
        logout()
        setErr("This sign-in session could not be verified. Please try again.")
      }
    })()
  }, [router])

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center p-6">
      {err ? (
        <div className="glass max-w-sm rounded-2xl p-6 text-center">
          <h1 className="text-lg font-bold text-red-400">Sign-in failed</h1>
          <p className="mt-2 text-sm text-[var(--muted)]">{err}</p>
          <button
            onClick={() => router.replace("/")}
            className="grad mt-4 rounded-xl px-5 py-2 text-sm font-medium text-white transition hover:scale-105 active:scale-95"
          >
            Back to Home
          </button>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-3">
          <span className="size-8 animate-spin rounded-full border-2 border-purple-500/30 border-t-purple-500" />
          <p className="text-sm text-[var(--muted)]">Signing you in…</p>
        </div>
      )}
    </div>
  )
}


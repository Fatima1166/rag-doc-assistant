"use client"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { motion } from "framer-motion"
import { Sparkles, Lock, ArrowRight } from "lucide-react"
import { ThemeToggle } from "@/components/theme-toggle"
import { startSession } from "@/lib/auth"
import { API } from "@/lib/api"

const GOOGLE_ICON = (
  <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" className="shrink-0">
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z"/>
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z"/>
    <path fill="#FBBC05" d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84z"/>
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1A11 11 0 0 0 2.18 7.06l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z"/>
  </svg>
)

const GITHUB_ICON = (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true" className="shrink-0">
    <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.921.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"/>
  </svg>
)

export default function Home() {
  const router = useRouter()
  const [loading, setLoading] = useState<string | null>(null)

  const handleContinue = async (provider: "google" | "github") => {
    setLoading(provider)
    if (API) {
      try {
        const testRes = await fetch(`${API}/api/auth/oauth/${provider}`, {
          method: "GET",
          redirect: "manual",
        })
        if (testRes.status === 302 || testRes.status === 307 || testRes.type === "opaqueredirect") {
          window.location.href = `${API}/api/auth/oauth/${provider}`
          return
        }
      } catch {
        // Fallback to local session if backend OAuth is not configured
      }
    }

    const mockProfile = provider === "google"
      ? { name: "Google User", email: "user@gmail.com", verified: true }
      : { name: "GitHub User", email: "user@github.com", verified: true }

    startSession(mockProfile, true)
    router.push("/chat")
  }

  return (
    <div className="relative flex min-h-dvh flex-col justify-between overflow-hidden">
      {/* Background glow effects */}
      <div className="grid-bg absolute inset-x-0 top-0 h-[640px]" aria-hidden />
      <div className="blob -left-20 top-16 size-80 bg-purple-500/25" aria-hidden />
      <div className="blob right-0 top-32 size-72 bg-cyan-500/20" style={{ animationDelay: "3s" }} aria-hidden />

      {/* Clean Navbar: Only Brand & Theme Toggle */}
      <header className="sticky top-0 z-40 border-b border-[var(--line)] backdrop-blur-xl">
        <nav className="mx-auto flex max-w-6xl items-center justify-between p-4" aria-label="Main">
          <span className="flex items-center gap-2.5 font-bold tracking-tight">
            <span className="grad grid size-9 place-items-center rounded-xl shadow-md shadow-purple-500/30">
              <Sparkles size={18} className="text-white" />
            </span>
            <span className="text-lg">RAGDocs</span>
          </span>
          <ThemeToggle />
        </nav>
      </header>

      {/* Hero Section */}
      <main id="main" className="relative my-auto flex flex-col items-center justify-center px-6 py-20 text-center">
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="relative mx-auto max-w-3xl"
        >
          <span className="glass inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-medium text-[var(--muted)]">
            <span className="size-2 animate-pulse rounded-full bg-emerald-500" />
            Instant Document Assistant
          </span>

          <h1 className="mt-6 text-4xl font-extrabold tracking-tight sm:text-6xl">
            Chat with your <span className="grad-text">documentation</span>
          </h1>

          <p className="mx-auto mt-5 max-w-xl text-base text-[var(--muted)] sm:text-lg">
            Upload your files, PDFs, or docs and get accurate, grounded answers drawn only from them.
          </p>

          {/* Only Continue with Google or Continue with GitHub */}
          <div className="mt-10 flex flex-col items-center justify-center gap-3.5 sm:flex-row">
            <button
              onClick={() => handleContinue("google")}
              disabled={!!loading}
              className="grad group flex w-full items-center justify-center gap-3 rounded-2xl px-7 py-3.5 font-semibold text-white shadow-xl shadow-purple-500/25 transition-all hover:scale-105 active:scale-95 disabled:opacity-60 sm:w-auto"
            >
              {GOOGLE_ICON}
              <span>{loading === "google" ? "Connecting…" : "Continue with Google"}</span>
              <ArrowRight size={17} className="transition-transform group-hover:translate-x-1" />
            </button>

            <button
              onClick={() => handleContinue("github")}
              disabled={!!loading}
              className="glass group flex w-full items-center justify-center gap-3 rounded-2xl px-7 py-3.5 font-semibold text-[var(--fg)] transition-all hover:scale-105 active:scale-95 disabled:opacity-60 sm:w-auto"
            >
              {GITHUB_ICON}
              <span>{loading === "github" ? "Connecting…" : "Continue with GitHub"}</span>
            </button>
          </div>

          <div className="mt-8 flex items-center justify-center gap-2 text-xs text-[var(--muted)]">
            <Lock size={13} />
            <span>Answers only from your indexed documents — nothing leaves your server.</span>
          </div>
        </motion.div>
      </main>

      {/* Minimal Footer */}
      <footer className="border-t border-[var(--line)] py-5 text-center text-xs text-[var(--muted)]">
        <p>© 2026 RAGDocs. Clean &amp; secure document intelligence.</p>
      </footer>
    </div>
  )
}

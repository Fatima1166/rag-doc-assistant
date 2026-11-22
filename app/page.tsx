"use client"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { AlertCircle, ArrowRight, Loader2, Lock } from "lucide-react"
import { ThemeToggle } from "@/components/theme-toggle"
import { Wordmark } from "@/components/ui/logo"
import { Avatar } from "@/components/ui/avatar"
import { API, getProviders, type Providers } from "@/lib/api"
import { endSession, startSession, useSession } from "@/lib/auth"

type P = "google" | "github"

const GOOGLE = (
  <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" className="shrink-0">
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z" />
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z" />
    <path fill="#FBBC05" d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84z" />
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1A11 11 0 0 0 2.18 7.06l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z" />
  </svg>
)
const GITHUB = (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true" className="shrink-0">
    <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.921.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
  </svg>
)

const REASONS: Record<string, string> = {
  denied: "Sign-in was cancelled. You can try again whenever you like.",
  state: "That sign-in attempt expired or didn't match. Please try again.",
  provider: "The provider couldn't confirm your account. Please try again in a moment.",
  email: "That account has no verified email address, so it can't be used to sign in.",
  expired: "Your session ended. Please sign in again.",
}

function Cite({ n }: { n: number }) {
  return <span className="mx-0.5 inline-grid size-[18px] -translate-y-0.5 place-items-center rounded-[5px] border border-moss/40 bg-moss/10 align-middle font-mono text-[10px] font-medium text-moss">{n}</span>
}

export default function Home() {
  const router = useRouter()
  const { user, ready } = useSession()
  const [providers, setProviders] = useState<Providers | "down" | null>(null)
  const [loading, setLoading] = useState<P | null>(null)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    const q = new URLSearchParams(location.search)
    if (q.get("oauth_error")) { setErr(REASONS[q.get("reason") ?? ""] ?? "Sign-in didn't complete. Please try again."); history.replaceState(null, "", "/") }
    const reset = () => setLoading(null)
    addEventListener("pageshow", reset) // coming back from the provider with the Back button
    return () => removeEventListener("pageshow", reset)
  }, [])
  useEffect(() => { if (API) getProviders().then(setProviders).catch(() => setProviders("down")) }, [])

  const go = (p: P) => { if (!API) return; setErr(null); setLoading(p); window.location.assign(`${API}/api/auth/oauth/${p}`) }
  const signedIn = ready && !!user

  const providerBtn = (p: P, label: string, icon: React.ReactNode) => {
    const configured = providers && providers !== "down" ? providers[p] : false
    const off = providers === null || !configured
    return (
      <button key={p} onClick={() => go(p)} disabled={!!loading || off} aria-busy={loading === p}
        className="group flex h-[52px] w-full items-center gap-2.5 rounded-xl border border-rule bg-card px-3.5 text-[14px] sm:text-[15px] font-medium shadow-[var(--shadow)] transition hover:border-ink/40 disabled:cursor-not-allowed disabled:opacity-60">
        {loading === p ? <Loader2 size={18} className="shrink-0 animate-spin" /> : <span className="shrink-0">{icon}</span>}
        <span className="truncate">{loading === p ? "Redirecting…" : label}</span>
        {providers !== null && !configured && providers !== "down" ? <span className="ml-auto font-mono text-[9px] uppercase tracking-wider text-muted">Not set up</span>
          : <ArrowRight size={15} className="ml-auto shrink-0 text-muted transition group-hover:translate-x-0.5 group-hover:text-ink" />}
      </button>
    )
  }

  return (
    <div className="relative flex min-h-dvh flex-col">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-5 py-5">
        <Wordmark />
        <div className="flex items-center gap-2">
          {signedIn && user && <button onClick={() => router.push("/chat")} className="btn btn-quiet !py-1.5 !pl-1.5"><Avatar name={user.name} src={user.avatar} size={28} /><span className="hidden max-w-[10rem] truncate sm:inline">{user.name}</span></button>}
          <ThemeToggle />
        </div>
      </header>

      <main id="main" className="mx-auto grid w-full max-w-6xl flex-1 items-center gap-14 px-5 pb-16 pt-6 lg:grid-cols-[1.05fr_.95fr] lg:pt-10">
        <section className="rise">
          <p className="eyebrow">Document Q&amp;A · every answer cites its page</p>
          <h1 className="mt-4 font-serif text-[2.6rem] font-semibold leading-[1.06] tracking-tight sm:text-6xl">
            Ask your documents. <span className="marker italic">Get the page number.</span>
          </h1>
          <p className="mt-5 max-w-lg text-lg leading-relaxed text-muted">
            Upload PDFs, Word files, notes or a public link. RAGDocs answers from those files only, and you can open the source right beside the answer.
          </p>

          <div className="mt-8 max-w-md">
            {err && <div role="alert" className="mb-4 flex items-start gap-2.5 rounded-xl border border-clay/40 bg-clay/5 p-3.5 text-sm"><AlertCircle size={17} className="mt-0.5 shrink-0 text-clay" /><span>{err}</span></div>}

            {!ready ? <div className="skeleton h-[52px]" />
              : !API ? (
                <div className="card p-5">
                  <p className="text-sm text-muted"><b className="font-medium text-ink">Demo mode.</b> No backend is connected, so this uses sample data and no real account.</p>
                  <button className="btn btn-primary mt-4 w-full" onClick={() => { startSession({ name: "Demo user", email: "demo@ragdocs.local", verified: true }, true); router.push("/chat") }}>Open demo workspace <ArrowRight size={16} /></button>
                </div>
              ) : signedIn && user ? (
                <div className="card p-5">
                  <div className="flex items-center gap-3">
                    <Avatar name={user.name} src={user.avatar} size={44} />
                    <div className="min-w-0"><p className="truncate font-medium">Signed in as {user.name}</p><p className="truncate text-sm text-muted">{user.email}</p></div>
                  </div>
                  <div className="mt-4 flex gap-2">
                    <button className="btn btn-primary flex-1" onClick={() => router.push("/chat")}>Open workspace <ArrowRight size={16} /></button>
                    <button className="btn btn-quiet" onClick={() => { endSession(); }}>Switch account</button>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    {providerBtn("google", "Google", GOOGLE)}
                    {providerBtn("github", "GitHub", GITHUB)}
                  </div>
                  {providers === "down" && <p role="alert" className="text-sm text-clay">Can't reach the RAGDocs server at {API}. Start the backend (<code className="font-mono text-xs">npm run backend</code>) and refresh.</p>}
                  {providers && providers !== "down" && !providers.google && !providers.github && (
                    <p className="text-sm text-muted">No sign-in method is configured on this server yet. Add the Google / GitHub client ID and secret to <code className="font-mono text-xs">backend/.env</code> — see <code className="font-mono text-xs">SETUP_OAUTH.md</code>.</p>
                  )}
                </div>
              )}
            <p className="mt-5 flex items-center gap-2 text-xs text-muted"><Lock size={13} />Your files stay on your server and are only visible to your account.</p>
          </div>
        </section>

        {/* Specimen: what an answer looks like */}
        <section aria-label="Example answer" className="rise relative mx-auto w-full max-w-md lg:mx-0" style={{ animationDelay: ".12s" }}>
          <div aria-hidden className="absolute inset-0 translate-x-3 translate-y-3 rotate-[1.6deg] rounded-2xl border border-rule bg-sunken" />
          <div className="card relative p-5">
            <div className="flex items-center justify-between"><p className="eyebrow">Question</p><span className="rounded border border-rule px-1.5 py-0.5 font-mono text-[10px] uppercase text-muted">Example</span></div>
            <p className="mt-1.5 font-serif text-xl leading-snug">What's the refund window for annual plans?</p>
            <hr className="my-4 border-dashed border-rule" />
            <p className="eyebrow">Answer</p>
            <p className="mt-1.5 text-[15px] leading-relaxed">Annual plans can be refunded <span className="marker">within 30 days of purchase</span><Cite n={1} />. After that, unused months are credited to the account instead<Cite n={2} />.</p>
            <ul className="mt-4 space-y-2">
              {[
                ["1", "Billing-Policy.pdf", "p. 12", "…refunds are available within thirty days of the original purchase date…"],
                ["2", "Terms-of-Service.pdf", "p. 4", "…after the refund period, remaining time is applied as account credit…"],
              ].map(([n, f, pg, q]) => (
                <li key={n} className="flex gap-3 rounded-r-lg border-l-[3px] border-mark bg-mark/12 py-2 pl-3 pr-2 text-xs">
                  <span className="font-mono text-muted">[{n}]</span>
                  <span><span className="font-medium">{f}</span> <span className="font-mono text-muted">· {pg}</span><br /><span className="font-serif text-[13px] italic text-muted">{q}</span></span>
                </li>
              ))}
            </ul>
          </div>
        </section>
      </main>

      <section aria-label="How it works" className="border-t border-rule">
        <ol className="mx-auto grid max-w-6xl gap-8 px-5 py-10 sm:grid-cols-3">
          {[
            ["01", "Add your files", "PDF, Word, Markdown, CSV, code, or a public URL."],
            ["02", "Ask in plain words", "Answers are written from your files only. If it isn't there, it says so."],
            ["03", "Check the source", "Every claim points to a page. Open the file right from the answer."],
          ].map(([n, t, d]) => (
            <li key={n}><span className="font-serif text-3xl text-moss">{n}</span><h2 className="mt-2 font-medium">{t}</h2><p className="mt-1 text-sm text-muted">{d}</p></li>
          ))}
        </ol>
      </section>
      <footer className="border-t border-rule py-5 text-center text-xs text-muted">© 2026 RAGDocs</footer>
    </div>
  )
}

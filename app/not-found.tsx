import Link from "next/link";import {Sparkles} from "lucide-react"
export default function NotFound(){return <main id="main" className="relative grid min-h-dvh place-items-center overflow-hidden p-6 text-center">
 <div className="blob left-1/4 top-1/4 size-72 bg-purple-500" aria-hidden/><div className="blob bottom-1/4 right-1/4 size-64 bg-cyan-500" style={{animationDelay:"3s"}} aria-hidden/>
 <div className="relative"><span className="grad float mx-auto mb-4 grid size-14 place-items-center rounded-2xl shadow-lg shadow-purple-500/40"><Sparkles size={26} className="text-white"/></span>
 <h1 className="grad-text text-8xl font-bold sm:text-9xl">404</h1><p className="mt-3 text-[var(--muted)]">That page isn't in the index.</p>
 <Link href="/" className="grad mt-6 inline-block rounded-xl px-6 py-3 font-medium text-white shadow-lg shadow-purple-500/30 transition hover:scale-105 active:scale-95">Back to home</Link></div></main>}

"use client"
import { useState } from "react"
import dynamic from "next/dynamic"
import { Copy, Check } from "lucide-react"
import { toast } from "sonner"
const Highlighted = dynamic(() => import("./HighlightedCode"), { ssr: false, loading: () => <div className="skeleton h-24 !rounded-none" /> })
export function Code({ className, children }: { className?: string; children?: React.ReactNode }) {
  const [done, setDone] = useState(false)
  const txt = String(children ?? "").replace(/\n$/, "")
  const lang = /language-(\w+)/.exec(className ?? "")?.[1]
  if (!lang && !txt.includes("\n")) return <code className="rounded bg-sunken px-1.5 py-0.5 font-mono text-[.88em]">{txt}</code>
  return (
    <div className="my-2 overflow-hidden rounded-xl border border-rule">
      <div className="flex items-center justify-between border-b border-rule bg-card px-3 py-1.5">
        <span className="font-mono text-[10px] uppercase tracking-wider text-muted">{lang ?? "text"}</span>
        <button aria-label="Copy code" onClick={() => { navigator.clipboard.writeText(txt); setDone(true); toast("Copied"); setTimeout(() => setDone(false), 1500) }} className="rounded p-1 text-muted transition hover:text-ink">{done ? <Check size={14} /> : <Copy size={14} />}</button>
      </div>
      <Highlighted lang={lang ?? "text"}>{txt}</Highlighted>
    </div>
  )
}

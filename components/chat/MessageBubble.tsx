"use client"
import { useState } from "react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { toast } from "sonner"
import { Copy, ThumbsUp, ThumbsDown, RefreshCw, Pencil, XCircle } from "lucide-react"
import type { Msg, Source } from "@/lib/types"
import { Tip } from "@/components/ui/tooltip"
import { LogoMark } from "@/components/ui/logo"
import { Code } from "./CodeBlock"
import { CitationChip } from "./CitationChip"

const withCites = (t: string) => t.split(/(```[\s\S]*?(?:```|$))/g).map((p, i) => (i % 2 ? p : p.replace(/\[(\d+)\](?!\()/g, "[$1](#cite-$1)"))).join("")
type P = { m: Msg; last: boolean; busy: boolean; onSource: (s: Source) => void; onRegenerate: () => void; onEdit: (t: string) => void; onFeedback: (v: "up" | "down") => void }

export function MessageBubble(p: P) { return p.m.role === "user" ? <UserBubble {...p} /> : <AssistantBubble {...p} /> }

function UserBubble({ m, busy, onEdit }: P) {
  const [ed, setEd] = useState(false)
  const [t, setT] = useState(m.content)
  if (ed) {
    return (
      <div className="ml-auto w-full max-w-[85%] space-y-2">
        <textarea data-autofocus autoFocus value={t} onChange={(e) => setT(e.target.value)} rows={3} aria-label="Edit message" className="field resize-none" />
        <div className="flex justify-end gap-2">
          <button onClick={() => { setEd(false); setT(m.content) }} className="btn btn-quiet">Cancel</button>
          <button onClick={() => { setEd(false); onEdit(t) }} className="btn btn-primary">Save and resend</button>
        </div>
      </div>
    )
  }
  return (
    <div className="group flex flex-col items-end gap-1">
      <p className="max-w-[85%] whitespace-pre-wrap break-words rounded-2xl rounded-br-md border border-rule bg-sunken px-4 py-2.5 text-[15px]">{m.content}</p>
      {!busy && <button aria-label="Edit message" onClick={() => setEd(true)} className="rounded p-1 text-muted opacity-0 transition hover:text-ink group-hover:opacity-100 focus:opacity-100 [@media(hover:none)]:opacity-100"><Pencil size={14} /></button>}
    </div>
  )
}

function AssistantBubble({ m, last, busy, onSource, onRegenerate, onFeedback }: P) {
  const streaming = busy && last
  const md = {
    code: Code as any,
    pre: ({ children }: any) => <>{children}</>,
    table: ({ children }: any) => <div className="my-2 overflow-x-auto"><table>{children}</table></div>,
    a: ({ href, children }: any) => {
      if (!href?.startsWith("#cite-")) return <a href={href} target="_blank" rel="noreferrer">{children}</a>
      const n = Number(href.slice(6))
      const s = m.sources?.[n - 1]
      return (
        <button type="button" disabled={!s} onClick={() => s && onSource(s)} aria-label={`Source ${n}`}
          className="mx-0.5 inline-grid size-[18px] -translate-y-0.5 place-items-center rounded-[5px] border border-moss/40 bg-moss/10 align-middle font-mono text-[10px] font-medium text-moss no-underline transition enabled:hover:border-transparent enabled:hover:bg-mark enabled:hover:text-ink">{n}</button>
      )
    },
  }
  const btn = (label: string, Icon: any, f: () => void, on?: boolean) => (
    <Tip label={label}><button aria-label={label} aria-pressed={on} onClick={f} className={`rounded-lg p-1.5 transition hover:bg-sunken ${on ? "text-moss" : "text-muted hover:text-ink"}`}><Icon size={14} /></button></Tip>
  )
  return (
    <div className="flex gap-3">
      <span className="mt-1 shrink-0"><LogoMark size={28} /></span>
      <article className="group min-w-0 max-w-[92%] flex-1" aria-busy={streaming}>
        {m.error ? (
          <div role="alert" className="flex items-start gap-3 rounded-2xl border border-clay/40 bg-clay/5 p-4">
            <XCircle className="mt-0.5 shrink-0 text-clay" />
            <div>
              <p className="font-medium">Couldn't get an answer</p>
              <p className="text-sm text-muted">{m.content}</p>
              <button onClick={onRegenerate} className="btn btn-danger mt-3"><RefreshCw size={14} />Retry</button>
            </div>
          </div>
        ) : (
          <div className="card p-4">
            {m.content
              ? <div className="prose-doc"><ReactMarkdown remarkPlugins={[remarkGfm]} components={md}>{withCites(m.content)}</ReactMarkdown></div>
              : <span className="flex gap-1 py-1" role="status" aria-label="Assistant is typing">{[0, 1, 2].map((i) => <span key={i} className="size-2 animate-bounce rounded-full bg-moss" style={{ animationDelay: `${i * 0.15}s` }} />)}</span>}
            {!!m.sources?.length && (
              <div className="mt-4 border-t border-dashed border-rule pt-3">
                <p className="eyebrow mb-2">Sources</p>
                <div className="flex flex-wrap gap-2" aria-label="Sources">{m.sources.map((s, i) => <CitationChip key={s.id} n={i + 1} s={s} onOpen={onSource} />)}</div>
              </div>
            )}
          </div>
        )}
        {!m.error && m.content && !streaming && (
          <div className={`mt-1 flex gap-1 transition ${m.feedback ? "opacity-100" : "opacity-0 focus-within:opacity-100 group-hover:opacity-100 [@media(hover:none)]:opacity-100"}`}>
            {btn("Copy", Copy, () => { navigator.clipboard.writeText(m.content); toast("Copied") })}
            {btn("Good answer", ThumbsUp, () => onFeedback("up"), m.feedback === "up")}
            {btn("Bad answer", ThumbsDown, () => onFeedback("down"), m.feedback === "down")}
            {last && btn("Regenerate", RefreshCw, onRegenerate)}
          </div>
        )}
      </article>
    </div>
  )
}

"use client"
import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { useQuery } from "@tanstack/react-query"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { toast } from "sonner"
import { Download, ExternalLink, FileWarning, Loader2, MessageSquarePlus, RefreshCw, Search, X } from "lucide-react"
import { Dialog } from "@/components/ui/dialog"
import { FileGlyph } from "@/components/ui/glyph"
import { API, fetchDocChunks, fetchDocFile } from "@/lib/api"
import { useDocs, type Doc } from "@/lib/docs"
import { useChat } from "@/lib/store"
import { useViewer, type ViewerTarget } from "@/lib/viewer"
import { OFFICE_EXT, extOf } from "@/lib/files"
import { timeAgo } from "@/lib/utils"

const STEP = 12
const norm = (s: string) => s.replace(/\s+/g, " ").trim().toLowerCase()
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")

/** Case-insensitive <mark> highlighting. */
function Hl({ t, q }: { t: string; q: string }) {
  const n = q.trim()
  if (!n) return <>{t}</>
  return <>{t.split(new RegExp("(" + esc(n) + ")", "gi")).map((p, i) => (p.toLowerCase() === n.toLowerCase() ? <mark key={i} className="rounded bg-mark/60 px-0.5 text-ink">{p}</mark> : <span key={i}>{p}</span>))}</>
}

/** Find where a cited snippet sits inside the full text (whitespace-tolerant, first ~12 words). */
function locate(text: string, snippet?: string): [number, number] | null {
  if (!snippet) return null
  const clean = snippet.replace(/…$/, "").replace(/\s+/g, " ").trim()
  const words = clean.split(" ").slice(0, 12).map(esc)
  if (words.length < 3) return null
  try {
    const m = new RegExp(words.join("\\s+"), "i").exec(text)
    return m ? [m.index, Math.min(text.length, m.index + clean.length)] : null
  } catch { return null }
}

type FileState =
  | { s: "idle" | "loading" }
  | { s: "pdf"; url: string }
  | { s: "text"; text: string; truncated: boolean }
  | { s: "none"; why: string }
  | { s: "office" }
  | { s: "error"; msg: string }

/** Fetches the stored original with the account's token (a bare link can't send it). */
function useOriginal(doc: Doc | undefined) {
  const [st, setSt] = useState<FileState>({ s: "idle" })
  const [tick, setTick] = useState(0)
  const id = doc?.id, kind = doc?.kind, name = doc?.name ?? ""
  useEffect(() => {
    if (!id) { setSt({ s: "idle" }); return }
    const ext = extOf(name)
    if (kind === "url") { setSt({ s: "none", why: "This page was indexed from a link, so there is no stored file. The text we indexed is on the other tab." }); return }
    if (!API) { setSt({ s: "none", why: "Demo mode keeps no files. Connect the backend to preview originals." }); return }
    if (OFFICE_EXT.has(ext)) { setSt({ s: "office" }); return }
    let dead = false, url: string | null = null
    setSt({ s: "loading" })
    fetchDocFile(id)
      .then(async (b) => {
        if (dead) return
        if (ext === "pdf" || kind === "pdf") { url = URL.createObjectURL(new Blob([b], { type: "application/pdf" })); setSt({ s: "pdf", url }); return }
        const t = await b.text()
        if (!dead) setSt({ s: "text", text: t.slice(0, 400_000), truncated: t.length > 400_000 })
      })
      .catch((e) => { if (!dead) setSt({ s: "error", msg: e?.message || "Couldn't load the file" }) })
    return () => { dead = true; if (url) URL.revokeObjectURL(url) }
  }, [id, kind, name, tick])
  return { st, retry: () => setTick((t) => t + 1) }
}

export function DocViewer() {
  const target = useViewer((s) => s.target)
  const close = useViewer((s) => s.close)
  const docs = useDocs((s) => s.docs)
  const doc = target ? docs.find((d) => d.id === target.docId) : undefined
  if (!target) return null
  if (!doc) {
    return (
      <Dialog open onClose={close} title="Document not found">
        <p className="text-sm text-muted">This document isn't in your library any more. It may have been deleted, or the list is still loading.</p>
        <div className="mt-4 flex justify-end"><button data-autofocus className="btn btn-quiet" onClick={close}>Close</button></div>
      </Dialog>
    )
  }
  return <Reader key={doc.id} doc={doc} target={target} close={close} />
}

function Reader({ doc, target, close }: { doc: Doc; target: ViewerTarget; close: () => void }) {
  const router = useRouter()
  const ext = extOf(doc.name)
  const { st, retry } = useOriginal(doc)
  const textFirst = doc.kind === "url" || OFFICE_EXT.has(ext) || !API
  const [tab, setTab] = useState<"original" | "text">(textFirst ? "text" : "original")
  const [cq, setCq] = useState(target.query ?? "")
  const [shown, setShown] = useState(STEP)
  const [saving, setSaving] = useState(false)

  const chunksQ = useQuery({ queryKey: ["chunks", doc.id], queryFn: () => fetchDocChunks(doc.id), enabled: !!API && doc.status === "ready", staleTime: 60_000 })
  const chunks = chunksQ.data?.chunks ?? []

  const focusIdx = useMemo(() => {
    if (!chunks.length) return -1
    const sn = norm(target.snippet ?? "").replace(/…$/, "").slice(0, 60)
    if (sn.length >= 20) { const i = chunks.findIndex((c) => norm(c.text).includes(sn)); if (i >= 0) return i }
    if (target.page != null) { const i = chunks.findIndex((c) => c.page === target.page); if (i >= 0) return i }
    return -1
  }, [chunks, target.snippet, target.page])
  useEffect(() => { if (focusIdx >= 0) setShown((s) => Math.max(s, focusIdx + 1)) }, [focusIdx])
  useEffect(() => {
    if (tab === "text" && !cq.trim()) document.getElementById("chunk-focus")?.scrollIntoView({ block: "center" })
  }, [tab, focusIdx, cq, chunks.length])
  useEffect(() => { if (st.s === "text") document.getElementById("orig-mark")?.scrollIntoView({ block: "center" }) }, [st.s, tab])

  const match = useMemo(() => { const n = cq.trim().toLowerCase(); return n ? chunks.filter((c) => c.text.toLowerCase().includes(n)) : chunks }, [chunks, cq])

  const download = async () => {
    if (!API) return
    setSaving(true)
    try {
      const b = await fetchDocFile(doc.id)
      const a = document.createElement("a")
      a.href = URL.createObjectURL(b); a.download = doc.name; a.click()
      setTimeout(() => URL.revokeObjectURL(a.href), 1000)
    } catch (e: any) { toast.error(e?.message || "Download failed") } finally { setSaving(false) }
  }
  const askInChat = () => {
    const c = useChat.getState(); const id = c.newChat(); c.setScope(id, [doc.id]); close(); router.push("/chat")
    toast.success("New chat scoped to this document")
  }

  const meta = [doc.kind.toUpperCase(), doc.size, doc.pages ? `${doc.pages} page${doc.pages === 1 ? "" : "s"}` : null, `${doc.chunks} chunks`, timeAgo(doc.at)].filter(Boolean).join("  ·  ")
  const pdfUrl = st.s === "pdf" ? st.url : null
  const range = st.s === "text" ? locate(st.text, target.snippet) : null

  const tabBtn = (id: "original" | "text", label: string) => (
    <button role="tab" aria-selected={tab === id} onClick={() => setTab(id)}
      className={`-mb-px border-b-2 px-3 py-2 text-sm transition ${tab === id ? "border-moss font-medium text-ink" : "border-transparent text-muted hover:text-ink"}`}>{label}</button>
  )

  return (
    <Dialog open onClose={close} title={doc.name} bare size="xl">
      <div className="flex h-[88dvh] flex-col">
        <header className="flex items-start gap-3 border-b border-rule p-4">
          <FileGlyph name={doc.name} kind={doc.kind} />
          <div className="min-w-0 flex-1">
            <h2 className="truncate font-serif text-lg font-semibold" title={doc.name}>{doc.name}</h2>
            <p className="mt-0.5 truncate font-mono text-[11px] text-muted">{meta}</p>
            {target.page != null && <p className="mt-1 inline-block rounded bg-mark/40 px-1.5 py-0.5 font-mono text-[11px]">Cited · page {target.page}</p>}
          </div>
          <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
            {doc.kind === "url" && <a href={doc.name} target="_blank" rel="noreferrer" className="btn btn-quiet"><ExternalLink size={15} />Original page</a>}
            {pdfUrl && <a href={pdfUrl} target="_blank" rel="noreferrer" className="btn btn-quiet hidden sm:inline-flex"><ExternalLink size={15} />New tab</a>}
            {API && doc.kind !== "url" && <button onClick={download} disabled={saving} className="btn btn-quiet">{saving ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />}<span className="hidden sm:inline">Download</span></button>}
            <button onClick={askInChat} className="btn btn-primary"><MessageSquarePlus size={15} /><span className="hidden sm:inline">Ask in chat</span></button>
            <button data-autofocus onClick={close} aria-label="Close reader" className="btn btn-ghost !p-2"><X size={18} /></button>
          </div>
        </header>

        <div role="tablist" aria-label="Reader view" className="flex gap-1 border-b border-rule px-3">
          {tabBtn("original", "Original")}
          {tabBtn("text", `Indexed text${chunks.length ? ` (${chunks.length})` : ""}`)}
        </div>

        <div className="min-h-0 flex-1 bg-paper/50">
          {tab === "original" && (
            <div className="h-full overflow-y-auto">
              {(st.s === "loading" || st.s === "idle") && <div className="space-y-3 p-6"><div className="skeleton h-6 w-1/3" /><div className="skeleton h-40" /><div className="skeleton h-40" /></div>}
              {st.s === "pdf" && <iframe key={`${st.url}-${target.page ?? 1}`} src={`${st.url}#page=${target.page ?? 1}`} title={`${doc.name} preview`} className="h-full w-full border-0 bg-white" />}
              {st.s === "text" && (
                ext === "md" ? (
                  <div className="prose-doc mx-auto max-w-3xl p-6"><ReactMarkdown remarkPlugins={[remarkGfm]}>{st.text}</ReactMarkdown></div>
                ) : (
                  <div className="p-4">
                    {st.truncated && <p className="mb-3 rounded-lg border border-rule bg-card p-3 text-xs text-muted">Showing the first 400,000 characters. Download the file for the rest.</p>}
                    <pre className="whitespace-pre-wrap break-words rounded-xl border border-rule bg-card p-4 font-mono text-[13px] leading-relaxed">
                      {range ? <>{st.text.slice(0, range[0])}<mark id="orig-mark" className="rounded bg-mark/60 px-0.5 text-ink">{st.text.slice(range[0], range[1])}</mark>{st.text.slice(range[1])}</> : st.text}
                    </pre>
                  </div>
                )
              )}
              {st.s === "office" && (
                <Notice title="This format can't be shown in a browser" body="Word, PowerPoint and Excel files can be downloaded as they are. Everything RAGDocs read from the file is on the Indexed text tab.">
                  <button onClick={download} disabled={saving} className="btn btn-primary"><Download size={15} />Download original</button>
                  <button onClick={() => setTab("text")} className="btn btn-quiet">Read indexed text</button>
                </Notice>
              )}
              {st.s === "none" && <Notice title="No original to show" body={st.why}><button onClick={() => setTab("text")} className="btn btn-quiet">Read indexed text</button></Notice>}
              {st.s === "error" && <Notice title="Couldn't open the file" body={st.msg}><button onClick={retry} className="btn btn-primary"><RefreshCw size={15} />Try again</button><button onClick={() => setTab("text")} className="btn btn-quiet">Read indexed text</button></Notice>}
            </div>
          )}

          {tab === "text" && (
            <div className="flex h-full flex-col">
              <div className="p-3">
                <label className="relative block">
                  <span className="sr-only">Search inside this document</span>
                  <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                  <input value={cq} onChange={(e) => { setCq(e.target.value); setShown(STEP) }} placeholder="Search inside this document…" className="field !pl-9 !pr-9" />
                  {cq && <button aria-label="Clear search" onClick={() => setCq("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-ink"><X size={15} /></button>}
                </label>
              </div>
              <div className="min-h-0 flex-1 space-y-2.5 overflow-y-auto px-3 pb-4">
                {!API && <Notice title="Demo mode" body="Indexed text is available when the backend is connected." />}
                {API && chunksQ.isLoading && <div className="space-y-2"><div className="skeleton h-24" /><div className="skeleton h-24" /></div>}
                {API && chunksQ.isError && <p className="card p-4 text-sm text-clay">Couldn't load the indexed text. <button className="underline" onClick={() => chunksQ.refetch()}>Retry</button></p>}
                {API && !chunksQ.isLoading && !chunksQ.isError && !chunks.length && <p className="card p-4 text-center text-sm text-muted">{doc.status === "ready" ? "No indexed text for this document." : "Still indexing — text will appear when it's ready."}</p>}
                {!!chunks.length && <p className="eyebrow">{cq ? `${match.length} of ${chunks.length} chunks match` : `${chunks.length} indexed chunks`}</p>}
                {!!chunks.length && !match.length && <p className="card p-4 text-center text-sm text-muted">No chunk contains “{cq}”.</p>}
                {match.slice(0, shown).map((c, idx) => {
                  const focus = !cq.trim() && c === chunks[focusIdx]
                  return (
                    <article key={c.id ?? idx} id={focus ? "chunk-focus" : undefined} className={`rounded-xl border p-3.5 ${focus ? "border-mark bg-mark/15" : "border-rule bg-card"}`}>
                      <p className="mb-1.5 flex items-center gap-2 font-mono text-[10px] uppercase tracking-wider text-muted">
                        <span>Chunk {(c.ord ?? idx) + 1}</span>{c.page != null && <span>· Page {c.page}</span>}{focus && <span className="rounded bg-mark px-1.5 py-0.5 text-ink">cited</span>}
                      </p>
                      <p className="whitespace-pre-wrap text-sm leading-relaxed"><Hl t={c.text} q={cq} /></p>
                    </article>
                  )
                })}
                {match.length > shown && <button onClick={() => setShown((s) => s + STEP)} className="btn btn-quiet w-full">Show {Math.min(STEP, match.length - shown)} more · {match.length - shown} remaining</button>}
              </div>
            </div>
          )}
        </div>
      </div>
    </Dialog>
  )
}

function Notice({ title, body, children }: { title: string; body: string; children?: React.ReactNode }) {
  return (
    <div className="mx-auto mt-10 max-w-md px-4 text-center">
      <span className="mx-auto grid size-11 place-items-center rounded-full border border-rule bg-card text-muted"><FileWarning size={20} /></span>
      <h3 className="mt-3 font-serif text-lg font-semibold">{title}</h3>
      <p className="mt-1 text-sm text-muted">{body}</p>
      {children && <div className="mt-5 flex flex-wrap justify-center gap-2">{children}</div>}
    </div>
  )
}

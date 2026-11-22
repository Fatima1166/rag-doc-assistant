"use client"
import { useEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { motion } from "framer-motion"
import { toast } from "sonner"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { CheckCircle2, Loader2, XCircle, UploadCloud, Search, MessageSquarePlus, Pencil, Tag, X, AlertTriangle, RefreshCw, ChevronLeft, ChevronRight, TextSearch, Eye } from "lucide-react"
import { useDocs, stageName, type Doc } from "@/lib/docs"
import { API, listDocs, deleteDoc, deleteDocs, reindexDoc, patchDoc, searchDocs, type SearchHit } from "@/lib/api"
import { useIngest } from "@/lib/ingest"
import { timeAgo, around } from "@/lib/utils"
import { ACCEPT, KIND_LABEL, MAX_MB } from "@/lib/files"
import { useChat } from "@/lib/store"
import { useViewer } from "@/lib/viewer"
import { AppShell } from "@/components/layout/Sidebar"
import { Dropdown } from "@/components/ui/dropdown"
import { Dialog } from "@/components/ui/dialog"
import { Tabs } from "@/components/ui/tabs"
import { FileGlyph } from "@/components/ui/glyph"

type Filter = "all" | "ready" | "indexing" | "error"
type Kind = "all" | "pdf" | "url" | "text"
const PER = [12, 24, 48], TAG_MAX = 8, TAG_LEN = 24 // tag limits mirror the backend

function Hl({ t, q }: { t: string; q: string }) {
  const n = q.trim()
  if (!n) return <>{t}</>
  const re = new RegExp("(" + n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + ")", "gi")
  return <>{t.split(re).map((p, i) => (p.toLowerCase() === n.toLowerCase() ? <mark key={i} className="rounded bg-mark/60 px-0.5 text-ink">{p}</mark> : <span key={i}>{p}</span>))}</>
}

export default function Documents() {
  const { docs, remove, patch, reindex, setAll, add } = useDocs()
  const ingest = useIngest()
  const qc = useQueryClient()
  const router = useRouter()
  const openDoc = useViewer((s) => s.open)
  const [drag, setDrag] = useState(false)
  const [url, setUrl] = useState("")
  const [q, setQ] = useState("")
  const [dq, setDq] = useState("")
  const [sort, setSort] = useState("new")
  const [f, setF] = useState<Filter>("all")
  const [kind, setKind] = useState<Kind>("all")
  const [tag, setTag] = useState<string | null>(null)
  const [page, setPage] = useState(0)
  const [per, setPer] = useState(PER[0])
  const [sel, setSel] = useState<string[]>([])
  const [h, setH] = useState(false)
  const [edit, setEdit] = useState<Doc | null>(null)
  const [nm, setNm] = useState("")
  const [tags, setTags] = useState<string[]>([])
  const [tin, setTin] = useState("")
  const [busy, setBusy] = useState(false)
  const [bulk, setBulk] = useState(false)
  const [openId, setOpenId] = useState("")
  const pick = useRef<HTMLInputElement>(null)
  useEffect(() => setH(true), [])

  useEffect(() => { setPage(0) }, [f, dq, sort, kind, tag])
  useEffect(() => { const live = new Set(docs.map((d) => d.id)); setSel((s) => s.filter((id) => live.has(id))) }, [docs])
  // Deep link: /documents?q=...&open=<id>
  useEffect(() => { const p = new URLSearchParams(location.search); const v = p.get("q"); if (v) setQ(v); const o = p.get("open"); if (o) setOpenId(o) }, [])
  useEffect(() => { if (!openId) return; if (docs.some((x) => x.id === openId)) { openDoc({ docId: openId, query: q.trim() }); setOpenId("") } }, [openId, docs, q, openDoc])
  useEffect(() => { if (!q.trim()) { setDq(""); return } const t = setTimeout(() => setDq(q.trim()), 300); return () => clearTimeout(t) }, [q])

  const query = useQuery({ queryKey: ["docs"], queryFn: listDocs, enabled: !!API, refetchInterval: (qq) => ((qq.state.data as Doc[] | undefined)?.some((d) => d.status === "indexing") ? 2000 : false) })
  useEffect(() => { if (query.data) setAll(query.data) }, [query.data, setAll])

  const act = async (fn: () => Promise<void>, local: () => void, msg: string) => {
    try { if (API) { await fn(); qc.invalidateQueries({ queryKey: ["docs"] }) } else local(); toast(msg) } catch (e: any) { toast.error(e.message) }
  }
  const del = (d: Doc) => act(() => deleteDoc(d.id), () => remove(d.id), "Document deleted")
  const re = (d: Doc) => act(() => reindexDoc(d.id), () => { if (d.status === "error") { remove(d.id); add(d.name.replace("fail", ""), d.kind, d.size) } else reindex(d.id) }, "Indexing started")
  const delBulk = async () => {
    const ids = sel; setBusy(true)
    try {
      if (API) { const n = await deleteDocs(ids); qc.invalidateQueries({ queryKey: ["docs"] }); toast.success(`${n} document${n === 1 ? "" : "s"} deleted`) }
      else { ids.forEach(remove); toast.success(`${ids.length} document${ids.length === 1 ? "" : "s"} deleted`) }
      setSel([]); setBulk(false)
    } catch (e: any) { toast.error(e.message) } finally { setBusy(false) }
  }
  const useInChat = (ids: string[]) => {
    if (!ids.length) return
    const c = useChat.getState(); const id = c.newChat(); c.setScope(id, ids); router.push("/chat")
    toast.success(`New chat scoped to ${ids.length} source${ids.length === 1 ? "" : "s"}`)
  }
  const openEdit = (d: Doc) => { setEdit(d); setNm(d.name); setTags(d.tags ?? []); setTin("") }
  const addTag = (raw: string) => {
    const t = raw.trim().replace(/,/g, "").slice(0, TAG_LEN)
    if (!t) return
    if (tags.includes(t)) return void setTin("")
    if (tags.length >= TAG_MAX) return void toast.error(`${TAG_MAX} tags maximum`)
    setTags((x) => [...x, t]); setTin("")
  }
  const saveEdit = async () => {
    if (!edit) return
    if (!nm.trim()) return void toast.error("Name can't be empty")
    setBusy(true)
    try {
      const clean = tags.map((t) => t.trim()).filter(Boolean)
      if (API) { const d = await patchDoc(edit.id, { name: nm.trim(), tags: clean }); patch(d.id, { name: d.name, tags: d.tags }); qc.invalidateQueries({ queryKey: ["docs"] }) }
      else patch(edit.id, { name: nm.trim(), tags: clean })
      setEdit(null); toast.success("Document updated")
    } catch (e: any) { toast.error(e.message) } finally { setBusy(false) }
  }

  const ready = docs.filter((d) => d.status === "ready").length, idx = docs.filter((d) => d.status === "indexing").length, bad = docs.filter((d) => d.status === "error").length
  const stats: [string, number][] = [["Documents", docs.length], ["Chunks", docs.reduce((a, d) => a + d.chunks, 0)], ["Ready", ready], ["Indexing", idx]]
  const tabs: { id: Filter; label: string; count: number }[] = [{ id: "all", label: "All", count: docs.length }, { id: "ready", label: "Ready", count: ready }, { id: "indexing", label: "Indexing", count: idx }, { id: "error", label: "Failed", count: bad }]
  const kinds: { id: Kind; label: string; count: number }[] = [{ id: "all", label: "All types", count: docs.length }, { id: "pdf", label: "PDF", count: docs.filter((d) => d.kind === "pdf").length }, { id: "url", label: "URL", count: docs.filter((d) => d.kind === "url").length }, { id: "text", label: "Text", count: docs.filter((d) => d.kind === "text").length }]
  const allTags = useMemo(() => [...new Set(docs.flatMap((d) => d.tags ?? []))].sort((a, b) => a.localeCompare(b)), [docs])
  const list = useMemo(() => docs.filter((d) => (f === "all" || d.status === f) && (kind === "all" || d.kind === kind) && (!tag || d.tags?.includes(tag)) && d.name.toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => (sort === "name" ? a.name.localeCompare(b.name) : sort === "chunks" ? b.chunks - a.chunks : b.at - a.at)), [docs, f, q, sort, kind, tag])
  const pages = Math.max(1, Math.ceil(list.length / per)), cur = Math.min(page, pages - 1), visible = list.slice(cur * per, cur * per + per)
  const allPicked = list.length > 0 && list.every((d) => sel.includes(d.id))
  const toggle = (id: string) => setSel((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]))
  const toggleAll = () => setSel(allPicked ? [] : list.map((d) => d.id))

  const content = useQuery({ queryKey: ["docs-content", dq], queryFn: () => searchDocs(dq, undefined, 12), enabled: !!API && dq.length >= 2, staleTime: 30_000 })
  const docHits = useMemo(() => {
    const m = new Map<string, { doc: Doc; hits: number; page: number | null; snippet: string }>()
    for (const hh of (content.data ?? []) as SearchHit[]) {
      const d = docs.find((x) => x.id === hh.doc_id); if (!d) continue
      const e = m.get(d.id)
      if (e) e.hits++; else m.set(d.id, { doc: d, hits: 1, page: hh.page ?? null, snippet: around(hh.text, dq, 20) })
    }
    return [...m.values()]
  }, [content.data, docs, dq])

  return (
    <AppShell>
      <main id="main" className="mx-auto w-full max-w-5xl p-5 sm:p-8">
        <header className="mb-7">
          <h1 className="font-serif text-4xl font-semibold tracking-tight">Documents</h1>
          <p className="mt-1 text-muted">Everything your assistant can answer from. {KIND_LABEL} up to {MAX_MB} MB, or a public URL.</p>
        </header>

        {!h ? <div className="skeleton h-32" /> : <>
          {query.isError && (
            <div role="alert" className="mb-4 flex items-center gap-3 rounded-xl border border-clay/40 bg-clay/5 p-4">
              <XCircle className="shrink-0 text-clay" /><p className="flex-1 text-sm">Couldn't load your documents from the server.</p>
              <button onClick={() => query.refetch()} className="btn btn-danger">Retry</button>
            </div>
          )}
          {!!bad && (
            <div role="alert" className="mb-4 rounded-xl border border-clay/40 bg-clay/5 p-4">
              <p className="flex items-center gap-2 text-sm font-medium"><AlertTriangle size={16} className="text-clay" />{bad} document{bad === 1 ? "" : "s"} failed to index</p>
              <ul className="mt-2 space-y-1 text-sm text-muted">
                {docs.filter((d) => d.status === "error").map((d) => (
                  <li key={d.id} className="flex items-center gap-2">
                    <div className="min-w-0 flex-1"><span className="block truncate">{d.name}</span>{d.error && <span className="block truncate text-clay/90" title={d.error}>{d.error}</span>}</div>
                    <button onClick={() => re(d)} className="btn btn-ghost !px-2 !py-0.5 !text-xs"><RefreshCw size={12} />Retry</button>
                    <button onClick={() => del(d)} aria-label={`Remove failed document ${d.name}`} className="btn btn-ghost !p-1"><X size={12} /></button>
                  </li>
                ))}
              </ul>
              <div className="mt-3 flex flex-wrap gap-2">
                <button onClick={() => docs.filter((d) => d.status === "error").forEach(re)} className="btn btn-danger">Retry all</button>
                <button onClick={() => setSel(docs.filter((d) => d.status === "error").map((d) => d.id))} className="btn btn-quiet">Select all failed</button>
              </div>
            </div>
          )}

          <section aria-label="Stats" className="grid grid-cols-2 divide-rule rounded-xl border border-rule bg-card sm:grid-cols-4 sm:divide-x">
            {stats.map(([l, v], i) => (
              <motion.div key={l} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} className="p-4">
                <p className="font-serif text-3xl font-semibold tabular-nums">{v}</p>
                <p className="eyebrow mt-1 !text-[10px]">{l}</p>
              </motion.div>
            ))}
          </section>

          <section aria-label="Upload documents" onDragOver={(e) => { e.preventDefault(); setDrag(true) }} onDragLeave={() => setDrag(false)} onDrop={(e) => { e.preventDefault(); setDrag(false); ingest.files(e.dataTransfer.files) }}
            className={`mt-6 rounded-2xl border-2 border-dashed p-8 text-center transition sm:p-10 ${drag ? "border-moss bg-moss/10" : "border-rule bg-sunken/50"}`}>
            <UploadCloud className="mx-auto text-moss" size={38} strokeWidth={1.5} />
            <p className="mt-3 font-serif text-lg font-medium">{drag ? "Drop to upload" : "Drop files here"}</p>
            <button onClick={() => pick.current?.click()} className="mt-1 text-sm text-moss underline underline-offset-4">or browse files</button>
            <input ref={pick} type="file" multiple accept={ACCEPT} hidden onChange={(e) => { ingest.files(e.target.files); e.target.value = "" }} />
            <form className="mx-auto mt-6 flex max-w-lg gap-2" onSubmit={(e) => { e.preventDefault(); if (url.trim()) ingest.url(url.trim()).then((ok) => ok && setUrl("")) }}>
              <input value={url} onChange={(e) => setUrl(e.target.value)} type="url" placeholder="Or paste a documentation URL" aria-label="Documentation URL" className="field min-w-0 flex-1" />
              <button className="btn btn-primary">Index</button>
            </form>
          </section>

          <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
            <Tabs label="Filter documents by status" value={f} onChange={setF} items={tabs} />
            <div className="flex flex-1 gap-2 sm:flex-none">
              <label className="relative flex-1 sm:w-56"><span className="sr-only">Search documents</span><Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search" className="field !pl-9" /></label>
              <select aria-label="Filter by type" value={kind} onChange={(e) => setKind(e.target.value as Kind)} className="field !w-auto">{kinds.map((k) => <option key={k.id} value={k.id}>{k.label} ({k.count})</option>)}</select>
              <select aria-label="Sort documents" value={sort} onChange={(e) => setSort(e.target.value)} className="field !w-auto"><option value="new">Newest</option><option value="name">Name</option><option value="chunks">Most chunks</option></select>
            </div>
          </div>

          {!!allTags.length && (
            <div className="mt-3 flex flex-wrap items-center gap-2" aria-label="Filter by tag">
              <span className="eyebrow !text-[10px]">Tags</span>
              {allTags.map((t) => { const on = tag === t; return <button key={t} onClick={() => setTag(on ? null : t)} aria-pressed={on} className={`rounded-full border px-3 py-1 text-xs transition ${on ? "border-transparent bg-moss text-moss-ink" : "border-rule text-muted hover:text-ink"}`}>{t}</button> })}
              {tag && <button onClick={() => setTag(null)} className="text-xs text-moss underline">Clear</button>}
            </div>
          )}

          {API && dq.trim().length >= 2 && (
            <section aria-label="Matches inside documents" className="card mt-4 p-3">
              {content.isFetching && !content.data && <p className="flex items-center gap-2 text-sm text-muted"><Loader2 size={14} className="animate-spin" />Searching indexed text…</p>}
              {content.isError && <p className="flex flex-wrap items-center gap-2 text-sm text-clay">Content search failed.<button onClick={() => content.refetch()} className="inline-flex items-center gap-1 underline">Retry<RefreshCw size={12} /></button></p>}
              {!content.isError && content.data && !docHits.length && <p className="text-sm text-muted">No indexed passage contains “{dq}”. Try fewer or more common words.</p>}
              {!!docHits.length && (
                <>
                  <p className="eyebrow mb-1.5 flex items-center gap-1.5"><TextSearch size={13} />Found inside the text · {docHits.length} document{docHits.length === 1 ? "" : "s"}</p>
                  <ul className="space-y-0.5">
                    {docHits.map(({ doc, hits, page: pg, snippet }) => (
                      <li key={doc.id}>
                        <button onClick={() => openDoc({ docId: doc.id, query: dq, page: pg })} className="flex w-full items-start gap-2 rounded-lg px-2 py-1.5 text-left transition hover:bg-sunken">
                          <span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium"><Hl t={doc.name} q={dq} /></span><span className="line-clamp-1 text-xs text-muted">{pg != null ? `p.${pg} · ` : ""}<Hl t={snippet} q={dq} /></span></span>
                          <span className="shrink-0 rounded-full border border-rule px-2 py-0.5 font-mono text-[11px] text-muted">{hits} hit{hits === 1 ? "" : "s"}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </section>
          )}

          {!!sel.length && (
            <div role="toolbar" aria-label="Bulk actions" className="mt-4 flex flex-wrap items-center gap-2 rounded-xl border border-moss/40 bg-moss/5 p-3">
              <span className="text-sm font-medium">{sel.length} selected</span>
              <button onClick={toggleAll} className="btn btn-quiet !py-1 !text-xs">{allPicked ? "Deselect all" : "Select all"}</button>
              {sel.length === 1 && <button onClick={() => { const d = docs.find((x) => x.id === sel[0]); d && openEdit(d) }} className="btn btn-quiet !py-1 !text-xs"><Pencil size={12} />Rename</button>}
              <button onClick={() => useInChat(sel)} className="btn btn-quiet !py-1 !text-xs"><MessageSquarePlus size={12} />Ask in a new chat</button>
              <button onClick={() => setBulk(true)} className="btn btn-danger !py-1 !text-xs"><XCircle size={12} />Delete</button>
              <button onClick={() => setSel([])} aria-label="Clear selection" className="btn btn-ghost ml-auto !p-1.5"><X size={14} /></button>
            </div>
          )}

          <section className="mt-4" aria-label="Documents">
            {!docs.length ? (
              <div className="card p-12 text-center"><h2 className="font-serif text-2xl font-semibold">No documents yet</h2><p className="mt-1 text-muted">Upload a file or paste a URL to get started.</p></div>
            ) : !list.length ? (
              <p className="card p-8 text-center text-muted">No documents match your filters{tag ? ` (tag “${tag}”)` : ""}.</p>
            ) : (
              <ul className="overflow-hidden rounded-xl border border-rule bg-card">
                {visible.map((d, i) => {
                  const on = sel.includes(d.id)
                  return (
                    <motion.li key={d.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: Math.min(i, 8) * 0.03 }}
                      className={`flex items-center gap-3 border-b border-rule p-3.5 last:border-b-0 sm:p-4 ${d.status === "error" ? "bg-clay/5" : on ? "bg-moss/5" : "hover:bg-sunken/50"}`}>
                      <input type="checkbox" checked={on} onChange={() => toggle(d.id)} aria-label={`Select ${d.name}`} className="size-4 shrink-0 accent-[var(--moss)]" />
                      <FileGlyph name={d.name} kind={d.kind} />
                      <div className="min-w-0 flex-1">
                        <button onClick={() => openDoc({ docId: d.id })} disabled={d.status === "indexing"} className="block max-w-full truncate text-left font-medium hover:text-moss hover:underline disabled:no-underline disabled:hover:text-ink" title={d.name}><Hl t={d.name} q={q} /></button>
                        {d.status === "error" && <p className="line-clamp-2 text-xs text-clay" title={d.error || undefined}>{d.error || "Indexing failed. Choose Retry from the menu."}</p>}
                        <p className="font-mono text-[11px] text-muted">{d.chunks} chunks · {d.size}{!!d.pages && ` · ${d.pages} p.`} · {timeAgo(d.at)}</p>
                        {!!d.tags?.length && <span className="mt-1.5 flex flex-wrap gap-1">{d.tags.map((t) => <button key={t} onClick={() => setTag(t)} className="inline-flex items-center gap-1 rounded-full border border-rule px-2 py-0.5 text-[11px] text-muted transition hover:border-moss/50 hover:text-ink"><Tag size={10} />{t}</button>)}</span>}
                        {d.status === "indexing" && (
                          <div className="mt-2">
                            <div className="flex items-baseline justify-between gap-2 font-mono text-[11px] text-muted"><span>{stageName(d)}</span><span className="tabular-nums">{d.progress}%</span></div>
                            <div className="mt-1 h-1.5 overflow-hidden rounded bg-sunken" role="progressbar" aria-label={`Indexing ${d.name}`} aria-valuenow={d.progress} aria-valuemax={100}><div className="h-full bg-moss transition-all" style={{ width: `${d.progress}%` }} /></div>
                          </div>
                        )}
                      </div>
                      {d.status === "ready" ? <span className="hidden items-center gap-1 text-xs text-moss sm:inline-flex"><CheckCircle2 size={15} />Ready</span>
                        : d.status === "indexing" ? <Loader2 className="shrink-0 animate-spin text-moss" aria-label="Indexing" />
                        : <span className="inline-flex items-center gap-1 text-xs text-clay"><XCircle size={15} />Failed</span>}
                      {d.status !== "error" && <button onClick={() => openDoc({ docId: d.id })} disabled={d.status === "indexing"} className="btn btn-quiet !px-3 !py-1.5" aria-label={`View ${d.name}`}><Eye size={15} /><span className="hidden sm:inline">View</span></button>}
                      <Dropdown label={`Actions for ${d.name}`} items={[
                        ...(d.status !== "error" ? [{ text: "View", onClick: () => openDoc({ docId: d.id }) }] : []),
                        { text: "Rename & tag", onClick: () => openEdit(d) },
                        { text: "Ask in a new chat", onClick: () => useInChat([d.id]) },
                        ...(d.status !== "indexing" ? [{ text: d.status === "error" ? "Retry" : "Re-index", onClick: () => re(d) }] : []),
                        { text: "Delete", danger: true, onClick: () => del(d) },
                      ]} />
                    </motion.li>
                  )
                })}
              </ul>
            )}
            {list.length > per && (
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                <p className="font-mono text-xs text-muted">Showing {cur * per + 1}–{Math.min(list.length, (cur + 1) * per)} of {list.length}</p>
                <div className="flex items-center gap-2">
                  <select aria-label="Documents per page" value={per} onChange={(e) => { setPer(Number(e.target.value)); setPage(0) }} className="field !w-auto !py-1.5">{PER.map((n) => <option key={n} value={n}>{n}</option>)}</select>
                  <button aria-label="Previous page" disabled={cur === 0} onClick={() => setPage(cur - 1)} className="btn btn-quiet size-8 !p-0"><ChevronLeft size={16} /></button>
                  <span className="font-mono text-sm tabular-nums">{cur + 1} / {pages}</span>
                  <button aria-label="Next page" disabled={cur >= pages - 1} onClick={() => setPage(cur + 1)} className="btn btn-quiet size-8 !p-0"><ChevronRight size={16} /></button>
                </div>
              </div>
            )}
          </section>
        </>}

        <Dialog open={!!edit} onClose={() => setEdit(null)} title="Rename & tag document">
          <div className="space-y-4">
            <div><label htmlFor="doc-name" className="text-sm font-medium">Name</label><input id="doc-name" data-autofocus value={nm} onChange={(e) => setNm(e.target.value)} maxLength={200} className="field mt-1" /></div>
            <div>
              <label htmlFor="doc-tag" className="text-sm font-medium">Tags <span className="font-normal text-muted">({tags.length}/{TAG_MAX}, Enter to add)</span></label>
              <input id="doc-tag" value={tin} onChange={(e) => setTin(e.target.value)} className="field mt-1" placeholder={tags.length ? "e.g. api, reference" : "e.g. api"}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === ",") { e.preventDefault(); addTag(tin) } else if (e.key === "Backspace" && !tin && tags.length) setTags((x) => x.slice(0, -1)) }} />
              {!!tags.length && <span className="mt-2 flex flex-wrap gap-1.5">{tags.map((t) => <span key={t} className="inline-flex items-center gap-1 rounded-full bg-moss/12 px-2.5 py-1 text-xs"><span className="font-medium text-moss">{t}</span><button aria-label={`Remove tag ${t}`} onClick={() => setTags((x) => x.filter((y) => y !== t))} className="text-muted hover:text-ink"><X size={12} /></button></span>)}</span>}
            </div>
            <p className="text-xs text-muted">Renaming never re-indexes the document — your chunks and citations stay put.</p>
            <div className="flex justify-end gap-2"><button onClick={() => setEdit(null)} className="btn btn-quiet">Cancel</button><button onClick={saveEdit} disabled={busy} className="btn btn-primary">{busy ? "Saving…" : "Save"}</button></div>
          </div>
        </Dialog>

        <Dialog open={bulk} onClose={() => setBulk(false)} title="Delete selected documents?">
          <p className="text-sm text-muted">{sel.length} document{sel.length === 1 ? "" : "s"} will be removed with all of their chunks. This can't be undone.</p>
          <ul className="mt-3 max-h-40 space-y-1 overflow-y-auto text-sm">{docs.filter((d) => sel.includes(d.id)).map((d) => <li key={d.id} className="truncate">{d.name}</li>)}</ul>
          <div className="mt-4 flex justify-end gap-2"><button data-autofocus onClick={() => setBulk(false)} className="btn btn-quiet">Cancel</button><button onClick={delBulk} disabled={busy} className="btn btn-danger">{busy ? "Deleting…" : `Delete ${sel.length}`}</button></div>
        </Dialog>
      </main>
    </AppShell>
  )
}

"use client"
import { useEffect, useMemo, useState } from "react"
import { usePathname, useRouter } from "next/navigation"
import { useTheme } from "next-themes"
import { MessageSquare, FileText, Plus, Moon, Search, TextSearch, Loader2, XCircle } from "lucide-react"
import { useQuery } from "@tanstack/react-query"
import { Dialog } from "@/components/ui/dialog"
import { useChat } from "@/lib/store"
import { useViewer } from "@/lib/viewer"
import { API, searchDocs } from "@/lib/api"
import { around } from "@/lib/utils"

export function CommandPalette() {
  const path = usePathname()
  const r = useRouter()
  const { resolvedTheme, setTheme } = useTheme()
  const { convs, newChat, setActive } = useChat()
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState("")
  const [i, setI] = useState(0)
  const [dq, setDq] = useState("")
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setOpen((o) => !o) } }
    const o = () => setOpen(true)
    addEventListener("keydown", k); addEventListener("open-palette", o)
    return () => { removeEventListener("keydown", k); removeEventListener("open-palette", o) }
  }, [])
  useEffect(() => { if (!open || !q.trim()) { setDq(""); return } const t = setTimeout(() => setDq(q.trim()), 300); return () => clearTimeout(t) }, [q, open])
  const items = useMemo(() => {
    const go = (h: string) => () => r.push(h)
    const dark = resolvedTheme === "dark"
    const all: { l: string; I: any; f: () => void; sub?: string }[] = [
      { l: "New chat", I: Plus, f: () => { newChat(); r.push("/chat") } },
      { l: "Go to Chat", I: MessageSquare, f: go("/chat") },
      { l: "Go to Documents", I: FileText, f: go("/documents") },
      { l: `Switch to ${dark ? "light" : "dark"} theme`, I: Moon, f: () => setTheme(dark ? "light" : "dark") },
      ...(API && dq.length >= 2 ? [{ l: `Search document text for “${dq}”`, I: TextSearch, sub: "Full text", f: go(`/documents?q=${encodeURIComponent(dq)}`) }] : []),
      ...convs.map((c) => ({ l: c.title, I: MessageSquare, sub: "Conversation", f: () => { setActive(c.id); r.push("/chat") } })),
    ]
    return all.filter((x) => x.l.toLowerCase().includes(q.toLowerCase())).slice(0, 9)
  }, [q, dq, convs, resolvedTheme, r, newChat, setActive, setTheme])
  useEffect(() => setI(0), [q])
  const close = () => { setOpen(false); setQ(""); setDq("") }
  const run = (n: number) => { items[n]?.f(); close() }
  const hits = useQuery({ queryKey: ["palette-search", dq], queryFn: () => searchDocs(dq, undefined, 8), enabled: open && !!API && dq.length >= 2, staleTime: 30_000 })
  const shown = useMemo(() => {
    const m = new Map<string, { id: string; name: string; snippet: string; page: number | null }>()
    for (const h of hits.data ?? []) { if (m.has(h.doc_id)) continue; m.set(h.doc_id, { id: h.doc_id, name: h.doc_name, snippet: around(h.text, dq), page: h.page ?? null }) }
    return [...m.values()].slice(0, 4)
  }, [hits.data, dq])
  if (!["/chat", "/documents"].some((p) => path.startsWith(p))) return null
  return (
    <Dialog open={open} onClose={close} title="Command palette" bare top>
      <div className="flex items-center gap-2 border-b border-rule px-4">
        <Search size={16} className="text-muted" />
        <input data-autofocus value={q} onChange={(e) => setQ(e.target.value)} role="combobox" aria-expanded="true" aria-controls="palette-list"
          aria-label="Search chats, commands or document text" placeholder="Search chats, commands or document text…" className="w-full bg-transparent py-3 outline-none placeholder:text-muted"
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") { e.preventDefault(); setI((x) => Math.min(x + 1, items.length - 1)) }
            else if (e.key === "ArrowUp") { e.preventDefault(); setI((x) => Math.max(x - 1, 0)) }
            else if (e.key === "Enter") run(i)
          }} />
        <kbd className="rounded border border-rule px-1.5 py-0.5 font-mono text-[10px] text-muted">esc</kbd>
      </div>
      <ul id="palette-list" role="listbox" aria-label="Commands and conversations" className="max-h-64 overflow-y-auto p-2">
        {items.map((x, n) => (
          <li key={x.l + n} role="option" aria-selected={n === i}>
            <button tabIndex={-1} onMouseEnter={() => setI(n)} onClick={() => run(n)} className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm ${n === i ? "bg-sunken" : ""}`}>
              <x.I size={16} className="text-moss" /><span className="truncate">{x.l}</span>{x.sub && <span className="ml-auto font-mono text-[10px] uppercase text-muted">{x.sub}</span>}
            </button>
          </li>
        ))}
        {!items.length && !shown.length && <li className="p-4 text-center text-sm text-muted">No results</li>}
      </ul>
      {API && dq.length >= 2 && (
        <div role="region" aria-label="Matches inside documents" className="border-t border-rule p-2">
          {hits.isFetching && !hits.data && <p className="flex items-center gap-2 px-3 py-2 text-xs text-muted"><Loader2 size={13} className="animate-spin" />Searching indexed text…</p>}
          {hits.isError && <p className="flex items-center gap-2 px-3 py-2 text-xs text-clay"><XCircle size={13} />Text search failed</p>}
          {!!shown.length && (
            <>
              <p className="eyebrow px-3 pb-1 pt-2 !text-[10px]">Inside documents</p>
              {shown.map((h) => (
                <button key={h.id} onClick={() => { close(); useViewer.getState().open({ docId: h.id, query: dq, page: h.page }) }} className="flex w-full items-start gap-3 rounded-lg px-3 py-2 text-left transition hover:bg-sunken">
                  <TextSearch size={16} className="mt-0.5 shrink-0 text-moss" />
                  <span className="min-w-0 flex-1"><span className="block truncate text-sm">{h.name}</span><span className="line-clamp-1 text-xs text-muted">{h.snippet}</span></span>
                </button>
              ))}
            </>
          )}
          {!hits.isFetching && !hits.isError && hits.data && !hits.data.length && <p className="px-3 py-2 text-xs text-muted">No indexed passage contains “{dq}”.</p>}
        </div>
      )}
    </Dialog>
  )
}

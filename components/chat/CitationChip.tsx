import type { Source } from "@/lib/types"
/** A footnote-style source: numbered square, document title, folio. */
export function CitationChip({ n, s, onOpen }: { n: number; s: Source; onOpen: (s: Source) => void }) {
  return (
    <button onClick={() => onOpen(s)} className="group inline-flex max-w-full items-center gap-2 rounded-lg border border-rule bg-paper/60 py-1 pl-1 pr-2.5 text-xs transition hover:border-mark hover:bg-mark/20">
      <span className="grid size-5 shrink-0 place-items-center rounded-[5px] border border-moss/40 bg-moss/10 font-mono text-[10px] font-medium text-moss group-hover:border-transparent group-hover:bg-mark group-hover:text-ink">{n}</span>
      <span className="truncate">{s.title}</span>
      {s.page ? <span className="shrink-0 font-mono text-[10px] text-muted">p.{s.page}{s.page_end ? `–${s.page_end}` : ""}</span> : null}
    </button>
  )
}

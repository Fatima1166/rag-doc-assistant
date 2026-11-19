import type {Source} from "@/lib/types"
export function CitationChip({n,s,onOpen}:{n:number;s:Source;onOpen:(s:Source)=>void}){
 return <button onClick={()=>onOpen(s)} className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-purple-500/40 bg-purple-500/10 py-1 pl-1.5 pr-3 text-xs transition hover:scale-105 hover:bg-purple-500/20">
  <span className="grid size-5 shrink-0 place-items-center rounded-full bg-purple-500/30 text-[11px] font-semibold">{n}</span><span className="truncate">{s.title}{s.page?` · p.${s.page}`:""}</span></button>}

"use client"
import {useEffect,useRef,useState} from "react";import {Layers,Check} from "lucide-react"
export function ScopePicker({docs,selected,onChange}:{docs:{id:string;name:string}[];selected?:string[];onChange:(ids?:string[])=>void}){
 const [o,setO]=useState(false);const r=useRef<HTMLDivElement>(null)
 useEffect(()=>{if(!o)return;const f=(e:MouseEvent)=>!r.current?.contains(e.target as Node)&&setO(false);const k=(e:KeyboardEvent)=>e.key==="Escape"&&setO(false);addEventListener("mousedown",f);addEventListener("keydown",k);return()=>{removeEventListener("mousedown",f);removeEventListener("keydown",k)}},[o])
 const cur=selected?docs.filter(d=>selected.includes(d.id)).map(d=>d.id):docs.map(d=>d.id)
 const toggle=(id:string)=>{const n=cur.includes(id)?cur.filter(x=>x!==id):[...cur,id];onChange(n.length===docs.length?undefined:n)}
 return <div ref={r} className="relative"><button aria-haspopup="listbox" aria-expanded={o} onClick={()=>setO(!o)} className="glass flex h-10 items-center gap-2 px-3 text-sm transition hover:border-purple-500/50"><Layers size={16}/><span className="hidden sm:inline">{selected?`${cur.length} of ${docs.length} sources`:"All sources"}</span></button>
  {o&&<div className="glass absolute right-0 top-full z-30 mt-2 w-72 bg-[var(--bg)] p-2 shadow-xl"><p className="px-2 py-1 text-xs text-[var(--muted)]">Answer using only…</p>
   <button onClick={()=>onChange(undefined)} className="flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-left text-sm hover:bg-purple-500/10">All documents{!selected&&<Check size={14} className="text-purple-400"/>}</button>
   <ul role="listbox" aria-multiselectable className="max-h-60 overflow-y-auto">{docs.map(d=><li key={d.id} role="option" aria-selected={cur.includes(d.id)}><button onClick={()=>toggle(d.id)} className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-purple-500/10"><span className={`grid size-4 shrink-0 place-items-center rounded border ${cur.includes(d.id)?"grad border-transparent":"border-[var(--line)]"}`}>{cur.includes(d.id)&&<Check size={12} className="text-white"/>}</span><span className="truncate">{d.name}</span></button></li>)}
   {!docs.length&&<li className="p-3 text-center text-sm text-[var(--muted)]">No indexed documents</li>}</ul></div>}</div>}

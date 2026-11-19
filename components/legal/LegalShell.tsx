"use client"
import Link from "next/link";import {Sparkles,ArrowLeft} from "lucide-react"
import {ThemeToggle} from "@/components/theme-toggle"

/** One section of a legal document: a heading plus paragraphs, bullets or a table. */
export type LegalSection={h:string;p?:string[];li?:string[];table?:{head:string[];rows:string[][]};note?:string}
export type LegalDoc={title:string;updated:string;intro:string;sections:LegalSection[];contact:string}

const H=({t}:{t:string})=><h2 className="mt-8 mb-2 text-lg font-semibold scroll-mt-20" id={t.toLowerCase().replace(/[^a-z0-9]+/g,"-")}>{t}</h2>

export function Legal({doc}:{doc:LegalDoc}){
 return <div className="min-h-dvh">
  <header className="sticky top-0 z-20 border-b border-[var(--line)] bg-[var(--bg)]/80 backdrop-blur-xl">
   <div className="mx-auto flex max-w-3xl items-center gap-3 px-6 py-4">
    <Link href="/" className="flex items-center gap-2 font-semibold"><span className="grad grid size-8 place-items-center rounded-lg"><Sparkles size={16} className="text-white"/></span>RAGDocs</Link>
    <span className="ml-auto"><ThemeToggle/></span></div></header>
  <main className="mx-auto max-w-3xl px-6 py-10">
   <Link href="/" className="inline-flex items-center gap-1 text-sm text-purple-400 underline"><ArrowLeft size={14}/>Back to home</Link>
   <h1 className="mt-4 text-3xl font-bold">{doc.title}</h1>
   <p className="mt-1 text-sm text-[var(--muted)]">Last updated {doc.updated}</p>
   <p className="mt-4 text-sm leading-relaxed text-[var(--muted)]">{doc.intro}</p>
   {doc.sections.map(s=><section key={s.h}>
    <H t={s.h}/>
    {s.p?.map((x,i)=><p key={i} className="mt-2 text-sm leading-relaxed">{x}</p>)}
    {!!s.li?.length&&<ul className="mt-2 space-y-1.5 text-sm leading-relaxed">{s.li.map((x,i)=><li key={i} className="flex gap-2"><span className="text-purple-400">•</span><span>{x}</span></li>)}</ul>}
    {!!s.table&&<div className="mt-3 overflow-x-auto"><table className="w-full text-sm [&_td]:border [&_td]:border-[var(--line)] [&_td]:p-2 [&_th]:border [&_th]:border-[var(--line)] [&_th]:bg-purple-500/10 [&_th]:p-2 [&_th]:text-left"><thead><tr>{s.table.head.map(h=><th key={h}>{h}</th>)}</tr></thead>
     <tbody>{s.table.rows.map((r,i)=><tr key={i}>{r.map((c,j)=><td key={j}>{c}</td>)}</tr>)}</tbody></table></div>}
    {s.note&&<p className="mt-2 rounded-lg border border-[var(--line)] bg-[var(--surface)] p-3 text-xs text-[var(--muted)]">{s.note}</p>}</section>)}
   <p className="mt-10 border-t border-[var(--line)] pt-6 text-sm text-[var(--muted)]">{doc.contact}</p>
   <p className="mt-6 flex flex-wrap gap-4 text-sm"><Link href="/terms" className="text-purple-400 underline">Terms</Link><Link href="/privacy" className="text-purple-400 underline">Privacy</Link><Link href="/signup" className="text-purple-400 underline">Create an account</Link></p>
  </main></div>}

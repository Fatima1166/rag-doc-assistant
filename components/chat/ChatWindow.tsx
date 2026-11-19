"use client"
import {useCallback,useEffect,useRef,useState} from "react";import Link from "next/link";import {toast} from "sonner";import {ArrowDown,Download,ExternalLink,Menu} from "lucide-react"
import {useChat,uid} from "@/lib/store";import {useDocs} from "@/lib/docs";import {API,streamChat} from "@/lib/api";import {useUser} from "@/lib/auth";import type {Source} from "@/lib/types"
import {MobileSidebar} from "@/components/layout/Sidebar";import {Dialog} from "@/components/ui/dialog";import {Tip} from "@/components/ui/tooltip"
import {MessageBubble} from "./MessageBubble";import {ChatInput} from "./ChatInput";import {EmptyState} from "./EmptyState";import {ScopePicker} from "./ScopePicker";import {Onboarding} from "./Onboarding"
export function ChatWindow(){
 const {convs,activeId,newChat,addMsg,patchMsg,truncateFrom,setScope}=useChat();const docs=useDocs(s=>s.docs);const conv=convs.find(c=>c.id===activeId)
 const [mounted,setMounted]=useState(false);const [busy,setBusy]=useState(false);const [drawer,setDrawer]=useState(false);const [src,setSrc]=useState<Source|null>(null);const [atBottom,setAtBottom]=useState(true);const [pendingScope,setPendingScope]=useState<string[]|undefined>()
 const list=useRef<HTMLDivElement>(null);const stick=useRef(true);const ctl=useRef<AbortController|null>(null);useEffect(()=>setMounted(true),[])
 useEffect(()=>()=>ctl.current?.abort(),[])
 // Load this user's conversations (local snapshot first, then reconciled with the server).
 const user=useUser()
 useEffect(()=>{useChat.getState().hydrate(user?user.email.toLowerCase():"default")},[user])
 const ready=docs.filter(d=>d.status==="ready")
 const run=useCallback(async(id:string,fresh=false)=>{const c=useChat.getState().convs.find(x=>x.id===id);if(!c)return
  const mid=uid();const hist=c.messages.filter(m=>!m.error&&m.content).map(m=>({role:m.role,content:m.content}))
  addMsg(id,{id:mid,role:"assistant",content:"",ts:Date.now()})
  const scope=useDocs.getState().docs.filter(d=>d.status==="ready"&&(!c.docIds||c.docIds.includes(d.id))).map(d=>({id:d.id,name:d.name,kind:d.kind}))
  const ac=new AbortController();ctl.current=ac;setBusy(true);stick.current=true
  try{const s=await streamChat({messages:hist,docs:scope,signal:ac.signal,fresh,onChunk:t=>patchMsg(id,mid,{content:t})});patchMsg(id,mid,{sources:s})}
  catch(e:any){if(e?.name==="AbortError"){const m=useChat.getState().convs.find(x=>x.id===id)?.messages.find(x=>x.id===mid);if(!m?.content)patchMsg(id,mid,{content:"*Stopped.*"})}else patchMsg(id,mid,{error:true,content:e?.message||"Something went wrong."})}
  finally{setBusy(false)}},[addMsg,patchMsg])
 const send=(t:string)=>{const text=t.trim();if(!text||busy)return;const id=activeId??newChat();if(pendingScope!==undefined){setScope(id,pendingScope);setPendingScope(undefined)}addMsg(id,{id:uid(),role:"user",content:text,ts:Date.now()});run(id)}
 // "Regenerate" has to mean a new answer, so it bypasses the server's answer cache.
 const regenerate=(mid:string)=>{if(busy||!activeId)return;truncateFrom(activeId,mid);run(activeId,true)}
 const edit=(mid:string,t:string)=>{if(busy||!activeId||!t.trim())return;truncateFrom(activeId,mid);addMsg(activeId,{id:uid(),role:"user",content:t.trim(),ts:Date.now()});run(activeId)}
 const onScroll=()=>{const el=list.current;if(!el)return;const near=el.scrollHeight-el.scrollTop-el.clientHeight<80;stick.current=near;setAtBottom(near)}
 useEffect(()=>{const el=list.current;if(el&&stick.current)el.scrollTo({top:el.scrollHeight})},[conv?.messages])
 useEffect(()=>{stick.current=true;list.current?.scrollTo({top:list.current.scrollHeight})},[activeId])
 const toBottom=()=>{stick.current=true;list.current?.scrollTo({top:list.current.scrollHeight,behavior:"smooth"})}
 const exportMd=()=>{if(!conv)return;const md=`# ${conv.title}\n\n`+conv.messages.map(m=>`**${m.role==="user"?"You":"RAGDocs"}:**\n\n${m.content}`+(m.sources?.length?`\n\nSources:\n${m.sources.map((s,i)=>`${i+1}. ${s.title}${s.page?` (p.${s.page})`:""}`).join("\n")}`:"")).join("\n\n---\n\n")
  const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([md],{type:"text/markdown"}));a.download=`${conv.title.replace(/[^\w-]+/g,"-")||"chat"}.md`;a.click();toast.success("Chat exported")}
 if(!mounted)return <div className="flex-1 p-6"><div className="skeleton h-12 rounded-xl"/><div className="skeleton mt-6 h-40 rounded-2xl"/></div>
 return <section className="flex min-w-0 flex-1 flex-col">
  <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-[var(--line)] p-4 backdrop-blur-xl">
   <button aria-label="Open menu" className="md:hidden" onClick={()=>setDrawer(true)}><Menu/></button>
   <div className="min-w-0 flex-1"><h1 className="truncate font-semibold">{conv?.title??"New chat"}</h1><p className="text-xs text-[var(--muted)]">{conv?.messages.length??0} messages</p></div>
   <ScopePicker docs={ready} selected={conv?conv.docIds:pendingScope} onChange={ids=>activeId?setScope(activeId,ids):setPendingScope(ids)}/>
   <Tip label="Export as Markdown"><button aria-label="Export chat" onClick={exportMd} disabled={!conv?.messages.length} className="glass grid size-10 place-items-center transition hover:scale-105 disabled:opacity-40"><Download size={18}/></button></Tip></header>
  <main id="main" className="relative flex-1 overflow-hidden">
   <div ref={list} onScroll={onScroll} className="h-full overflow-y-auto p-4">
    {!conv?.messages.length?<EmptyState onPick={send}/>:<div className="mx-auto max-w-3xl space-y-6">{conv.messages.map((m,i)=><MessageBubble key={m.id} m={m} last={i===conv.messages.length-1} busy={busy} onSource={setSrc} onRegenerate={()=>regenerate(m.id)} onEdit={t=>edit(m.id,t)}
     onFeedback={v=>{patchMsg(conv.id,m.id,{feedback:m.feedback===v?undefined:v});if(m.feedback!==v)toast("Thanks for the feedback")}}/>)}</div>}</div>
   {!atBottom&&<button aria-label="Scroll to latest message" onClick={toBottom} className="glass absolute bottom-4 left-1/2 grid size-10 -translate-x-1/2 place-items-center shadow-lg transition hover:scale-110"><ArrowDown size={18}/></button>}</main>
  <footer className="p-4"><ChatInput onSend={send} onStop={()=>ctl.current?.abort()} busy={busy}/><p className="mt-2 text-center text-xs text-[var(--muted)]">Answers come only from your indexed documents.</p></footer>
  <MobileSidebar open={drawer} onClose={()=>setDrawer(false)}/><Onboarding/>
  <Dialog open={!!src} onClose={()=>setSrc(null)} title={src?`${src.title}${src.page?` · page ${src.page}`:""}`:""}><blockquote className="border-l-2 border-purple-500 pl-3 text-sm text-[var(--muted)]">{src?.snippet}</blockquote>
   {src?.url.startsWith("http")?<a href={src.url} target="_blank" rel="noreferrer" className="mt-4 inline-flex items-center gap-1 text-sm text-purple-400 underline">Open original source <ExternalLink size={14}/></a>:<Link href="/documents" onClick={()=>setSrc(null)} className="mt-4 inline-flex items-center gap-1 text-sm text-purple-400 underline">View in Documents</Link>}</Dialog></section>}

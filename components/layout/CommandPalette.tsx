"use client"
import {useEffect,useMemo,useState} from "react";import {usePathname,useRouter} from "next/navigation";import {useTheme} from "next-themes";import {Home,MessageSquare,FileText,Settings,Plus,Moon,Search,TextSearch,Loader2,XCircle} from "lucide-react";import {useQuery} from "@tanstack/react-query"
import {Dialog} from "@/components/ui/dialog";import {useChat} from "@/lib/store";import {API,searchDocs} from "@/lib/api";import {around} from "@/lib/utils"
export function CommandPalette(){
 const path=usePathname();const r=useRouter();const {resolvedTheme,setTheme}=useTheme();const {convs,newChat,setActive}=useChat()
 const [open,setOpen]=useState(false);const [q,setQ]=useState("");const [i,setI]=useState(0);const [dq,setDq]=useState("")
 useEffect(()=>{const k=(e:KeyboardEvent)=>{if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==="k"){e.preventDefault();setOpen(o=>!o)}};const o=()=>setOpen(true)
  addEventListener("keydown",k);addEventListener("open-palette",o);return()=>{removeEventListener("keydown",k);removeEventListener("open-palette",o)}},[])
 // Debounced so a full-text search isn't fired on every keystroke.
 useEffect(()=>{if(!open||!q.trim()){setDq("");return}const t=setTimeout(()=>setDq(q.trim()),300);return()=>clearTimeout(t)},[q,open])
 const items=useMemo(()=>{const go=(h:string)=>()=>r.push(h);const dark=resolvedTheme==="dark"
  const all:{l:string;I:any;f:()=>void;sub?:string}[]=[{l:"New chat",I:Plus,f:()=>{newChat();r.push("/chat")}},{l:"Go to Chat",I:MessageSquare,f:go("/chat")},{l:"Go to Documents",I:FileText,f:go("/documents")},{l:"Go to Settings",I:Settings,f:go("/settings")},{l:"Go to Home",I:Home,f:go("/")},{l:`Switch to ${dark?"light":"dark"} theme`,I:Moon,f:()=>setTheme(dark?"light":"dark")},
   ...(API&&dq.length>=2?[{l:`Search document text for “${dq}”`,I:TextSearch,sub:"Full text",f:go(`/documents?q=${encodeURIComponent(dq)}`)}]:[]),
   ...convs.map(c=>({l:c.title,I:MessageSquare,sub:"Conversation",f:()=>{setActive(c.id);r.push("/chat")}}))]
  return all.filter(x=>x.l.toLowerCase().includes(q.toLowerCase())).slice(0,9)},[q,dq,convs,resolvedTheme,r,newChat,setActive,setTheme])
 useEffect(()=>setI(0),[q])
 const close=()=>{setOpen(false);setQ("");setDq("")};const run=(n:number)=>{items[n]?.f();close()}
 const hits=useQuery({queryKey:["palette-search",dq],queryFn:()=>searchDocs(dq,undefined,8),enabled:open&&!!API&&dq.length>=2,staleTime:30_000})
 const shown=useMemo(()=>{const m=new Map<string,{id:string;name:string;snippet:string}>()
  for(const h of hits.data??[]){if(m.has(h.doc_id))continue;m.set(h.doc_id,{id:h.doc_id,name:h.doc_name,snippet:around(h.text,dq)})}
  return [...m.values()].slice(0,4)},[hits.data,dq])
 if(!["/chat","/documents","/settings"].some(p=>path.startsWith(p)))return null
 return <Dialog open={open} onClose={close} title="Command palette" bare>
  <div className="flex items-center gap-2 border-b border-[var(--line)] px-4"><Search size={16} className="text-[var(--muted)]"/>
   <input data-autofocus value={q} onChange={e=>setQ(e.target.value)} role="combobox" aria-expanded="true" aria-controls="palette-list" aria-label="Search chats, commands or document text" placeholder="Search chats, commands or document text…" className="w-full bg-transparent py-3 outline-none"
    onKeyDown={e=>{if(e.key==="ArrowDown"){e.preventDefault();setI(x=>Math.min(x+1,items.length-1))}else if(e.key==="ArrowUp"){e.preventDefault();setI(x=>Math.max(x-1,0))}else if(e.key==="Enter")run(i)}}/></div>
  <ul id="palette-list" role="listbox" aria-label="Commands and conversations" className="max-h-64 overflow-y-auto p-2">{items.map((x,n)=><li key={x.l+n} role="option" aria-selected={n===i}><button tabIndex={-1} onMouseEnter={()=>setI(n)} onClick={()=>run(n)} className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm ${n===i?"bg-purple-500/20":""}`}><x.I size={16}/><span className="truncate">{x.l}</span>{x.sub&&<span className="ml-auto text-xs text-[var(--muted)]">{x.sub}</span>}</button></li>)}
   {!items.length&&!shown.length&&<li className="p-4 text-center text-sm text-[var(--muted)]">No results</li>}</ul>
  {API&&dq.length>=2&&<div role="region" aria-label="Matches inside documents" className="border-t border-[var(--line)] p-2">
   {hits.isFetching&&!hits.data&&<p className="flex items-center gap-2 px-3 py-2 text-xs text-[var(--muted)]"><Loader2 size={13} className="animate-spin"/>Searching indexed text…</p>}
   {hits.isError&&<p className="flex items-center gap-2 px-3 py-2 text-xs text-red-400"><XCircle size={13}/>Text search failed</p>}
   {!!shown.length&&<><p className="px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wider text-[var(--muted)]">Inside documents</p>
    {shown.map(h=><button key={h.id} onClick={()=>{close();r.push(`/documents?q=${encodeURIComponent(dq)}&open=${h.id}`)}} className="flex w-full items-start gap-3 rounded-lg px-3 py-2 text-left transition hover:bg-purple-500/15">
     <TextSearch size={16} className="mt-0.5 shrink-0 text-purple-400"/><span className="min-w-0 flex-1"><span className="block truncate text-sm">{h.name}</span><span className="line-clamp-1 text-xs text-[var(--muted)]">{h.snippet}</span></span></button>)}</>}
   {!hits.isFetching&&!hits.isError&&hits.data&&!hits.data.length&&<p className="px-3 py-2 text-xs text-[var(--muted)]">No indexed passage contains “{dq}”.</p>}</div>}
 </Dialog>}

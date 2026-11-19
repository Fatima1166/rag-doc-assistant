"use client"
import {useEffect,useMemo,useRef,useState} from "react";import {useRouter} from "next/navigation";import {motion} from "framer-motion";import {toast} from "sonner";import {useQuery,useQueryClient} from "@tanstack/react-query"
import {FileText,Link2,Type,CheckCircle2,Loader2,XCircle,UploadCloud,Layers,Files,Clock,Search,MessageSquarePlus,Pencil,Tag,X,AlertTriangle,RefreshCw,ChevronLeft,ChevronRight,TextSearch} from "lucide-react"
import {useDocs,stageName,type Doc} from "@/lib/docs";import {API,listDocs,deleteDoc,deleteDocs,reindexDoc,fetchDocChunks,patchDoc,searchDocs,type SearchHit} from "@/lib/api";import {useIngest} from "@/lib/ingest";import {timeAgo,around} from "@/lib/utils";import {ACCEPT,KIND_LABEL,MAX_MB} from "@/lib/files";import {useChat} from "@/lib/store"
import {AppShell} from "@/components/layout/Sidebar";import {Dropdown} from "@/components/ui/dropdown";import {Dialog} from "@/components/ui/dialog";import {Tabs} from "@/components/ui/tabs"
const ICON={pdf:FileText,url:Link2,text:Type} as const
type Filter="all"|"ready"|"indexing"|"error"
type Kind="all"|"pdf"|"url"|"text"
type Chunk={id?:number;ord?:number;page?:number|null;url?:string|null;text:string}
const PER=[12,24,48],CHUNK_STEP=10,TAG_MAX=8,TAG_LEN=24 // tag limits mirror the backend
/** Case-insensitive <mark> highlighting for the in-document chunk search. */
function Hl({t,q}:{t:string;q:string}){const n=q.trim();if(!n)return <>{t}</>
 const re=new RegExp("("+n.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")+")","gi")
 return <>{t.split(re).map((p,i)=>p.toLowerCase()===n.toLowerCase()? <mark key={i} className="rounded bg-purple-500/40 px-0.5 text-[var(--fg)]">{p}</mark> : <span key={i}>{p}</span>)}</>}
export default function Documents(){
 const {docs,remove,patch,reindex,setAll,add}=useDocs();const ingest=useIngest();const qc=useQueryClient();const router=useRouter()
 const [drag,setDrag]=useState(false);const [url,setUrl]=useState("");const [q,setQ]=useState("");const [dq,setDq]=useState("");const [sort,setSort]=useState("new");const [f,setF]=useState<Filter>("all");const [kind,setKind]=useState<Kind>("all");const [tag,setTag]=useState<string|null>(null)
 const [page,setPage]=useState(0);const [per,setPer]=useState(PER[0]);const [sel,setSel]=useState<string[]>([])
 const [view,setView]=useState<Doc|null>(null);const [chunks,setChunks]=useState<Chunk[]>([]);const [cq,setCq]=useState("");const [shown,setShown]=useState(CHUNK_STEP);const [h,setH]=useState(false)
 const [edit,setEdit]=useState<Doc|null>(null);const [nm,setNm]=useState("");const [tags,setTags]=useState<string[]>([]);const [tin,setTin]=useState("");const [busy,setBusy]=useState(false)
 const [bulk,setBulk]=useState(false);const [openId,setOpenId]=useState("");const pick=useRef<HTMLInputElement>(null);useEffect(()=>setH(true),[])
 // Opened from a content hit: seed the in-document search with the term that matched.
 const seedCq=useRef("")
 useEffect(()=>{if(view&&API){setChunks([]);fetchDocChunks(view.id).then(r=>setChunks(r.chunks||[])).catch(()=>setChunks([]))}else setChunks([]);setCq(seedCq.current);seedCq.current="";setShown(CHUNK_STEP)},[view])
 useEffect(()=>{setPage(0)},[f,dq,sort,kind,tag])
 useEffect(()=>{const live=new Set(docs.map(d=>d.id));setSel(s=>s.filter(id=>live.has(id)))},[docs])
 // Deep link: /documents?q=...&open=<id> arrives from the command palette.
 useEffect(()=>{const p=new URLSearchParams(location.search);const v=p.get("q");if(v)setQ(v);const o=p.get("open");if(o)setOpenId(o)},[])
 useEffect(()=>{if(!openId)return;const d=docs.find(x=>x.id===openId);if(d){seedCq.current=q.trim();setView(d);setOpenId("")}},[openId,docs,q])
 useEffect(()=>{if(!q.trim())return;const t=setTimeout(()=>setDq(q.trim()),300);return()=>clearTimeout(t)},[q])
 const query=useQuery({queryKey:["docs"],queryFn:listDocs,enabled:!!API,refetchInterval:qq=>(qq.state.data as Doc[]|undefined)?.some(d=>d.status==="indexing")?2000:false})
 useEffect(()=>{if(query.data)setAll(query.data)},[query.data,setAll])
 const act=async(fn:()=>Promise<void>,local:()=>void,msg:string)=>{try{if(API){await fn();qc.invalidateQueries({queryKey:["docs"]})}else local();toast(msg)}catch(e:any){toast.error(e.message)}}
 const del=(d:Doc)=>act(()=>deleteDoc(d.id),()=>remove(d.id),"Document deleted")
 const re=(d:Doc)=>act(()=>reindexDoc(d.id),()=>{if(d.status==="error"){remove(d.id);add(d.name.replace("fail",""),d.kind,d.size)}else reindex(d.id)},"Indexing started")
 const delBulk=async()=>{const ids=sel;setBusy(true)
 try{if(API){const n=await deleteDocs(ids);qc.invalidateQueries({queryKey:["docs"]});toast.success(`${n} document${n===1?"":"s"} deleted`)}
 else{ids.forEach(remove);toast.success(`${ids.length} document${ids.length===1?"":"s"} deleted`)}
 setSel([]);setBulk(false)}catch(e:any){toast.error(e.message)}finally{setBusy(false)}}
 /** Open a fresh chat already scoped to the selection. */
 const useInChat=(ids:string[])=>{if(!ids.length)return;const c=useChat.getState();const id=c.newChat();c.setScope(id,ids);router.push("/chat");toast.success(`New chat scoped to ${ids.length} source${ids.length===1?"":"s"}`)}
 const openEdit=(d:Doc)=>{setEdit(d);setNm(d.name);setTags(d.tags??[]);setTin("")}
 const addTag=(raw:string)=>{const t=raw.trim().replace(/,/g,"").slice(0,TAG_LEN);if(!t)return
  if(tags.includes(t))return void setTin("");if(tags.length>=TAG_MAX)return void toast.error(`${TAG_MAX} tags maximum`)
  setTags(x=>[...x,t]);setTin("")}
 const saveEdit=async()=>{if(!edit)return;if(!nm.trim())return void toast.error("Name can't be empty");setBusy(true)
 try{const clean=tags.map(t=>t.trim()).filter(Boolean)
  if(API){const d=await patchDoc(edit.id,{name:nm.trim(),tags:clean});patch(d.id,{name:d.name,tags:d.tags});qc.invalidateQueries({queryKey:["docs"]})}
  else patch(edit.id,{name:nm.trim(),tags:clean})
  setEdit(null);toast.success("Document updated")}catch(e:any){toast.error(e.message)}finally{setBusy(false)}}
 const ready=docs.filter(d=>d.status==="ready").length,idx=docs.filter(d=>d.status==="indexing").length,bad=docs.filter(d=>d.status==="error").length
 const stats=[[Files,"Documents",docs.length],[Layers,"Chunks",docs.reduce((a,d)=>a+d.chunks,0)],[CheckCircle2,"Ready",ready],[Clock,"Indexing",idx]] as const
 const tabs:{id:Filter;label:string;count:number}[]=[{id:"all",label:"All",count:docs.length},{id:"ready",label:"Ready",count:ready},{id:"indexing",label:"Indexing",count:idx},{id:"error",label:"Failed",count:bad}]
 const kinds:{id:Kind;label:string;count:number}[]=[{id:"all",label:"All types",count:docs.length},{id:"pdf",label:"PDF",count:docs.filter(d=>d.kind==="pdf").length},{id:"url",label:"URL",count:docs.filter(d=>d.kind==="url").length},{id:"text",label:"Text",count:docs.filter(d=>d.kind==="text").length}]
 const allTags=useMemo(()=>[...new Set(docs.flatMap(d=>d.tags??[]))].sort((a,b)=>a.localeCompare(b)),[docs])
 const list=useMemo(()=>docs.filter(d=>(f==="all"||d.status===f)&&(kind==="all"||d.kind===kind)&&(!tag||d.tags?.includes(tag))&&d.name.toLowerCase().includes(q.toLowerCase())).sort((a,b)=>sort==="name"?a.name.localeCompare(b.name):sort==="chunks"?b.chunks-a.chunks:b.at-a.at),[docs,f,q,sort,kind,tag])
 const pages=Math.max(1,Math.ceil(list.length/per)),cur=Math.min(page,pages-1),visible=list.slice(cur*per,cur*per+per)
 const allPicked=list.length>0&&list.every(d=>sel.includes(d.id))
 const toggle=(id:string)=>setSel(s=>s.includes(id)?s.filter(x=>x!==id):[...s,id])
 const toggleAll=()=>setSel(allPicked?[]:list.map(d=>d.id))
 const matchChunks=useMemo(()=>{const n=cq.trim().toLowerCase();return n?chunks.filter(c=>c.text.toLowerCase().includes(n)):chunks},[chunks,cq])
 /** Real index search: matches the text of indexed passages, not just file names. */
 const content=useQuery({queryKey:["docs-content",dq],queryFn:()=>searchDocs(dq,undefined,12),enabled:!!API&&dq.length>=2,staleTime:30_000})
 const docHits=useMemo(()=>{const m=new Map<string,{doc:Doc;hits:number;page:number|null;snippet:string}>()
  for(const h of (content.data??[]) as SearchHit[]){const d=docs.find(x=>x.id===h.doc_id);if(!d)continue
   const e=m.get(d.id);if(e)e.hits++;else m.set(d.id,{doc:d,hits:1,page:h.page??null,snippet:around(h.text,dq,20)})}
  return [...m.values()]},[content.data,docs,dq])
 return <AppShell><main id="main" className="mx-auto w-full max-w-5xl p-6">
  <header className="mb-6"><h1 className="text-3xl font-bold">Documents</h1><p className="text-[var(--muted)]">Everything your assistant can answer from. {KIND_LABEL} up to {MAX_MB} MB, or a public URL.</p></header>
  {!h?<div className="skeleton h-32 rounded-2xl"/>:<>
  {query.isError&&<div role="alert" className="glass mb-4 flex items-center gap-3 border-red-500/40 bg-red-500/5 p-4"><XCircle className="shrink-0 text-red-400"/><p className="flex-1 text-sm">Couldn't load your documents from the server.</p><button onClick={()=>query.refetch()} className="rounded-xl bg-red-600 px-4 py-1.5 text-sm text-white transition hover:scale-105">Retry</button></div>}
  {!!bad&&<div role="alert" className="glass mb-4 border-red-500/40 bg-red-500/5 p-4"><p className="flex items-center gap-2 text-sm font-medium"><AlertTriangle size={16} className="text-red-400"/>{bad} document{bad===1?"":"s"} failed to index</p>
   <ul className="mt-2 space-y-1 text-sm text-[var(--muted)]">{docs.filter(d=>d.status==="error").map(d=><li key={d.id} className="flex items-center gap-2"><div className="min-w-0 flex-1"><span className="block truncate">{d.name}</span>{d.error&&<span className="block truncate text-red-400/80" title={d.error}>{d.error}</span>}</div><button onClick={()=>re(d)} className="inline-flex items-center gap-1 rounded-lg px-2 py-0.5 text-xs transition hover:bg-purple-500/15 hover:text-[var(--fg)]"><RefreshCw size={12}/>Retry</button><button onClick={()=>del(d)} aria-label={`Remove failed document ${d.name}`} className="rounded-lg p-1 text-xs transition hover:bg-red-500/15 hover:text-red-300"><X size={12}/></button></li>)}</ul>
   <div className="mt-3 flex flex-wrap gap-2"><button onClick={()=>docs.filter(d=>d.status==="error").forEach(re)} className="rounded-xl bg-red-600 px-4 py-1.5 text-sm text-white transition hover:scale-105">Retry all</button><button onClick={()=>setSel(docs.filter(d=>d.status==="error").map(d=>d.id))} className="glass px-4 py-1.5 text-sm transition hover:scale-105">Select all failed</button></div></div>}
  <section className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4" aria-label="Stats">{stats.map(([I,l,v],i)=><motion.div key={l} initial={{opacity:0,y:12}} animate={{opacity:1,y:0}} transition={{delay:i*.08}} className="glass p-4"><span className="grad grid size-9 place-items-center rounded-lg text-white"><I size={18}/></span><p className="mt-3 text-2xl font-bold">{v}</p><p className="text-sm text-[var(--muted)]">{l}</p></motion.div>)}</section>
  <section aria-label="Upload documents" onDragOver={e=>{e.preventDefault();setDrag(true)}} onDragLeave={()=>setDrag(false)} onDrop={e=>{e.preventDefault();setDrag(false);ingest.files(e.dataTransfer.files)}} className={`glass border-2 border-dashed p-8 text-center transition sm:p-10 ${drag?"scale-[1.01] border-purple-500 bg-purple-500/10":""}`}>
   <motion.div animate={{y:[0,-8,0],scale:drag?1.25:1}} transition={{y:{duration:3,repeat:Infinity}}}><UploadCloud className="mx-auto text-purple-400" size={44}/></motion.div>
   <p className="mt-3 font-medium">{drag?"Drop to upload":"Drop files here"}</p>
   <button onClick={()=>pick.current?.click()} className="mt-1 text-sm text-purple-400 underline">or browse files</button><input ref={pick} type="file" multiple accept={ACCEPT} hidden onChange={e=>{ingest.files(e.target.files);e.target.value=""}}/>
   <form className="mx-auto mt-6 flex max-w-lg gap-2" onSubmit={e=>{e.preventDefault();if(url.trim())ingest.url(url.trim()).then(ok=>ok&&setUrl(""))}}>
    <input value={url} onChange={e=>setUrl(e.target.value)} type="url" placeholder="Or paste a documentation URL" aria-label="Documentation URL" className="min-w-0 flex-1 rounded-xl border border-[var(--line)] bg-transparent px-3 py-2 outline-none focus:border-purple-500 focus:shadow-[0_0_0_3px_rgba(168,85,247,.25)]"/>
    <button className="grad rounded-xl px-5 text-white transition hover:scale-105 active:scale-95">Index</button></form></section>
  <div className="mt-8 flex flex-wrap items-center justify-between gap-3"><Tabs label="Filter documents by status" value={f} onChange={setF} items={tabs}/>
   <div className="flex flex-1 gap-2 sm:flex-none"><label className="relative flex-1 sm:w-56"><span className="sr-only">Search documents</span><Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]"/><input value={q} onChange={e=>setQ(e.target.value)} placeholder="Search" className="glass w-full py-2 pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-purple-500"/></label>
    <select aria-label="Filter by type" value={kind} onChange={e=>setKind(e.target.value as Kind)} className="glass bg-[var(--bg)] px-3 text-sm outline-none focus:ring-2 focus:ring-purple-500">{kinds.map(k=><option key={k.id} value={k.id}>{k.label}{k.id!=="all"?` (${k.count})`:` (${k.count})`}</option>)}</select>
    <select aria-label="Sort documents" value={sort} onChange={e=>setSort(e.target.value)} className="glass bg-[var(--bg)] px-3 text-sm outline-none focus:ring-2 focus:ring-purple-500"><option value="new">Newest</option><option value="name">Name</option><option value="chunks">Most chunks</option></select></div></div>
  {!!allTags.length&&<div className="mt-3 flex flex-wrap items-center gap-2" aria-label="Filter by tag"><span className="text-xs uppercase tracking-wider text-[var(--muted)]">Tags</span>{allTags.map(t=>{const on=tag===t;return <button key={t} onClick={()=>setTag(on?null:t)} aria-pressed={on} className={`rounded-full border px-3 py-1 text-xs transition ${on?"grad border-transparent text-white":"border-[var(--line)] text-[var(--muted)] hover:text-[var(--fg)]"}`}>{t}</button>})}{tag&&<button onClick={()=>setTag(null)} className="inline-flex items-center gap-1 text-xs text-purple-400 underline">Clear</button>}</div>}
  {API&&dq.trim().length>=2&&<section aria-label="Matches inside documents" className="glass mt-4 p-3">
   {content.isFetching&&!content.data&&<p className="flex items-center gap-2 text-sm text-[var(--muted)]"><Loader2 size={14} className="animate-spin"/>Searching indexed text…</p>}
   {content.isError&&<p className="flex flex-wrap items-center gap-2 text-sm text-red-400">Content search failed.<button onClick={()=>content.refetch()} className="inline-flex items-center gap-1 underline">Retry<RefreshCw size={12}/></button></p>}
   {!content.isError&&content.data&&!docHits.length&&<p className="text-sm text-[var(--muted)]">No indexed passage contains “{dq}”. Try fewer or more common words.</p>}
   {!!docHits.length&&<><p className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-[var(--muted)]"><TextSearch size={13}/>Found inside the text · {docHits.length} document{docHits.length===1?"":"s"}</p>
    <ul className="space-y-0.5">{docHits.map(({doc,hits,page,snippet})=><li key={doc.id}><button onClick={()=>{seedCq.current=dq;setView(doc)}} className="flex w-full items-start gap-2 rounded-lg px-2 py-1.5 text-left transition hover:bg-purple-500/10">
     <span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium"><Hl t={doc.name} q={dq}/></span><span className="line-clamp-1 text-xs text-[var(--muted)]">{page!=null?`p.${page} · `:""}<Hl t={snippet} q={dq}/></span></span>
     <span className="shrink-0 rounded-full border border-[var(--line)] px-2 py-0.5 text-[11px] tabular-nums text-[var(--muted)]">{hits} hit{hits===1?"":"s"}</span></button></li>)}</ul></>}
  </section>}
  {!!sel.length&&<div role="toolbar" aria-label="Bulk actions" className="glass mt-4 flex flex-wrap items-center gap-2 border-purple-500/40 bg-purple-500/5 p-3"><span className="text-sm font-medium">{sel.length} selected</span>
    <button onClick={toggleAll} className="glass px-3 py-1.5 text-xs transition hover:scale-105">{allPicked?"Deselect all":"Select all"}</button>
    {sel.length===1&&<button onClick={()=>{const d=docs.find(x=>x.id===sel[0]);d&&openEdit(d)}} className="glass inline-flex items-center gap-1.5 px-3 py-1.5 text-xs transition hover:scale-105"><Pencil size={12}/>Rename</button>}
    <button onClick={()=>useInChat(sel)} className="glass inline-flex items-center gap-1.5 px-3 py-1.5 text-xs transition hover:scale-105"><MessageSquarePlus size={12}/>Ask in a new chat</button>
    <button onClick={()=>setBulk(true)} className="inline-flex items-center gap-1.5 rounded-xl bg-red-600 px-3 py-1.5 text-xs text-white transition hover:scale-105"><XCircle size={12}/>Delete</button>
    <button onClick={()=>setSel([])} aria-label="Clear selection" className="ml-auto rounded-lg p-1.5 text-[var(--muted)] transition hover:text-[var(--fg)]"><X size={14}/></button></div>}
  <section className="mt-4 space-y-3" aria-label="Documents">{!docs.length?<div className="glass p-12 text-center"><FileText className="mx-auto text-purple-400" size={40}/><h2 className="mt-3 text-xl font-bold">No documents yet</h2><p className="text-[var(--muted)]">Upload a file or paste a URL to get started.</p>{!API&&<button onClick={useDocs.getState().addSamples} className="grad mt-4 rounded-xl px-5 py-2 text-white transition hover:scale-105">Load sample documentation</button>}</div>
   :!list.length?<p className="glass p-8 text-center text-[var(--muted)]">No documents match your filters{tag?` (tag “${tag}”)`:""}.</p>
   :visible.map((d,i)=>{const I=ICON[d.kind];const on=sel.includes(d.id);return <motion.article key={d.id} initial={{opacity:0,x:-12}} animate={{opacity:1,x:0}} transition={{delay:Math.min(i,8)*.06}} className={`glass group relative flex items-center gap-3 p-4 hover:z-20 focus-within:z-20 ${d.status==="error"?"border-red-500/40 bg-red-500/5":""} ${on?"border-purple-500/60 bg-purple-500/10":""}`}>
    <input type="checkbox" checked={on} onChange={()=>toggle(d.id)} aria-label={`Select ${d.name}`} className="size-4 shrink-0 accent-purple-500"/>
    <I className="shrink-0 text-purple-400"/><div className="min-w-0 flex-1"><p className="truncate font-medium"><Hl t={d.name} q={q}/></p>
     {d.status==="error"&&<p className="line-clamp-2 text-xs text-red-400" title={d.error||undefined}>{d.error||"Indexing failed. Choose Retry from the menu."}</p>}<p className="text-xs text-[var(--muted)]">{d.chunks} chunks · {d.size}{!!d.pages&&` · ${d.pages} page${d.pages===1?"":"s"}`} · {timeAgo(d.at)}</p>
     {!!d.tags?.length&&<span className="mt-1.5 flex flex-wrap gap-1">{d.tags.map(t=><button key={t} onClick={()=>setTag(t)} className="inline-flex items-center gap-1 rounded-full border border-[var(--line)] px-2 py-0.5 text-[11px] text-[var(--muted)] transition hover:border-purple-500/50 hover:text-[var(--fg)]"><Tag size={10}/>{t}</button>)}</span>}
    {d.status==="indexing"&&<div className="mt-2"><div className="flex items-baseline justify-between gap-2 text-xs text-[var(--muted)]"><span>{stageName(d)}</span><span className="tabular-nums">{d.progress}%</span></div><div className="mt-1 h-1.5 overflow-hidden rounded bg-[var(--line)]" role="progressbar" aria-label={`Indexing ${d.name}`} aria-valuenow={d.progress} aria-valuemax={100}><div className="grad h-full transition-all" style={{width:`${d.progress}%`}}/></div></div>}</div>
    {d.status==="ready"?<CheckCircle2 className="shrink-0 text-green-500" aria-label="Ready"/>:d.status==="indexing"?<Loader2 className="shrink-0 animate-spin text-purple-400" aria-label="Indexing"/>:<XCircle className="shrink-0 text-red-500" aria-label="Failed"/>}
    <Dropdown label={`Actions for ${d.name}`} items={[{text:"Preview",onClick:()=>setView(d)},{text:"Rename & tag",onClick:()=>openEdit(d)},{text:"Ask in a new chat",onClick:()=>useInChat([d.id])},...(d.status!=="indexing"?[{text:d.status==="error"?"Retry":"Re-index",onClick:()=>re(d)}]:[]),{text:"Delete",danger:true,onClick:()=>del(d)}]}/></motion.article>})}
  {list.length>per&&<div className="mt-4 flex flex-wrap items-center justify-between gap-3"><p className="text-sm text-[var(--muted)]">Showing {cur*per+1}–{Math.min(list.length,(cur+1)*per)} of {list.length}</p>
    <div className="flex items-center gap-2"><select aria-label="Documents per page" value={per} onChange={e=>{setPer(Number(e.target.value));setPage(0)}} className="glass bg-[var(--bg)] px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-purple-500">{PER.map(n=><option key={n} value={n}>{n}</option>)}</select>
     <button aria-label="Previous page" disabled={cur===0} onClick={()=>setPage(cur-1)} className="glass grid size-8 place-items-center transition hover:scale-105 disabled:opacity-40"><ChevronLeft size={16}/></button><span className="text-sm tabular-nums">{cur+1} / {pages}</span>
     <button aria-label="Next page" disabled={cur>=pages-1} onClick={()=>setPage(cur+1)} className="glass grid size-8 place-items-center transition hover:scale-105 disabled:opacity-40"><ChevronRight size={16}/></button></div></div>}</section></>}
  <Dialog open={!!view} onClose={()=>setView(null)} title={view?.name??"Document"}>{view&&<><dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4"><div><dt className="text-[var(--muted)]">Type</dt><dd className="uppercase">{view.kind}</dd></div><div><dt className="text-[var(--muted)]">Status</dt><dd className="capitalize">{view.status}</dd></div><div><dt className="text-[var(--muted)]">Chunks</dt><dd>{view.chunks}</dd></div><div><dt className="text-[var(--muted)]">Size</dt><dd>{view.size}</dd></div>{!!view.pages&&<div><dt className="text-[var(--muted)]">Pages</dt><dd>{view.pages}</dd></div>}</dl>
   {!!view.tags?.length&&<div className="mt-3 flex flex-wrap gap-1.5">{view.tags.map(t=><span key={t} className="rounded-full border border-[var(--line)] px-2 py-0.5 text-xs text-[var(--muted)]">{t}</span>)}</div>}
   {API&&<label className="relative mt-4 block"><span className="sr-only">Search inside this document</span><Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]"/><input value={cq} onChange={e=>setCq(e.target.value)} placeholder="Search inside this document…" className="glass w-full py-2 pl-9 pr-9 text-sm outline-none focus:ring-2 focus:ring-purple-500"/>{cq&&<button aria-label="Clear in-document search" onClick={()=>{setCq("");setShown(CHUNK_STEP)}} className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--muted)] hover:text-[var(--fg)]"><X size={15}/></button>}</label>}
   {API&&chunks.length>0&&<div className="mt-4 space-y-2 overflow-y-auto pr-1" style={{maxHeight:"40vh"}}>
     <p className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">{cq?`${matchChunks.length} of ${chunks.length} chunks match`:`Indexed chunks (${chunks.length})`}</p>
     {!matchChunks.length&&<p className="glass p-4 text-center text-sm text-[var(--muted)]">No chunk contains “{cq}”.</p>}
     {matchChunks.slice(0,shown).map((c,idx)=><div key={idx} className="rounded-lg border border-[var(--line)] bg-[var(--surface)] p-2.5 text-xs text-[var(--muted)]"><p className="mb-1 font-mono text-[10px] text-[var(--muted)]">Chunk {(c.ord??idx)+1}{c.page!=null&&` · Page ${c.page}`}</p><p className="leading-relaxed"><Hl t={c.text} q={cq}/></p></div>)}
     {matchChunks.length>shown&&<button onClick={()=>setShown(s=>s+CHUNK_STEP)} className="glass w-full py-2 text-sm transition hover:scale-[1.01]">Show {Math.min(CHUNK_STEP,matchChunks.length-shown)} more of {matchChunks.length-shown} remaining</button>}
     {shown>CHUNK_STEP&&<button onClick={()=>setShown(CHUNK_STEP)} className="w-full py-1 text-xs text-[var(--muted)] underline">Collapse</button>}</div>}
   {!API&&<blockquote className="mt-4 border-l-2 border-purple-500 pl-3 text-sm text-[var(--muted)]"><span className="mb-1 block text-xs uppercase tracking-wide">Sample excerpt (demo)</span>Pass your API key in the Authorization header as a Bearer token. Keys are scoped per project.</blockquote>}
   <div className="mt-4 flex flex-wrap gap-4">{view.kind==="url"?<a href={view.name} target="_blank" rel="noreferrer" className="text-sm text-purple-400 underline">Open original page</a>:API&&<a href={`${API}/api/documents/${view.id}/download`} download className="text-sm text-purple-400 underline">Download original file</a>}
    <button onClick={()=>{setView(null);useInChat([view.id])}} className="text-sm text-purple-400 underline">Ask in a new chat</button></div></>}</Dialog>
  <Dialog open={!!edit} onClose={()=>setEdit(null)} title="Rename & tag document"><div className="space-y-4">
    <div><label htmlFor="doc-name" className="text-sm">Name</label><input id="doc-name" data-autofocus value={nm} onChange={e=>setNm(e.target.value)} maxLength={200} className="mt-1 w-full rounded-xl border border-[var(--line)] bg-transparent px-3 py-2 outline-none focus:border-purple-500 focus:shadow-[0_0_0_3px_rgba(168,85,247,.25)]"/></div>
    <div><label htmlFor="doc-tag" className="text-sm">Tags <span className="text-[var(--muted)]">({tags.length}/{TAG_MAX}, Enter to add)</span></label>
     <input id="doc-tag" value={tin} onChange={e=>setTin(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"||e.key===","){e.preventDefault();addTag(tin)}else if(e.key==="Backspace"&&!tin&&tags.length)setTags(x=>x.slice(0,-1))}} placeholder={tags.length?"e.g. api, reference":"e.g. api"} className="mt-1 w-full rounded-xl border border-[var(--line)] bg-transparent px-3 py-2 outline-none focus:border-purple-500 focus:shadow-[0_0_0_3px_rgba(168,85,247,.25)]"/>
     {!!tags.length&&<span className="mt-2 flex flex-wrap gap-1.5">{tags.map(t=><span key={t} className="inline-flex items-center gap-1 rounded-full bg-purple-500/15 px-2.5 py-1 text-xs"><span className="grad-text font-medium">{t}</span><button aria-label={`Remove tag ${t}`} onClick={()=>setTags(x=>x.filter(y=>y!==t))} className="text-[var(--muted)] hover:text-[var(--fg)]"><X size={12}/></button></span>)}</span>}</div>
    <p className="text-xs text-[var(--muted)]">Renaming never re-indexes the document — your chunks and citations stay put.</p>
    <div className="flex justify-end gap-2"><button onClick={()=>setEdit(null)} className="glass px-4 py-2 text-sm">Cancel</button><button onClick={saveEdit} disabled={busy} className="grad rounded-xl px-4 py-2 text-sm text-white transition hover:scale-105 active:scale-95 disabled:opacity-60">{busy?"Saving…":"Save"}</button></div></div></Dialog>
  <Dialog open={bulk} onClose={()=>setBulk(false)} title="Delete selected documents?"><p className="text-sm text-[var(--muted)]">{sel.length} document{sel.length===1?"":"s"} will be removed with all of their chunks. This can't be undone.</p>
   <ul className="mt-3 max-h-40 space-y-1 overflow-y-auto text-sm">{docs.filter(d=>sel.includes(d.id)).map(d=><li key={d.id} className="truncate">{d.name}</li>)}</ul>
   <div className="mt-4 flex justify-end gap-2"><button data-autofocus onClick={()=>setBulk(false)} className="glass px-4 py-2 text-sm">Cancel</button><button onClick={delBulk} disabled={busy} className="rounded-xl bg-red-600 px-4 py-2 text-sm text-white transition hover:scale-105 disabled:opacity-60">{busy?"Deleting…":`Delete ${sel.length}`}</button></div></Dialog></main></AppShell>}

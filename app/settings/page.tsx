"use client"
import {useEffect,useId,useState} from "react";import {useTheme} from "next-themes";import {toast} from "sonner";import {useQuery,useQueryClient} from "@tanstack/react-query"
import {Eye,EyeOff,Sun,Moon,Monitor,Download,RefreshCw,XCircle,CheckCircle2,Loader2,Ban} from "lucide-react"
import {useChat} from "@/lib/store";import {useDocs} from "@/lib/docs";import {cacheUser,useUser} from "@/lib/auth";import {API,saveKeys,updateProfile,exportAccount,fetchKeysStatus,clearKey,getPrefs,patchPrefs,getUsage,type Prefs} from "@/lib/api"
import {AppShell} from "@/components/layout/Sidebar";import {Avatar} from "@/components/ui/avatar";import {Dialog} from "@/components/ui/dialog"
const inp="w-full rounded-xl border border-[var(--line)] bg-transparent px-3 py-2 outline-none transition focus:border-purple-500 focus:shadow-[0_0_0_3px_rgba(168,85,247,.25)]"
const EMAIL=/^[^@\s]+@[^@\s.]+\.[^@\s]+$/
function Sec({t,sub,children,danger}:{t:string;sub?:string;children:React.ReactNode;danger?:boolean}){return <section className={`glass p-6 ${danger?"border-red-500/40 bg-red-500/5":""}`}><h2 className="text-lg font-semibold">{t}</h2>{sub&&<p className="text-sm text-[var(--muted)]">{sub}</p>}<div className="mt-4">{children}</div></section>}
function Text({label,value,onChange,type="text",ph,ac="off"}:{label:string;value:string;onChange:(v:string)=>void;type?:string;ph?:string;ac?:string}){const id=useId();return <div><label htmlFor={id} className="text-sm">{label}</label><input id={id} type={type} autoComplete={ac} value={value} placeholder={ph} onChange={e=>onChange(e.target.value)} className={inp+" mt-1"}/></div>}
function Key({label,value,onChange}:{label:string;value:string;onChange:(v:string)=>void}){const id=useId();const [s,setS]=useState(false)
 return <div><label htmlFor={id} className="text-sm">{label}</label><div className="relative mt-1"><input id={id} type={s?"text":"password"} autoComplete="off" value={value} onChange={e=>onChange(e.target.value)} placeholder="Paste a new key to replace it" className={inp+" pr-11"}/>
  <button type="button" aria-label={s?`Hide ${label}`:`Show ${label}`} onClick={()=>setS(!s)} className="absolute right-3 top-2.5 text-[var(--muted)] hover:text-[var(--fg)]">{s?<EyeOff size={18}/>:<Eye size={18}/>}</button></div></div>}
function Chip({source,label,model}:{source:"saved"|"env"|"none";label:string;model?:string}){const map={saved:{t:`${label} key saved`,c:"border-green-500/40 bg-green-500/10 text-green-300",I:CheckCircle2},env:{t:`${label} key from server env`,c:"border-sky-500/40 bg-sky-500/10 text-sky-300",I:CheckCircle2},none:{t:`No ${label} key`,c:"border-[var(--line)] text-[var(--muted)]",I:Ban}} as const
 const {t,c,I}=map[source];return <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs ${c}`}><I size={12}/>{t}{model&&source!=="none"&&<span className="opacity-70">· {model}</span>}</span>}
function Range({label,hint,value,min,max,step,onChange}:{label:string;hint:string;value:number;min:number;max:number;step:number;onChange:(v:number)=>void}){const id=useId()
 return <div><div className="flex items-baseline justify-between gap-3"><label htmlFor={id} className="text-sm">{label}</label><span className="text-sm tabular-nums text-[var(--muted)]">{value}</span></div>
  <input id={id} type="range" min={min} max={max} step={step} value={value} onChange={e=>onChange(Number(e.target.value))} className="mt-2 w-full accent-purple-500"/><p className="text-xs text-[var(--muted)]">{hint}</p></div>}
const kfmt=(n:number)=>n>=10000?`${Math.round(n/1000)}k`:(n>=1000?`${(n/1000).toFixed(1)}k`:`${n}`)
export default function Settings(){
 const {theme,setTheme,resolvedTheme}=useTheme();const clearAll=useChat(s=>s.clearAll);const user:any=useUser();const qc=useQueryClient()
 const [mounted,setMounted]=useState(false);useEffect(()=>setMounted(true),[]);const [dlg,setDlg]=useState(false);const [busy,setBusy]=useState(false)
 const [pn,setPn]=useState("");const [pe,setPe]=useState("");useEffect(()=>{if(user){setPn(user.name);setPe(user.email)}},[user])
 const [groq,setGroq]=useState("");const [pine,setPine]=useState("")
 const keys=useQuery({queryKey:["keys"],queryFn:fetchKeysStatus,enabled:!!API})
 const prefs=useQuery({queryKey:["prefs"],queryFn:getPrefs,enabled:!!API});const [pv,setPv]=useState<Prefs|null>(null)
 const usage=useQuery({queryKey:["usage"],queryFn:getUsage,enabled:!!API})
 useEffect(()=>{if(prefs.data)setPv(prefs.data)},[prefs.data])
 const saveProfile=async()=>{if(!pn.trim())return void toast.error("Enter a name");if(!EMAIL.test(pe.trim()))return void toast.error("That email doesn't look right")
  setBusy(true)
  try{const p=await updateProfile(pn.trim(),pe.trim())
   toast.success("Profile updated")}catch(e:any){toast.error(e.message)}finally{setBusy(false)}}
 const saveApi=async()=>{if(!groq.trim()&&!pine.trim())return void toast.error("Enter at least one key");setBusy(true)
  try{const r=await saveKeys({groq,pinecone:pine});toast.success(r.demo?"Saved in demo mode":"API keys saved");setGroq("");setPine("");qc.invalidateQueries({queryKey:["keys"]})}catch(e:any){toast.error(e.message)}finally{setBusy(false)}}
 const forget=async(p:"groq"|"pinecone")=>{setBusy(true)
  try{const r=await clearKey(p);qc.invalidateQueries({queryKey:["keys"]})
   r.cleared?toast.success(`${p==="groq"?"Groq":"Pinecone"} key forgotten`):toast.warning("That key comes from the server's environment")}catch(e:any){toast.error(e.message)}finally{setBusy(false)}}
 const applyPrefs=async()=>{if(!pv)return;setBusy(true);try{const d=await patchPrefs(pv);setPv(d);toast.success("Retrieval settings saved")}catch(e:any){toast.error(e.message)}finally{setBusy(false)}}
 const resize=(v:number)=>setPv(p=>p&&{...p,chunk_size:v,chunk_overlap:Math.min(p.chunk_overlap,Math.max(0,v-200))})
 const grab=async()=>{setBusy(true)
  try{const data=API?await exportAccount():{exported_at:new Date().toISOString(),profile:user,conversations:useChat.getState().convs,documents:useDocs.getState().docs}
   const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:"application/json"}))
   const a=document.createElement("a");a.href=url;a.download=`ragdocs-export-${new Date().toISOString().slice(0,10)}.json`;a.click();URL.revokeObjectURL(url)
   toast.success("Export downloaded")}catch(e:any){toast.error(e.message)}finally{setBusy(false)}}
 return <AppShell><main id="main" className="mx-auto w-full max-w-2xl space-y-5 p-6"><h1 className="text-3xl font-bold">Settings</h1>
  <Sec t="Profile"><div className="mb-4 flex items-center gap-4"><Avatar name={pn||"A"} size={56}/><div className="text-sm"><p className="font-medium">{pn||"Your name"}</p><p className="text-[var(--muted)]">{pe||"—"}</p></div></div>
   <div className="grid gap-3 sm:grid-cols-2"><Text label="Display name" value={pn} onChange={setPn}/><Text label="Email" type="email" value={pe} onChange={setPe}/></div>
   <div className="mt-4 flex flex-wrap gap-3"><button onClick={saveProfile} disabled={busy} className="grad rounded-xl px-5 py-2 text-white transition hover:scale-105 active:scale-95 disabled:opacity-60">{busy?"Saving…":"Save profile"}</button></div></Sec>
  <Sec t="Appearance"><div className="grid grid-cols-3 gap-3">{([["light","Light",Sun],["dark","Dark",Moon],["system","System",Monitor]] as const).map(([k,l,I])=>{const on=mounted&&theme===k,shade=k==="system"?(resolvedTheme||"dark"):k
   return <button key={k} onClick={()=>setTheme(k)} aria-pressed={on} className={`glass overflow-hidden p-2 text-sm transition hover:scale-[1.03] active:scale-[.98] ${on?"ring-2 ring-purple-500 shadow-lg shadow-purple-500/20":""}`}>
    <span aria-hidden className={`mb-2 block h-16 rounded-lg border border-[var(--line)] p-2 ${shade==="light"?"bg-white":"bg-[#0a0912]"}`}><span className={`block h-2 w-8 rounded ${shade==="light"?"bg-purple-300":"grad"}`}/><span className={`mt-2 block h-2 w-14 rounded ${shade==="light"?"bg-slate-200":"bg-white/25"}`}/></span>
    <span className="flex items-center justify-center gap-1.5"><I size={14}/>{l}</span></button>})}
   </div><p className="mt-2 text-xs text-[var(--muted)]">System follows your OS light/dark setting.</p></Sec>
  <Sec t="Retrieval tuning" sub="How much text your assistant reads before answering. Chunk size only affects documents you index from now on.">
   {!pv&&!prefs.isError&&<p className="flex items-center gap-2 text-sm text-[var(--muted)]"><Loader2 size={14} className="animate-spin"/>Loading your settings…</p>}
   {prefs.isError&&<p className="flex flex-wrap items-center gap-2 text-sm text-red-400"><XCircle size={14}/>Couldn't read your settings.<button onClick={()=>prefs.refetch()} className="inline-flex items-center gap-1 underline">Retry<RefreshCw size={12}/></button></p>}
   {pv&&<div className="space-y-4"><Range label="Passages per answer (top-k)" hint={`${pv.top_k} chunk${pv.top_k===1?"":"s"} are handed to the model with each question.`} value={pv.top_k} min={1} max={20} step={1} onChange={v=>setPv(p=>p&&{...p,top_k:v})}/>
    <Range label="Chunk size" hint="Characters per indexed passage. Smaller = pinpoint answers, larger = more surrounding context." value={pv.chunk_size} min={200} max={4000} step={100} onChange={resize}/>
    <Range label="Chunk overlap" hint="Characters repeated between passages so an answer isn't cut in half." value={pv.chunk_overlap} min={0} max={Math.max(0,pv.chunk_size-200)} step={50} onChange={v=>setPv(p=>p&&{...p,chunk_overlap:v})}/></div>}
   {!API&&<p className="text-sm text-[var(--muted)]">Search in demo mode uses sample data, so there is nothing to tune.</p>}
   {pv&&<button onClick={applyPrefs} disabled={busy} className="grad mt-4 rounded-xl px-5 py-2 text-white transition hover:scale-105 active:scale-95 disabled:opacity-60">{busy?"Saving…":"Apply"}</button>}</Sec>
  <Sec t="API configuration" sub="Keys are sent to your server over HTTPS and are never kept in this browser.">
   {API&&<div className="mb-3 flex flex-wrap items-center gap-2 text-sm">{keys.data&&<><Chip source={keys.data.groq_source} label="Groq" model={keys.data.groq_model}/><Chip source={keys.data.pinecone_source} label="Pinecone"/></>}
    {keys.data&&<span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--line)] px-2.5 py-1 text-xs text-[var(--muted)]">Retrieval: {keys.data.retrieval.toUpperCase()}</span>}
    {keys.isFetching&&<Loader2 size={14} className="animate-spin text-[var(--muted)]"/>}{keys.isError&&<button onClick={()=>keys.refetch()} className="text-xs text-purple-400 underline">Status unavailable — retry</button>}</div>}
   <div className="space-y-3"><Key label="Groq API key" value={groq} onChange={setGroq}/><Key label="Pinecone API key" value={pine} onChange={setPine}/></div>
   <div className="mt-4 flex flex-wrap gap-3"><button onClick={saveApi} disabled={busy} className="grad rounded-xl px-5 py-2 text-white transition hover:scale-105 active:scale-95 disabled:opacity-60">{busy?"Saving…":"Save keys"}</button>
    {API&&keys.data?.groq_source==="saved"&&<button onClick={()=>forget("groq")} disabled={busy} className="glass inline-flex items-center gap-2 px-4 py-2 text-sm transition hover:scale-105"><Ban size={15}/>Forget Groq key</button>}
    {API&&keys.data?.pinecone_source==="saved"&&<button onClick={()=>forget("pinecone")} disabled={busy} className="glass inline-flex items-center gap-2 px-4 py-2 text-sm transition hover:scale-105"><Ban size={15}/>Forget Pinecone key</button>}</div></Sec>
  <Sec t="Usage" sub="What this account has asked the server for, counted on the server.">
   {!API&&<p className="text-sm text-[var(--muted)]">Nothing to show — this page isn't connected to a server.</p>}
   {!usage.data&&!usage.isError&&API&&<p className="flex items-center gap-2 text-sm text-[var(--muted)]"><Loader2 size={14} className="animate-spin"/>Loading usage…</p>}
   {usage.isError&&<p className="flex flex-wrap items-center gap-2 text-sm text-red-400"><XCircle size={14}/>Couldn't read your usage.<button onClick={()=>usage.refetch()} className="inline-flex items-center gap-1 underline">Retry<RefreshCw size={12}/></button></p>}
   {usage.data&&<><div className="grid grid-cols-2 gap-3 sm:grid-cols-4">{([["Questions answered",usage.data.totals.requests.toLocaleString()],["Tokens used (est.)",kfmt(usage.data.totals.prompt_tokens+usage.data.totals.completion_tokens)],["Context per answer",kfmt(usage.data.context_tokens)],["Answer cache",usage.data.answer_cache_seconds?`${usage.data.answer_cache_seconds}s`:"Off"]] as [string,string][]).map(([l,v])=><div key={l} className="rounded-xl border border-[var(--line)] p-3"><p className="text-lg font-bold tabular-nums">{v}</p><p className="text-xs text-[var(--muted)]">{l}</p></div>)}</div>
     <p className="mt-3 text-xs text-[var(--muted)]">{usage.data.model}, over the last 30 days ({usage.data.days.length} active day{usage.data.days.length===1?"":"s"}). {usage.data.answer_cache_seconds?"An identical question inside the cache window is replayed without calling the model — Regenerate forces a fresh answer." :"Caching is off, so every question calls the model."} Prompt and completion halves are tracked separately, so a jump in cost is easier to explain.</p></>}</Sec>
  <Sec t="Your data" sub="Downloads every document, chunk, conversation and message on this account as one JSON file.">
   <div className="flex flex-wrap gap-3"><button onClick={grab} disabled={busy} className="glass inline-flex items-center gap-2 px-4 py-2 text-sm transition hover:scale-105 disabled:opacity-60"><Download size={16}/>{busy?"Preparing…":"Export data (JSON)"}</button></div></Sec>
  <Sec t="Danger zone" sub="Deleting chats clears your conversations. This can't be undone." danger>
   <div className="flex flex-wrap gap-3"><button onClick={()=>setDlg(true)} className="rounded-xl bg-red-600 px-5 py-2 text-white transition hover:scale-105 active:scale-95">Delete all chats</button></div></Sec>
  <Dialog open={dlg} onClose={()=>setDlg(false)} title="Delete all chats?"><p className="text-sm text-[var(--muted)]">You can't undo this.</p><div className="mt-4 flex justify-end gap-2"><button data-autofocus onClick={()=>setDlg(false)} className="glass px-4 py-2 text-sm">Cancel</button><button onClick={()=>{clearAll();setDlg(false);toast.success("All chats deleted")}} className="rounded-xl bg-red-600 px-4 py-2 text-sm text-white">Delete all</button></div></Dialog></main></AppShell>}
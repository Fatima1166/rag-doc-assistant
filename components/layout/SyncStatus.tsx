"use client"
import {useEffect,useRef,useState} from "react";import {motion} from "framer-motion";import {CloudOff,RefreshCw,WifiOff,X} from "lucide-react";import {toast} from "sonner"
import {API} from "@/lib/api";import {useServerStatus} from "@/lib/health";import {useChat} from "@/lib/store"

/** One status strip for everything that can stop your chats reaching the server:
 *  the browser being offline, the backend being down, or a push that failed. */
export function SyncStatus(){
 const {online,down,refetch}=useServerStatus()
 const failed=useChat(s=>s.failed),retryAll=useChat(s=>s.retryAll),retrying=useChat(s=>s.retrying)
 const n=Object.keys(failed).length
 const [hidden,setHidden]=useState(false)
 // As soon as the server answers again, flush what the offline period queued.
 const wasOut=useRef(false)
 useEffect(()=>{
  const outage=!online||down
  if(wasOut.current&&!outage&&n)retryAll().then(ok=>{if(ok)toast.success(`${ok} conversation${ok===1?"":"s"} synced`)})
  wasOut.current=outage},[online,down,n,retryAll])
 if(!API||hidden||(!n&&online&&!down))return null
 const state=!online?"offline":down?"server":"pending"
 const label=!online?"You're offline — chats are saved on this device":down?"Backend unreachable — changes are held locally":`${n} conversation${n===1?"":"s"} not synced`
 return <motion.div initial={{opacity:0,y:12}} animate={{opacity:1,y:0}} exit={{opacity:0}} role="status"
  className={`fixed bottom-4 left-4 z-50 flex max-w-[min(92vw,26rem)] items-center gap-2 rounded-xl border px-3 py-2 text-xs shadow-lg backdrop-blur-xl ${state==="pending"?"border-amber-500/50 bg-amber-500/15 text-amber-200":"border-red-500/50 bg-red-500/15 text-red-200"}`}>
  <span className="shrink-0">{online?<CloudOff size={15}/>:<WifiOff size={15}/>}</span><span className="min-w-0 flex-1">{label}</span>
  {(state!=="offline"||n>0)&&<button onClick={()=>{refetch();if(n)retryAll().then(ok=>{if(ok)toast.success(`${ok} conversation${ok===1?"":"s"} synced`)})}} disabled={retrying}
   aria-label="Retry syncing now" className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-white/10 px-2 py-1 transition hover:bg-white/20 disabled:opacity-50"><RefreshCw size={12} className={retrying?"animate-spin":""}/>{retrying?"Retrying":"Retry"}</button>}
  <button onClick={()=>setHidden(true)} aria-label="Dismiss sync warning" className="shrink-0 rounded p-1 transition hover:bg-white/10"><X size={12}/></button></motion.div>}

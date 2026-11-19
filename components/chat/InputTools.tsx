"use client"
import {useRef,useState} from "react";import {Paperclip,Mic} from "lucide-react";import {toast} from "sonner";import {useIngest} from "@/lib/ingest";import {ACCEPT} from "@/lib/files"
export function AttachButton(){const {files}=useIngest();const r=useRef<HTMLInputElement>(null)
 return <><button type="button" aria-label="Attach a document" onClick={()=>r.current?.click()} className="grid size-10 shrink-0 place-items-center rounded-xl text-[var(--muted)] transition hover:text-[var(--fg)]"><Paperclip size={18}/></button>
 <input ref={r} type="file" accept={ACCEPT} hidden onChange={e=>{files(e.target.files);e.target.value=""}}/></>}
export function MicButton({onText}:{onText:(t:string)=>void}){const [on,setOn]=useState(false)
 function go(){const SR=(window as any).SpeechRecognition||(window as any).webkitSpeechRecognition;if(!SR)return toast.error("Voice input isn't supported in this browser")
  const r=new SR();r.onresult=(e:any)=>onText(e.results[0][0].transcript);r.onend=()=>setOn(false);r.onerror=()=>{setOn(false);toast.error("Couldn't hear you")};setOn(true);r.start()}
 return <button type="button" aria-label="Voice input" aria-pressed={on} onClick={go} className={`grid size-10 shrink-0 place-items-center rounded-xl ${on?"animate-pulse bg-red-500/20 text-red-400":"text-[var(--muted)] hover:text-[var(--fg)]"}`}><Mic size={18}/></button>}

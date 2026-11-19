"use client"
import {useRef,useState} from "react";import {Send,Square} from "lucide-react";import {AttachButton,MicButton} from "./InputTools"
export function ChatInput({onSend,onStop,busy}:{onSend:(t:string)=>void;onStop:()=>void;busy:boolean}){
 const [t,setT]=useState("");const ta=useRef<HTMLTextAreaElement>(null)
 const fit=()=>{const e=ta.current;if(e){e.style.height="auto";e.style.height=Math.min(e.scrollHeight,200)+"px"}}
 const submit=()=>{if(!t.trim()||busy)return;onSend(t);setT("");requestAnimationFrame(fit)}
 return <form onSubmit={e=>{e.preventDefault();submit()}} className="mx-auto flex max-w-3xl rounded-2xl bg-gradient-to-r from-purple-500 via-blue-500 to-cyan-500 p-[1.5px] shadow-[0_0_20px_rgba(168,85,247,.25)] transition focus-within:shadow-[0_0_28px_rgba(168,85,247,.55)]">
  <div className="flex min-w-0 flex-1 items-end gap-1 rounded-[14px] bg-[var(--bg)] p-2"><AttachButton/>
   <textarea ref={ta} value={t} onChange={e=>{setT(e.target.value);fit()}} onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();submit()}}} rows={1} placeholder="Ask about your docs…" aria-label="Message" className="max-h-[200px] min-w-0 flex-1 resize-none bg-transparent px-2 py-2 outline-none"/>
   <MicButton onText={x=>{setT(v=>(v+" "+x).trim());requestAnimationFrame(fit)}}/>
   {busy?<button type="button" aria-label="Stop generating" onClick={onStop} className="grad grid size-10 shrink-0 place-items-center rounded-xl text-white transition hover:scale-105"><Square size={16}/></button>
   :<button aria-label="Send message" disabled={!t.trim()} className="grad grid size-10 shrink-0 place-items-center rounded-xl text-white transition hover:scale-105 active:scale-95 disabled:opacity-40 disabled:hover:scale-100"><Send size={16}/></button>}</div></form>}

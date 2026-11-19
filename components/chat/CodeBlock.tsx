"use client"
import {useState} from "react";import dynamic from "next/dynamic";import {Copy,Check} from "lucide-react";import {toast} from "sonner"
const Highlighted=dynamic(()=>import("./HighlightedCode"),{ssr:false,loading:()=><div className="skeleton h-24 rounded-xl"/>})
export function Code({className,children}:{className?:string;children?:React.ReactNode}){
 const [done,setDone]=useState(false);const txt=String(children??"").replace(/\n$/,"");const lang=/language-(\w+)/.exec(className??"")?.[1]
 if(!lang&&!txt.includes("\n"))return <code className="rounded bg-purple-500/20 px-1 py-0.5 text-[.9em] text-purple-300">{txt}</code>
 return <div className="relative my-2 overflow-hidden rounded-xl"><span className="absolute left-3 top-2 z-10 text-xs uppercase tracking-wide text-white/50">{lang??"text"}</span>
  <button aria-label="Copy code" onClick={()=>{navigator.clipboard.writeText(txt);setDone(true);toast("Copied");setTimeout(()=>setDone(false),1500)}} className="absolute right-2 top-2 z-10 rounded-md bg-white/10 p-1.5 text-white transition hover:bg-white/20">{done?<Check size={14}/>:<Copy size={14}/>}</button>
  <Highlighted lang={lang??"text"}>{txt}</Highlighted></div>}

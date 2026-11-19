"use client"
import {useEffect,useState} from "react";import {FileUp,MessageSquare,Quote} from "lucide-react";import {Dialog} from "@/components/ui/dialog"
const STEPS=[[FileUp,"Add your documentation","Upload PDFs, paste a URL, or load the sample docs from the Documents page."],[MessageSquare,"Ask in plain language","Questions are answered only from your documents. If it isn't there, you'll be told."],[Quote,"Check every source","Tap a numbered citation to see the exact passage the answer came from."]] as const
export function Onboarding(){const [open,setOpen]=useState(false);const [i,setI]=useState(0)
 useEffect(()=>{try{if(!localStorage.getItem("ragdocs-onboarded"))setOpen(true)}catch{}},[])
 const done=()=>{try{localStorage.setItem("ragdocs-onboarded","1")}catch{}setOpen(false)}
 const [I,t,d]=STEPS[i]
 return <Dialog open={open} onClose={done} title="Welcome to RAGDocs"><div className="text-center"><span className="grad mx-auto grid size-14 place-items-center rounded-2xl text-white"><I size={26}/></span>
  <h3 className="mt-4 text-lg font-semibold">{t}</h3><p className="mt-1 text-sm text-[var(--muted)]">{d}</p>
  <div className="mt-5 flex justify-center gap-1.5" aria-hidden>{STEPS.map((_,n)=><span key={n} className={`h-1.5 rounded-full transition-all ${n===i?"grad w-6":"w-1.5 bg-[var(--line)]"}`}/>)}</div>
  <div className="mt-6 flex items-center justify-between"><button onClick={done} className="text-sm text-[var(--muted)] hover:text-[var(--fg)]">Skip</button>
   <div className="flex gap-2">{i>0&&<button onClick={()=>setI(i-1)} className="glass px-4 py-2 text-sm">Back</button>}<button data-autofocus onClick={()=>i<2?setI(i+1):done()} className="grad rounded-xl px-5 py-2 text-sm text-white transition hover:scale-105">{i<2?"Next":"Get started"}</button></div></div></div></Dialog>}

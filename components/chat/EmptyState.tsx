"use client"
import Link from "next/link";import {Sparkles} from "lucide-react";import {motion} from "framer-motion";import {useDocs} from "@/lib/docs";import {SuggestedQuestions} from "./SuggestedQuestions"
export function EmptyState({onPick}:{onPick:(q:string)=>void}){const docs=useDocs(s=>s.docs);const addSamples=useDocs(s=>s.addSamples)
 return <motion.div initial={{opacity:0,y:12}} animate={{opacity:1,y:0}} className="mx-auto mt-8 max-w-xl text-center sm:mt-16">
  <span className="grad float mx-auto mb-4 grid size-16 place-items-center rounded-2xl shadow-lg shadow-purple-500/40"><Sparkles size={30} className="text-white"/></span>
  <h2 className="grad-text text-4xl font-bold">Ask me anything</h2><p className="mt-2 text-[var(--muted)]">Answers come only from your indexed documents.</p>
  {docs.some(d=>d.status==="ready")?<SuggestedQuestions onPick={onPick}/>:<div className="glass mt-6 p-5"><p className="text-sm">You don't have any indexed documents yet.</p>
   <div className="mt-3 flex flex-wrap justify-center gap-2"><button onClick={addSamples} className="grad rounded-xl px-4 py-2 text-sm text-white transition hover:scale-105">Load sample documentation</button><Link href="/documents" className="glass px-4 py-2 text-sm transition hover:scale-105">Upload your own</Link></div></div>}</motion.div>}

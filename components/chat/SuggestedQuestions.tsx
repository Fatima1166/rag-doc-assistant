"use client"
import {motion} from "framer-motion";import {SUGGESTED} from "@/lib/mock"
export function SuggestedQuestions({onPick}:{onPick:(q:string)=>void}){
 return <div className="mt-6 flex flex-wrap justify-center gap-2">{SUGGESTED.map((s,i)=><motion.button key={s} initial={{opacity:0,y:10}} animate={{opacity:1,y:0}} transition={{delay:.1+i*.08}} onClick={()=>onPick(s)} className="glass px-4 py-2 text-sm transition hover:scale-105 hover:border-purple-500/50 active:scale-95">{s}</motion.button>)}</div>}

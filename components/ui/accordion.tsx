"use client"
import {useState} from "react";import {ChevronDown} from "lucide-react";import {AnimatePresence,motion} from "framer-motion"
export function Accordion({items}:{items:[string,string][]}){const [open,setOpen]=useState<number|null>(0)
 return <div className="space-y-3">{items.map(([q,a],i)=><div key={q} className="glass overflow-hidden">
  <h3><button aria-expanded={open===i} onClick={()=>setOpen(open===i?null:i)} className="flex w-full items-center justify-between p-4 text-left font-medium">{q}<ChevronDown size={18} className={`transition ${open===i?"rotate-180":""}`}/></button></h3>
  <AnimatePresence initial={false}>{open===i&&<motion.div initial={{height:0,opacity:0}} animate={{height:"auto",opacity:1}} exit={{height:0,opacity:0}}><p className="px-4 pb-4 text-sm text-[var(--muted)]">{a}</p></motion.div>}</AnimatePresence></div>)}</div>}

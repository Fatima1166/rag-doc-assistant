"use client"
import {Tip} from "@/components/ui/tooltip";import {useTheme} from "next-themes";import {Sun,Moon} from "lucide-react";import {motion,AnimatePresence} from "framer-motion";import {useEffect,useState} from "react"
export function ThemeToggle(){const {resolvedTheme,setTheme}=useTheme();const [m,setM]=useState(false);useEffect(()=>setM(true),[])
 const dark=m&&resolvedTheme==="dark"
 return <Tip label="Toggle theme"><button aria-label="Toggle theme" onClick={()=>setTheme(dark?"light":"dark")} className="glass grid size-10 place-items-center transition hover:scale-105 active:scale-95">
 <AnimatePresence mode="wait" initial={false}><motion.span key={String(dark)} initial={{rotate:-90,opacity:0}} animate={{rotate:0,opacity:1}} exit={{rotate:90,opacity:0}} transition={{duration:.2}}>{dark?<Moon size={18}/>:<Sun size={18}/>}</motion.span></AnimatePresence></button></Tip>}

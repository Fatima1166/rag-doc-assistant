"use client"
import {useEffect,useRef} from "react";import {motion} from "framer-motion";import {X} from "lucide-react"
const SEL='a[href],button,input,textarea,select,[tabindex]:not([tabindex="-1"])'
export function Dialog({open,onClose,title,children,bare}:{open:boolean;onClose:()=>void;title:string;children:React.ReactNode;bare?:boolean}){
 const ref=useRef<HTMLDivElement>(null);const close=useRef(onClose);close.current=onClose
 useEffect(()=>{if(!open)return;const el=ref.current!;const prev=document.activeElement as HTMLElement|null
  const items=()=>[...el.querySelectorAll<HTMLElement>(SEL)].filter(x=>!x.hasAttribute("disabled"))
  ;(el.querySelector<HTMLElement>("[data-autofocus]")??items()[0]??el).focus()
  const key=(e:KeyboardEvent)=>{if(e.key==="Escape"){e.stopPropagation();close.current();return}if(e.key!=="Tab")return
   const l=items();if(!l.length){e.preventDefault();return}const a=l[0],z=l[l.length-1]
   if(e.shiftKey&&document.activeElement===a){e.preventDefault();z.focus()}else if(!e.shiftKey&&document.activeElement===z){e.preventDefault();a.focus()}}
  document.addEventListener("keydown",key);const ov=document.body.style.overflow;document.body.style.overflow="hidden"
  return()=>{document.removeEventListener("keydown",key);document.body.style.overflow=ov;prev?.focus?.()}},[open])
 if(!open)return null
 return <div className={`fixed inset-0 z-50 grid justify-items-center bg-black/60 p-4 backdrop-blur-sm ${bare?"items-start pt-[12vh]":"items-center"}`} onMouseDown={e=>e.target===e.currentTarget&&onClose()}>
  <motion.div ref={ref} role="dialog" aria-modal="true" aria-label={title} tabIndex={-1} initial={{opacity:0,scale:.96,y:8}} animate={{opacity:1,scale:1,y:0}} transition={{duration:.18}} className={`glass w-full max-w-lg bg-[var(--bg)] shadow-2xl ${bare?"":"p-6"}`}>
   {!bare&&<div className="mb-3 flex items-center justify-between"><h3 className="font-semibold">{title}</h3><button aria-label="Close" onClick={onClose} className="rounded p-1 text-[var(--muted)] hover:text-[var(--fg)]"><X size={18}/></button></div>}{children}</motion.div></div>}

"use client"
import {useEffect,useState} from "react"
const A="Send your key as a Bearer token in the Authorization header. Keys are scoped per project."
export function Preview(){const [n,setN]=useState(0);useEffect(()=>{const i=setInterval(()=>setN(x=>x>A.length+40?0:x+2),50);return()=>clearInterval(i)},[])
 return <div className="glass mx-auto mt-14 max-w-xl p-5 text-left shadow-2xl shadow-purple-500/20" aria-hidden>
  <div className="mb-3 flex gap-1.5">{["bg-red-400","bg-amber-400","bg-green-400"].map(c=><span key={c} className={`size-2.5 rounded-full ${c}`}/>)}</div>
  <p className="ml-auto w-fit rounded-2xl bg-gradient-to-r from-blue-500 to-cyan-500 px-4 py-2 text-sm text-white">How do I authenticate?</p>
  <div className="glass mt-3 min-h-20 p-3 text-sm">{A.slice(0,n)}<span className="ml-0.5 inline-block h-4 w-0.5 animate-pulse bg-purple-400 align-middle"/>
   {n>=A.length&&<div className="mt-2 flex gap-2">{["Authentication · Guide","Rate limits"].map(s=><span key={s} className="rounded-full border border-purple-500/40 bg-purple-500/10 px-2.5 py-0.5 text-xs">{s}</span>)}</div>}</div></div>}

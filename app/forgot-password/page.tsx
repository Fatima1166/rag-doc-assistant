"use client"
import {useState} from "react";import Link from "next/link";import {motion} from "framer-motion";import {Check} from "lucide-react";import {toast} from "sonner"
import {API,forgotPassword} from "@/lib/api";import {AuthLayout,Field,GradBtn} from "@/components/auth/AuthLayout"
export default function Forgot(){const [e,setE]=useState("");const [l,setL]=useState(false);const [done,setDone]=useState(false)
 async function submit(ev:React.FormEvent){ev.preventDefault();setL(true)
  try{
   // In API mode the backend answers "ok" even for unknown emails — no account enumeration.
   if(API){await forgotPassword(e)}else{await new Promise(x=>setTimeout(x,900))}
   setDone(true)
  }catch(err){toast.error(err instanceof Error?err.message:"Something went wrong");setL(false)}}
 return <AuthLayout split={false}>{done?<div className="text-center"><motion.span initial={{scale:0}} animate={{scale:1}} transition={{type:"spring"}} className="grad mx-auto mb-4 grid size-14 place-items-center rounded-full text-white"><Check/></motion.span>
  <h1 className="text-xl font-bold">Check your inbox</h1><p className="mt-1 text-sm text-[var(--muted)]">If {e} has an account, a reset link is on its way. It expires in 1 hour.</p>
  {!API&&<p className="mt-2 text-xs text-[var(--muted)]">Demo mode: links aren't emailed here.</p>}</div>
  :<><h1 className="text-2xl font-bold">Reset your password</h1><p className="mb-6 text-sm text-[var(--muted)]">Enter your email and we'll send a link.</p>
  <form className="space-y-4" onSubmit={submit}><Field label="Email" type="email" name="email" autoComplete="email" value={e} onChange={setE}/><GradBtn loading={l}>Send reset link</GradBtn></form></>}
  <Link href="/login" className={`block text-center text-sm text-purple-400 ${done?"":"mt-6"}`}>Back to login</Link></AuthLayout>}

"use client"
import {useEffect,useState} from "react";import Link from "next/link";import {motion} from "framer-motion";import {Check,MailX} from "lucide-react"
import {verifyEmail} from "@/lib/api";import {readUser,startSession} from "@/lib/auth";import {AuthLayout} from "@/components/auth/AuthLayout"
// Landing target of the "confirm your email" link: ?token=… . Public — works even logged-out.
export default function Verify(){const [state,setState]=useState<"busy"|"ok"|"bad">("busy");const [msg,setMsg]=useState("")
 useEffect(()=>{(async()=>{
  const token=new URLSearchParams(location.search).get("token")||""
  if(!token){setState("bad");setMsg("This confirmation link is missing its token.");return}
  try{
   const u=await verifyEmail(token)
   // If this browser already has a session, refresh its cached profile so the banner clears.
   if(readUser())startSession({name:u.name,email:u.email,verified:u.verified})
   setState("ok")
  }catch(e){setState("bad");setMsg(e instanceof Error?e.message:"The link could not be verified.")}
 })()},[])
 return <AuthLayout split={false}>{
  state==="busy"&&<div className="flex flex-col items-center gap-3 py-6"><span className="size-8 animate-spin rounded-full border-2 border-purple-500/30 border-t-purple-500"/><p className="text-sm text-[var(--muted)]">Confirming your email…</p></div>}
  {state==="ok"&&<div className="text-center"><motion.span initial={{scale:0}} animate={{scale:1}} transition={{type:"spring"}} className="grad mx-auto mb-4 grid size-14 place-items-center rounded-full text-white"><Check/></motion.span>
   <h1 className="text-xl font-bold">Email confirmed</h1><p className="mt-1 text-sm text-[var(--muted)]">Thanks for verifying. Your account is all set.</p>
   <Link href="/chat" className="mt-6 block text-center text-sm text-purple-400">Go to your chats</Link></div>}
  {state==="bad"&&<div className="text-center"><motion.span initial={{scale:0}} animate={{scale:1}} transition={{type:"spring"}} className="mx-auto mb-4 grid size-14 place-items-center rounded-full bg-red-500/15 text-red-400"><MailX/></motion.span>
   <h1 className="text-xl font-bold">Link not valid</h1><p className="mt-1 text-sm text-[var(--muted)]">{msg}</p>
   <Link href="/login" className="mt-6 block text-center text-sm text-purple-400">Back to sign in</Link></div>}
 </AuthLayout>}

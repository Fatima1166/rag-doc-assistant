"use client"
import {useEffect,useState} from "react";import Link from "next/link";import {useRouter} from "next/navigation";import {motion} from "framer-motion";import {Link2Off} from "lucide-react";import {toast} from "sonner"
import {resetPassword} from "@/lib/api";import {AuthLayout,Field,GradBtn} from "@/components/auth/AuthLayout"
export default function Reset(){const r=useRouter()
 // Read the token client-side (same approach as nextPath() in lib/auth.ts — no Suspense needed).
 const [token,setToken]=useState<string|null>(null)
 const [p1,setP1]=useState("");const [p2,setP2]=useState("");const [l,setL]=useState(false)
 useEffect(()=>{setToken(new URLSearchParams(location.search).get("token"))},[])
 async function submit(ev:React.FormEvent){ev.preventDefault()
  if(p1.length<8){toast.error("Password must be at least 8 characters");return}
  if(p1!==p2){toast.error("Passwords don't match");return}
  setL(true)
  try{
   await resetPassword(token!,p1)
   toast.success("Password updated — sign in with your new password")
   r.push("/login")
  }catch(err){toast.error(err instanceof Error?err.message:"Reset failed");setL(false)}}
 if(token===null)return <AuthLayout split={false}><p className="text-sm text-[var(--muted)]">Loading…</p></AuthLayout>
 if(!token)return <AuthLayout split={false}><div className="text-center">
  <motion.span initial={{scale:0}} animate={{scale:1}} transition={{type:"spring"}} className="mx-auto mb-4 grid size-14 place-items-center rounded-full bg-red-500/15 text-red-400"><Link2Off/></motion.span>
  <h1 className="text-xl font-bold">Invalid reset link</h1><p className="mt-1 text-sm text-[var(--muted)]">This link is missing or was already used. Request a new one.</p>
  <Link href="/forgot-password" className="mt-6 block text-center text-sm text-purple-400">Request new link</Link></div></AuthLayout>
 return <AuthLayout split={false}><h1 className="text-2xl font-bold">Choose a new password</h1><p className="mb-6 text-sm text-[var(--muted)]">Make it at least 8 characters. The link expires in 1 hour and works once.</p>
  <form className="space-y-4" onSubmit={submit}>
   <Field label="New password" type="password" name="password" autoComplete="new-password" value={p1} onChange={setP1}/>
   <Field label="Confirm password" type="password" name="confirm" autoComplete="new-password" value={p2} onChange={setP2} error={p2.length>0&&p1!==p2?"Passwords don't match":undefined}/>
   <GradBtn loading={l}>Set new password</GradBtn></form>
  <Link href="/login" className="mt-6 block text-center text-sm text-purple-400">Back to login</Link></AuthLayout>}

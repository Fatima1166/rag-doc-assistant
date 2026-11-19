"use client"
import {useEffect,useState} from "react";import Link from "next/link";import {useRouter} from "next/navigation";import {toast} from "sonner"
import {API,wantsRemember} from "@/lib/api";import {nextPath,signIn,startSession} from "@/lib/auth";import {AuthLayout,Field,GradBtn,Social} from "@/components/auth/AuthLayout"
export default function Login(){const r=useRouter();const [e,setE]=useState("");const [p,setP]=useState("");const [l,setL]=useState(false);const [rm,setRm]=useState(false)
 // Surfaced when an OAuth round-trip failed (backend redirects back with ?oauth_error=1).
 useEffect(()=>{if(new URLSearchParams(location.search).has("oauth_error"))toast.error("Social sign-in failed — try again or use email.");setRm(wantsRemember())},[])
 async function submit(ev:React.FormEvent){ev.preventDefault();setL(true)
  try{
   if(API){await signIn(e,p,rm)}else{await new Promise(x=>setTimeout(x,900));startSession({name:e.split("@")[0],email:e},rm)}
   toast.success("Signed in");r.push(nextPath())
  }catch(err){toast.error(err instanceof Error?err.message:"Sign in failed");setL(false)}}
 return <AuthLayout><h1 className="text-2xl font-bold">Sign in</h1><p className="mb-6 text-sm text-[var(--muted)]">Welcome back to RAGDocs.</p>
  <form className="space-y-4" onSubmit={submit}>
   <Field label="Email" type="email" name="email" autoComplete="email" value={e} onChange={setE}/><Field label="Password" type="password" name="password" autoComplete="current-password" value={p} onChange={setP}/>
   <div className="flex items-center justify-between text-sm"><label className="flex items-center gap-2"><input type="checkbox" checked={rm} onChange={x=>setRm(x.target.checked)} className="accent-purple-500"/>Remember me on this device</label><Link href="/forgot-password" className="text-purple-400">Forgot password?</Link></div>
   <p className="text-xs text-[var(--muted)]">{rm?"Stays signed in after you close the browser.":"Your session ends when you close the browser."}</p>
   <GradBtn loading={l}>Sign in</GradBtn></form><Social/>
  <p className="mt-6 text-center text-sm text-[var(--muted)]">Don't have an account? <Link href="/signup" className="text-purple-400">Sign up</Link></p></AuthLayout>}

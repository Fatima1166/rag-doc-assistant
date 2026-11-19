"use client"
import {useState} from "react";import Link from "next/link";import {useRouter} from "next/navigation";import {toast} from "sonner";import confetti from "canvas-confetti"
import {API} from "@/lib/api";import {signUp,startSession} from "@/lib/auth";import {AuthLayout,Field,GradBtn,Social} from "@/components/auth/AuthLayout"
function score(p:string){return [p.length>=8,/[A-Z]/.test(p),/\d/.test(p),/[^A-Za-z0-9]/.test(p)].filter(Boolean).length}
export default function Signup(){const r=useRouter();const [n,setN]=useState("");const [e,setE]=useState("");const [p,setP]=useState("");const [c,setC]=useState("");const [t,setT]=useState(false);const [l,setL]=useState(false)
 const s=score(p);const color=s<=1?"bg-red-500":s<=3?"bg-amber-500":"bg-green-500"
 async function submit(ev:React.FormEvent){ev.preventDefault();if(p!==c)return toast.error("Passwords don't match");if(!t)return toast.error("Accept the terms to continue")
  setL(true)
  try{
   if(API){await signUp(n,e,p)}else{await new Promise(x=>setTimeout(x,900));startSession({name:n,email:e})}
   confetti({particleCount:140,spread:80,origin:{y:.6}});toast.success("Account created");if(API)toast.info("Check your inbox to confirm your email.");setTimeout(()=>r.push("/chat"),1200)
  }catch(err){toast.error(err instanceof Error?err.message:"Sign up failed");setL(false)}}
 return <AuthLayout wave><h1 className="text-2xl font-bold">Create your account</h1><p className="mb-6 text-sm text-[var(--muted)]">Start chatting with your docs in minutes.</p>
  <form className="space-y-4" onSubmit={submit}><Field label="Full name" name="name" autoComplete="name" value={n} onChange={setN}/><Field label="Email" type="email" name="email" autoComplete="email" value={e} onChange={setE}/><Field label="Password" type="password" name="password" autoComplete="new-password" value={p} onChange={setP}/>
   <div className="h-1.5 overflow-hidden rounded bg-[var(--line)]" role="progressbar" aria-label="Password strength" aria-valuenow={s} aria-valuemax={4}><div className={`h-full transition-all ${color}`} style={{width:`${s*25}%`}}/></div>{p&&<p className="-mt-2 text-xs text-[var(--muted)]">Password strength: <span className="font-medium">{["Too short","Weak","Fair","Good","Strong"][s]}</span></p>}
   <Field label="Confirm password" type="password" name="confirm" autoComplete="new-password" error={c&&c!==p?"Passwords don't match":undefined} value={c} onChange={setC}/>
   <label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={t} onChange={x=>setT(x.target.checked)} className="mt-1 accent-purple-500"/><span>I accept the <Link href="/terms" className="text-purple-400 underline">Terms</Link> and <Link href="/privacy" className="text-purple-400 underline">Privacy Policy</Link></span></label>
   <GradBtn loading={l}>Create account</GradBtn></form><Social/>
  <p className="mt-6 text-center text-sm text-[var(--muted)]">Already have an account? <Link href="/login" className="text-purple-400">Sign in</Link></p></AuthLayout>}

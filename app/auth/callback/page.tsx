"use client"
import {useEffect,useState} from "react";import Link from "next/link";import {setToken,me,logout} from "@/lib/api";import {startSession} from "@/lib/auth";import {AuthLayout} from "@/components/auth/AuthLayout"
/** OAuth landing: the backend redirects here with #token=… (fragment = never sent to any server).
    We store the token, prove it against /api/me, then open a normal local session. */
export default function Callback(){const [err,setErr]=useState<string|null>(null)
 useEffect(()=>{(async()=>{
  const t=location.hash.match(/(?:^|&)token=([^&]+)/)?.[1]
  if(!t){setErr("Missing sign-in token — start again from the login page.");return}
  setToken(t)
  try{const p=await me();startSession({name:p.name,email:p.email,verified:p.verified});location.replace("/chat")}
  catch{logout();setErr("This sign-in session could not be verified. Please try again.")}
 })()},[])
 return <AuthLayout split={false}>{err
  ?<div className="text-center"><h1 className="text-xl font-bold">Sign-in failed</h1><p className="mt-1 text-sm text-[var(--muted)]">{err}</p>
    <Link href="/login" className="mt-6 block text-center text-sm text-purple-400">Back to login</Link></div>
  :<div className="flex flex-col items-center gap-3 py-6"><span className="size-8 animate-spin rounded-full border-2 border-purple-500/30 border-t-purple-500"/><p className="text-sm text-[var(--muted)]">Signing you in…</p></div>}</AuthLayout>}

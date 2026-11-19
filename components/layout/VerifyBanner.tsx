"use client"
import {useState} from "react";import {Mail} from "lucide-react";import {toast} from "sonner"
import {API,resendVerification} from "@/lib/api";import {useUser} from "@/lib/auth"
/** Gentle, non-blocking reminder shown app-wide until the email is confirmed. */
export function VerifyBanner(){const user=useUser();const [busy,setBusy]=useState(false)
 if(!API||!user||user.verified)return null
 const resend=async()=>{setBusy(true);try{await resendVerification();toast.success("Confirmation email sent")}
  catch(e){toast.error(e instanceof Error?e.message:"Couldn't resend right now")}finally{setBusy(false)}}
 return <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 border-b border-amber-500/30 bg-amber-500/10 px-4 py-2 text-center text-sm text-amber-600 dark:text-amber-300">
  <span className="flex items-center gap-2"><Mail size={16} aria-hidden/>Confirm your email to secure your account — we sent a link to <b className="font-semibold">{user.email}</b>.</span>
  <button disabled={busy} onClick={resend} className="font-medium underline underline-offset-2 transition hover:text-amber-500 disabled:opacity-60">{busy?"Sending…":"Resend email"}</button></div>}

"use client"
import {useEffect,useState} from "react"
import {API,restoreToken,logout as apiLogout,me,signup as apiSignup,login as apiLogin,wantsRemember,type PublicUser} from "./api"

export type User={name:string;email:string;verified?:boolean}
const KEY="ragdocs-user",COOKIE="ragdocs_session",TICK="ragdocs-session"

/** Write (or clear) the local cache + the marker cookie that middleware.ts checks, then notify listeners.
 *  The cookie mirrors the token's lifetime: "remember me" persists it, otherwise it ends with the browser session. */
function setLocal(u:User|null,remember=false){
 if(u)localStorage.setItem(KEY,JSON.stringify(u));else localStorage.removeItem(KEY)
 document.cookie=u?`${COOKIE}=1; path=/; samesite=lax${remember?`; max-age=${60*60*24*30}`:""}`:`${COOKIE}=; path=/; max-age=0`
 window.dispatchEvent(new Event(TICK))
}
const DEFAULT_USER:User={name:"Guest User",email:"user@ragdocs.local",verified:true}
export function readUser():User|null{
 try{
  const cached=localStorage.getItem(KEY)
  if(cached)return JSON.parse(cached)
  return DEFAULT_USER
 }catch{return DEFAULT_USER}
}

/** Demo sign-in (mock mode). In API mode this is only a local cache — real auth happens via signIn/signUp. */
export function startSession(u:User,remember=false){setLocal(u,remember)}
export function endSession(){apiLogout();setLocal(null)}
export function nextPath(){const n=new URLSearchParams(location.search).get("next");return n&&n.startsWith("/")&&!n.startsWith("//")?n:"/chat"}

export async function signIn(email:string,password:string,remember=false):Promise<User>{
 if(!API){const u={name:email.split("@")[0]||"Demo",email,verified:true};startSession(u,remember);return u}
 const p=await apiLogin(email,password,remember);const u={name:p.name,email:p.email,verified:p.verified};startSession(u,remember);return u
}
export async function signUp(name:string,email:string,password:string,remember=false):Promise<User>{
 if(!API){const u={name,email,verified:true};startSession(u,remember);return u}
 const p=await apiSignup(name,email,password,remember);const u={name:p.name,email:p.email,verified:p.verified};startSession(u,remember);return u
}

/** On boot: validate the stored token against the server and refresh the cached profile. */
export async function restoreSession():Promise<User|null>{
 const local=readUser()
 if(!API)return local
 if(!restoreToken()){return local}
 try{
  const p:PublicUser=await me();const u={name:p.name,email:p.email,verified:p.verified}
  if(!local||local.name!==u.name||local.email!==u.email||local.verified!==u.verified)setLocal(u,wantsRemember())
  return u
 }catch(e){
  return local
 }
}

/** Re-pull the profile from the server and refresh the cache (e.g. after email verification). */
export async function refreshUser():Promise<User|null>{
 if(!API||!restoreToken())return readUser()
 try{const p=await me();const u={name:p.name,email:p.email,verified:p.verified};setLocal(u,wantsRemember());return u}
 catch{return readUser()}
}

/** Live user hook: re-renders every tab when the session changes. */
export function useUser(){
 const [u,setU]=useState<User|null>(null)
 useEffect(()=>{
  let alive=true
  const sync=()=>alive&&setU(readUser())
  sync()
  if(API)restoreSession().finally(sync)
  window.addEventListener(TICK,sync)
  return ()=>{alive=false;window.removeEventListener(TICK,sync)}
 },[])
 return u
}

/** Apply a saved profile locally so the sidebar/header update without a round-trip. */
export function cacheUser(u:User){setLocal(u,wantsRemember())}

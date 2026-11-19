"use client"
import {useEffect,useState} from "react"
import {useQuery} from "@tanstack/react-query"
import {API,health,type Health} from "./api"

/** Is the browser itself offline? (The server can still be down while this is true.) */
export function useOnline(){const [on,setOn]=useState(true)
 useEffect(()=>{const upd=()=>setOn(navigator.onLine!==false);upd()
  addEventListener("online",upd);addEventListener("offline",upd)
  return()=>{removeEventListener("online",upd);removeEventListener("offline",upd)}},[])
 return on}

/** Poll the backend's unauthenticated /health probe so a stopped server shows up
 *  as a message instead of a page full of failed requests. */
export function useServerStatus(){
 const online=useOnline()
 const q=useQuery<Health>({queryKey:["health"],queryFn:health,
  enabled:!!API&&online,refetchInterval:API?30000:false,refetchOnWindowFocus:false,retry:false,staleTime:20000})
 return {online,checking:!!API&&online&&q.isPending,down:!!API&&!q.isPending&&q.isError,info:q.data??null,refetch:q.refetch}}

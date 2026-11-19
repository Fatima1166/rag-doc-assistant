"use client"
import {useQueryClient} from "@tanstack/react-query";import {toast} from "sonner";import {useDocs} from "./docs";import {API,uploadDoc,indexUrl} from "./api";import {validateFile,kindOf,sizeLabel} from "./files";import type {UploadResult} from "./api"
export function useIngest(){const qc=useQueryClient();const add=useDocs(s=>s.add);const patch=useDocs(s=>s.patch);const remove=useDocs(s=>s.remove)
 const refresh=()=>qc.invalidateQueries({queryKey:["docs"]})
 /** The server answers a repeated upload with the document it already has, so the
     optimistic row (client-side id) has to go and the warning has to say why. */
 const settled=(local:string,r:UploadResult)=>{refresh();if(!r.deduped)return false
  remove(local);toast.warning(r.message??"Already indexed — the same content is in your documents");return true}
 const files=(list:FileList|File[]|null)=>{let n=0
  ;[...(list??[])].forEach(f=>{const err=validateFile(f);if(err)return void toast.error(err);n++
   const id=add(f.name,kindOf(f),sizeLabel(f),!API)
   if(API)uploadDoc(f,p=>patch(id,{progress:Math.min(p,95),stage:"uploading"})).then(r=>settled(id,r)).catch(e=>{patch(id,{status:"error",stage:"failed",error:e.message});toast.error(e.message)})})
  if(n)toast.success(API?(n>1?`Uploading ${n} files`:"Uploading"):(n>1?`Indexing ${n} files`:"Indexing started"))}
 const url=async(u:string)=>{let valid=false;try{const x=new URL(u);valid=x.protocol==="http:"||x.protocol==="https:"}catch{}
  if(!valid){toast.error("Enter a full URL starting with http:// or https://");return false}
  const id=add(u,"url","—",!API);let dup=false
  if(API){try{dup=settled(id,await indexUrl(u))}catch(e:any){patch(id,{status:"error",stage:"failed",error:e.message});toast.error(e.message);return false}}
  if(!dup)toast.success("Indexing started");return true}
 return {files,url}}

import {create} from "zustand";import {persist} from "zustand/middleware"
import {API} from "./api"
export type Doc={id:string;name:string;kind:"pdf"|"url"|"text";chunks:number;size:string;at:number;status:"ready"|"indexing"|"error";progress:number;stage?:string;error?:string|null;pages?:number;tags?:string[]}
/** Real lifecycle labels. `stage` comes from the server (backend/app/main.py `_stage`);
 *  "uploading" is the one phase only the browser can see, so it sets that itself. */
export const STAGES:Record<string,string>={uploading:"Uploading",queued:"Queued",extracting:"Extracting text",chunking:"Splitting into chunks",indexing:"Building search index",ready:"Ready",failed:"Failed"}
export const stageName=(d:Doc)=>STAGES[d.stage??""]??STAGES.indexing
type D={docs:Doc[];add:(name:string,kind:Doc["kind"],size:string,simulate?:boolean)=>string;patch:(id:string,p:Partial<Doc>)=>void;remove:(id:string)=>void;reindex:(id:string)=>void;setAll:(d:Doc[])=>void;addSamples:()=>void}
const seed=(id:string,name:string,kind:Doc["kind"],chunks:number,size:string,ago:number,pages?:number,tags?:string[]):Doc=>({id,name,kind,chunks,size,at:Date.now()-ago,status:"ready",progress:100,pages,tags})
export const useDocs=create<D>()(persist((set,get)=>{
 const run=(id:string)=>{const t=setInterval(()=>{const d=get().docs.find(x=>x.id===id);if(!d){clearInterval(t);return}
  if(d.name.includes("fail")&&d.progress>=48){clearInterval(t);get().patch(id,{status:"error"});return}
  const p=Math.min(100,d.progress+12);if(p>=100){clearInterval(t);get().patch(id,{progress:100,status:"ready",chunks:20+Math.floor(Math.random()*60)})}else get().patch(id,{progress:p})},400)}
 return {docs:API?[]:[seed("a","getting-started.pdf","pdf",42,"1.2 MB",36e5,18,["guide"]),seed("b","https://example.com/docs","url",118,"—",864e5,undefined,["api"])],
  add:(name,kind,size,simulate=true)=>{const id=Math.random().toString(36).slice(2);set(s=>({docs:[{id,name,kind,chunks:0,size,at:Date.now(),status:"indexing",progress:0},...s.docs]}));if(simulate)run(id);return id},
  patch:(id,p)=>set(s=>({docs:s.docs.map(d=>d.id===id?{...d,...p}:d)})),remove:id=>set(s=>({docs:s.docs.filter(d=>d.id!==id)})),
  reindex:id=>{get().patch(id,{status:"indexing",progress:0,chunks:0});run(id)},setAll:d=>set({docs:d}),
  addSamples:()=>{if(API)return;set(s=>({docs:[seed("s1","api-reference.pdf","pdf",64,"2.4 MB",0,26,["api","reference"]),seed("s2","https://example.com/docs/webhooks","url",31,"—",0,undefined,["webhooks"]),...s.docs.filter(d=>d.id!=="s1"&&d.id!=="s2")]}))}}},
 {name:"ragdocs-docs",merge:(p:any,c)=>({...c,...p,docs:(p?.docs??c.docs).map((d:Doc)=>d.status==="indexing"?{...d,status:"error" as const}:d)})}))

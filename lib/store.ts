import {create} from "zustand";import {persist,createJSONStorage} from "zustand/middleware"
import {API,fetchConversations,upsertConversation,deleteConversation,clearConversations,type ServerConv} from "./api"
import type {Conversation,Msg} from "./types"
export const uid=()=>Math.random().toString(36).slice(2,10)

/* Local snapshot is stored per user (ragdocs-chats:<key>) so accounts never share a cache. */
let _ns="demo"
const userStorage={
 getItem:(n:string)=>{try{return localStorage.getItem(`${n}:${_ns}`)}catch{return null}},
 setItem:(n:string,v:string)=>{try{localStorage.setItem(`${n}:${_ns}`,v)}catch{}},
 removeItem:(n:string)=>{try{localStorage.removeItem(`${n}:${_ns}`)}catch{}},
}
type S={convs:Conversation[];activeId:string|null;ns:string;hydrated:boolean;failed:Record<string,true>;retrying:boolean
 newChat:()=>string;setActive:(id:string)=>void;rename:(id:string,t:string)=>void
 remove:(id:string)=>Conversation|undefined;restore:(c:Conversation)=>void;clearAll:()=>void;pin:(id:string)=>void;setScope:(id:string,ids?:string[])=>void
 addMsg:(id:string,m:Msg)=>void;patchMsg:(id:string,mid:string,p:Partial<Msg>)=>void;truncateFrom:(id:string,mid:string)=>void
 markFailed:(id:string)=>void;markSynced:(id:string)=>void;retryAll:()=>Promise<number>
 hydrate:(key:string)=>Promise<void>}
const upd=(s:S,id:string,f:(c:Conversation)=>Conversation)=>({convs:s.convs.map(c=>c.id===id?f(c):c)})

/* ---------------------- server sync (API mode only) ----------------------- */
const timers=new Map<string,ReturnType<typeof setTimeout>>()
/** Push one conversation. Failures are recorded so the UI can show a retry
 *  instead of swallowing the error — the local snapshot always survives. */
async function pushConv(c:Conversation|undefined):Promise<boolean>{if(!API||!c)return true
 const st=useChat.getState()
 try{await upsertConversation({id:c.id,title:c.title,messages:c.messages,updatedAt:c.updatedAt,pinned:c.pinned,docIds:c.docIds});st.markSynced(c.id);return true}
 catch{st.markFailed(c.id);return false}}
function sync(id:string){if(!API)return;clearTimeout(timers.get(id));timers.set(id,setTimeout(()=>{timers.delete(id);pushConv(useChat.getState().convs.find(c=>c.id===id))},1200))}
function unsync(id:string){clearTimeout(timers.get(id));timers.delete(id)}
let _hydrating:Promise<void>|null=null

export const useChat=create<S>()(persist((set,get)=>({convs:[],activeId:null,ns:"demo",hydrated:false,failed:{},retrying:false,
 newChat:()=>{const id=uid();set(s=>({convs:[{id,title:"New chat",messages:[],updatedAt:Date.now()},...s.convs],activeId:id}));return id},
 setActive:id=>set({activeId:id}),rename:(id,t)=>{set(s=>upd(s,id,c=>({...c,title:t})));sync(id)},
 remove:id=>{const c=get().convs.find(x=>x.id===id);set(s=>({convs:s.convs.filter(x=>x.id!==id),activeId:s.activeId===id?null:s.activeId}));unsync(id);if(API&&get().hydrated)deleteConversation(id).catch(()=>{});return c},
 restore:c=>{set(s=>({convs:[c,...s.convs.filter(x=>x.id!==c.id)],activeId:c.id}));sync(c.id)},
 clearAll:()=>{set({convs:[],activeId:null,failed:{}});timers.forEach(t=>clearTimeout(t));timers.clear();if(API&&get().hydrated)clearConversations().catch(()=>{})},
 pin:id=>{set(s=>upd(s,id,c=>({...c,pinned:!c.pinned})));sync(id)},setScope:(id,ids)=>{set(s=>upd(s,id,c=>({...c,docIds:ids})));sync(id)},
 addMsg:(id,m)=>{set(s=>upd(s,id,c=>({...c,updatedAt:Date.now(),title:c.messages.length===0&&m.role==="user"?m.content.slice(0,40):c.title,messages:[...c.messages,m]})));sync(id)},
 patchMsg:(id,mid,p)=>{set(s=>upd(s,id,c=>({...c,messages:c.messages.map(m=>m.id===mid?{...m,...p}:m)})));if(p.sources||p.error||p.feedback!==undefined)sync(id)},
 truncateFrom:(id,mid)=>{set(s=>upd(s,id,c=>{const i=c.messages.findIndex(m=>m.id===mid);return i<0?c:{...c,messages:c.messages.slice(0,i)}}));sync(id)},
 markFailed:id=>set(s=>(s.failed[id]?{}:{failed:{...s.failed,[id]:true}})),
 markSynced:id=>set(s=>{if(!(id in s.failed))return {};const {[id]:_drop,...rest}=s.failed;return {failed:rest}}),
 /** Re-send every conversation whose last push failed. Returns how many landed. */
 retryAll:async()=>{const ids=Object.keys(get().failed);if(!ids.length)return 0
  set({retrying:true});let ok=0
  try{for(const id of ids){const c=get().convs.find(x=>x.id===id)
   if(!c){get().markSynced(id);continue}
   if(await pushConv(c))ok++}}finally{set({retrying:false})}
  return ok},

 /* Local-first hydration: load this user's snapshot, reconcile with the server, upload anything pending. */
 hydrate:async(key)=>{_ns=key
  if(!API){set({ns:key,hydrated:true});return}
  if(get().ns===key&&get().hydrated)return
  if(get().ns===key&&_hydrating)return _hydrating
  if(get().ns!==key)set({convs:[],activeId:null,hydrated:false,ns:key}) // switched accounts: drop the stale view
  const job=(async()=>{
   try{await useChat.persist.rehydrate?.()}catch{}
   let server:ServerConv[]
   try{server=await fetchConversations()}catch{set({hydrated:true});return} // offline: keep the local snapshot
   const local=get().convs,byId=new Map(local.map(c=>[c.id,c])),out:Conversation[]=[],pending:Conversation[]=[]
   for(const sc of server){const l=byId.get(sc.id);byId.delete(sc.id)
    if(l&&l.updatedAt>sc.updatedAt){out.push(l);pending.push(l)} // local edits not uploaded yet win
    else out.push({id:sc.id,title:sc.title,messages:sc.messages??[],updatedAt:sc.updatedAt,pinned:sc.pinned,docIds:sc.docIds})}
   for(const l of byId.values()){out.push(l);pending.push(l)} // conversations only local has
   set(s=>({convs:out,hydrated:true,activeId:s.activeId&&out.some(c=>c.id===s.activeId)?s.activeId:null}))
   pending.forEach(pushConv)})()
  _hydrating=job;try{await job}finally{if(_hydrating===job)_hydrating=null}}
}),{name:"ragdocs-chats",version:1,storage:createJSONStorage(()=>userStorage),partialize:s=>({convs:s.convs,activeId:s.activeId,ns:s.ns})}))

import type {Source} from "./types";import type {Doc} from "./docs";import {mockStream,type StreamArgs} from "./mock"
/** Set NEXT_PUBLIC_API_URL to talk to a real backend. Unset = demo mode with mock data. */
export const API=process.env.NEXT_PUBLIC_API_URL

/* ---- session token (kept here so this module never imports auth.ts) ---- */
let _token:string|null=null
const TOKEN_KEY="ragdocs_token",REMEMBER_KEY="ragdocs_remember"
/** "Remember me" puts the token in localStorage so it survives a restart;
 *  otherwise it lives in sessionStorage and dies with the tab. Only one bucket
 *  ever holds it, so a previous choice can't quietly extend the session. */
export function setToken(t:string|null,remember=false){_token=t;try{
 if(!t){sessionStorage.removeItem(TOKEN_KEY);localStorage.removeItem(TOKEN_KEY);return}
 ;(remember?localStorage:sessionStorage).setItem(TOKEN_KEY,t)
 ;(remember?sessionStorage:localStorage).removeItem(TOKEN_KEY)
 remember?localStorage.setItem(REMEMBER_KEY,"1"):localStorage.removeItem(REMEMBER_KEY)}catch{}}
export function wantsRemember(){try{return localStorage.getItem(REMEMBER_KEY)==="1"}catch{return false}}
export function getToken():string|null{if(_token===null){try{_token=localStorage.getItem(TOKEN_KEY)??sessionStorage.getItem(TOKEN_KEY)}catch{}}return _token}
/** Re-read the token from storage on client boot. */
export function restoreToken():string|null{try{_token=localStorage.getItem(TOKEN_KEY)??sessionStorage.getItem(TOKEN_KEY)}catch{}return _token}
const auth=():Record<string,string>=>{const t=getToken();return t?{Authorization:`Bearer ${t}`}:{}}

const SEP="\n[[SOURCES]]"
export class Unauthorized extends Error{constructor(){super("Not authenticated");this.name="Unauthorized"}}
async function ok(r:Response){if(r.status===401){setToken(null);if(typeof window!=="undefined")window.dispatchEvent(new Event("ragdocs-unauthorized"));throw new Unauthorized()}if(!r.ok){let m=`Request failed (${r.status})`;try{const d=(await r.json()).detail;if(typeof d==="string")m=d}catch{}throw new Error(m)}return r}
const json=(body:unknown,withAuth=true)=>({method:"POST",headers:{"Content-Type":"application/json",...(withAuth?auth():{})},body:JSON.stringify(body)})

/* ---------------------------------- auth ---------------------------------- */
export type PublicUser={id:string;name:string;email:string;verified:boolean;reverified?:boolean;avatar?:string}
async function authPost(path:string,body:unknown){const r=await ok(await fetch(`${API}${path}`,json(body,false)));return r.json()}
export async function signup(name:string,email:string,password:string,remember=false):Promise<PublicUser>{const j=await authPost("/api/auth/signup",{name,email,password});setToken(j.token,remember);return j.user}
export async function login(email:string,password:string,remember=false):Promise<PublicUser>{const j=await authPost("/api/auth/login",{email,password});setToken(j.token,remember);return j.user}
/** Changing the password invalidates every older token; the server hands back a
 *  fresh one so this device stays signed in. */
export async function changePassword(current:string,neu:string):Promise<PublicUser>{
 const j=await ok(await fetch(`${API}/api/auth/change-password`,json({current,new:neu})))
 const d=await j.json();setToken(d.token,wantsRemember());return d.user}
export async function forgotPassword(email:string){await authPost("/api/auth/forgot-password",{email})}
export async function resetPassword(token:string,password:string){await authPost("/api/auth/reset-password",{token,password})}
/** Confirm an email address from the link token. Works logged-out (opened from email). */
export async function verifyEmail(token:string):Promise<PublicUser>{const j=await authPost("/api/auth/verify-email",{token});return j.user}
/** Re-send the confirmation link for the signed-in account (needs the Bearer token). */
export async function resendVerification(){await ok(await fetch(`${API}/api/auth/resend-verification`,{method:"POST",headers:auth()}))}
export async function me():Promise<PublicUser>{const r=await ok(await fetch(`${API}/api/me`,{headers:auth()}));return r.json()}
export async function updateProfile(name:string,email?:string):Promise<PublicUser>{
 const r=await ok(await fetch(`${API}/api/me`,{method:"PATCH",headers:{"Content-Type":"application/json",...auth()},body:JSON.stringify(email?{name,email}:{name})}))
 return r.json()}
/** Everything this account owns, as one JSON blob. */
export async function exportAccount():Promise<unknown>{const r=await ok(await fetch(`${API}/api/me/export`,{headers:auth()}));return r.json()}
/** Irreversible. The backend refuses without the current password. */
export async function deleteAccount(password:string){await ok(await fetch(`${API}/api/me`,{method:"DELETE",headers:{"Content-Type":"application/json",...auth()},body:JSON.stringify({password})}))}
export function logout(){setToken(null)}

/** Which social sign-ins the server has credentials for (so the UI never offers a dead button). */
export type Providers={google:boolean;github:boolean}
export async function getProviders():Promise<Providers>{const r=await fetch(`${API}/api/auth/providers`,{cache:"no-store"});if(!r.ok)throw new Error(`Server answered ${r.status}`);return r.json()}
/** The stored original. Needs the Bearer token, so it can't be a plain <a href>: fetch it, then use a blob URL. */
export async function fetchDocFile(id:string):Promise<Blob>{const r=await ok(await fetch(`${API}/api/documents/${id}/download`,{headers:auth()}));return r.blob()}

/* ------------------------------ server health ----------------------------- */
export type Health={ok:boolean;chunks:number;model:string;llm:string;auth_required:boolean;stats:{total_documents:number;ready_documents:number;total_chunks:number;total_size_bytes:number}}
/** Unauthenticated liveness probe: tells the UI whether the API is reachable at all. */
export async function health():Promise<Health>{const r=await fetch(`${API}/health`,{cache:"no-store"});if(!r.ok)throw new Error(`Health check failed (${r.status})`);return r.json()}

/* ------------------------------ retrieval prefs --------------------------- */
export type Prefs={top_k:number;chunk_size:number;chunk_overlap:number}
export async function getPrefs():Promise<Prefs>{const r=await ok(await fetch(`${API}/api/me/prefs`,{headers:auth()}));return r.json()}
export type Usage={days:{day:string;requests:number;prompt_tokens:number;completion_tokens:number}[];totals:{requests:number;prompt_tokens:number;completion_tokens:number};estimated:boolean;model:string;context_tokens:number;answer_cache_seconds:number}
/** Estimated token use for this account — the backend counts characters, it
 *  doesn't see Groq's invoice. */
export async function getUsage():Promise<Usage>{const r=await ok(await fetch(`${API}/api/me/usage`,{headers:auth()}));return r.json()}
export async function patchPrefs(p:Partial<Prefs>):Promise<Prefs>{
 const r=await ok(await fetch(`${API}/api/me/prefs`,{method:"PATCH",headers:{"Content-Type":"application/json",...auth()},body:JSON.stringify(p)}))
 return r.json()}

/** Backend contract: stream plain text, then "\n[[SOURCES]]" followed by a JSON array of {id,title,snippet,url,page?}. */
export async function streamChat(a:StreamArgs):Promise<Source[]>{
 if(!API)return mockStream(a)
 const r=await ok(await fetch(`${API}/api/chat`,{...json({messages:a.messages,doc_ids:a.docs.map(d=>d.id),fresh:!!a.fresh}),signal:a.signal}))
 if(!r.body)throw new Error("Empty response")
 const rd=r.body.getReader(),dec=new TextDecoder();let buf=""
 for(;;){const {done,value}=await rd.read();if(done)break;buf+=dec.decode(value,{stream:true});const i=buf.indexOf(SEP);a.onChunk(i<0?buf:buf.slice(0,i))}
 const i=buf.indexOf(SEP);return i<0?[]:JSON.parse(buf.slice(i+SEP.length))}

const mapDoc=(d:any):Doc=>({id:String(d.id),name:d.name,kind:d.kind??"text",chunks:d.chunks??0,size:d.size??"—",
 at:d.created_at?Date.parse(d.created_at):Date.now(),status:d.status??"ready",progress:d.status==="ready"?100:(d.progress??0),
 stage:d.stage||undefined,error:d.error||null,pages:d.num_pages??0,tags:Array.isArray(d.tags)?d.tags:[]})
export async function listDocs():Promise<Doc[]>{const j=await(await ok(await fetch(`${API}/api/documents`,{headers:auth()}))).json()
 return j.map(mapDoc)}

/** Resolves with the server's answer: `deduped` means the bytes were already
 *  indexed, and the id is the document the caller already had. */
export type UploadResult={id:string;name?:string;status?:string;deduped?:boolean;message?:string}
export function uploadDoc(f:File,onProgress:(p:number)=>void):Promise<UploadResult>{return new Promise((res,rej)=>{const x=new XMLHttpRequest();x.open("POST",`${API}/api/documents`)
 Object.entries(auth()).forEach(([k,v])=>x.setRequestHeader(k,v as string))
 x.upload.onprogress=e=>e.lengthComputable&&onProgress(Math.round(e.loaded/e.total*100))
 x.onload=()=>{if(x.status<300){let b:UploadResult={id:""};try{b=JSON.parse(x.responseText)}catch{};res(b)}else rej(new Error(`Upload failed (${x.status})`))}
 x.onerror=()=>rej(new Error("Network error"))
 const fd=new FormData();fd.append("file",f);x.send(fd)})}
export const indexUrl=async(url:string):Promise<UploadResult>=>{const r=await ok(await fetch(`${API}/api/documents/url`,json({url})));return r.json()}
export const deleteDoc=async(id:string)=>{await ok(await fetch(`${API}/api/documents/${id}`,{method:"DELETE",headers:auth()}))}
/** Bulk delete. The server ignores ids the caller doesn't own. */
export const deleteDocs=async(ids:string[])=>{const r=await ok(await fetch(`${API}/api/documents`,{method:"DELETE",headers:{"Content-Type":"application/json",...auth()},body:JSON.stringify({ids})}));return (await r.json()).deleted as number}
/** Rename and/or re-tag — never triggers a re-index. */
export const patchDoc=async(id:string,p:{name?:string;tags?:string[]}):Promise<Doc>=>{
 const r=await ok(await fetch(`${API}/api/documents/${id}`,{method:"PATCH",headers:{"Content-Type":"application/json",...auth()},body:JSON.stringify(p)}))
 return mapDoc(await r.json())}
export const reindexDoc=async(id:string)=>{await ok(await fetch(`${API}/api/documents/${id}/reindex`,{method:"POST",headers:auth()}))}
export const fetchDocChunks=async(id:string):Promise<{doc_id:string;name:string;chunks:{id:number;ord:number;page:number|null;url:string|null;text:string}[]}>=>{
 if(!API)return {doc_id:id,name:"Document",chunks:[]}
 const r=await ok(await fetch(`${API}/api/documents/${id}/chunks`,{headers:auth()}))
 return r.json()}
export type SearchHit={id:number;doc_id:string;doc_name:string;ord:number;page:number|null;url:string|null;text:string;score:number}
export const searchDocs=async(query:string,docIds?:string[],topK=8):Promise<SearchHit[]>=>{
 if(!API)return []
 const r=await ok(await fetch(`${API}/api/search`,json({query,doc_ids:docIds,top_k:topK})))
 return (await r.json()).results as SearchHit[]}
/** API keys are only ever sent to your server and never stored in the browser.
 *  Only the fields you actually filled are sent, so saving one key can't wipe the other. */
export async function saveKeys(k:{groq:string;pinecone:string}){if(!API)return {demo:true}
 const b:Record<string,string>={};if(k.groq.trim())b.groq=k.groq.trim();if(k.pinecone.trim())b.pinecone=k.pinecone.trim()
 if(!Object.keys(b).length)throw new Error("Enter at least one key")
 await ok(await fetch(`${API}/api/settings/keys`,json(b)));return {demo:false}}
export type KeyStatus={groq_configured:boolean;groq_source:"saved"|"env"|"none";groq_model:string;pinecone_configured:boolean;pinecone_source:"saved"|"env"|"none";retrieval:string;scope?:string}
export async function fetchKeysStatus():Promise<KeyStatus>{
 if(!API)return {groq_configured:false,groq_source:"none",groq_model:"llama-3.3-70b-versatile",pinecone_configured:false,pinecone_source:"none",retrieval:"bm25",scope:"account"}
 const r=await ok(await fetch(`${API}/api/settings/keys`,{headers:auth()}))
 return r.json()}
/** Forget a stored key. `cleared:false` means the server environment supplies it, which the app can't remove. */
export async function clearKey(provider:"groq"|"pinecone"):Promise<{cleared:boolean;status:KeyStatus}>{
 const r=await ok(await fetch(`${API}/api/settings/keys?provider=${provider}`,{method:"DELETE",headers:auth()}))
 const d=await r.json();return {cleared:d.cleared,status:d.status}}

/* ------------------------------ conversations ----------------------------- */
export type ServerConv={id:string;title:string;messages:import("./types").Msg[];updatedAt:number;pinned?:boolean;docIds?:string[]}
export async function fetchConversations():Promise<ServerConv[]>{const r=await ok(await fetch(`${API}/api/conversations`,{headers:auth()}));return r.json()}
export async function upsertConversation(c:ServerConv){await ok(await fetch(`${API}/api/conversations`,{method:"PUT",headers:{"Content-Type":"application/json",...auth()},body:JSON.stringify(c)}))}
export async function deleteConversation(id:string){await ok(await fetch(`${API}/api/conversations/${id}`,{method:"DELETE",headers:auth()}))}
export async function clearConversations(){await ok(await fetch(`${API}/api/conversations`,{method:"DELETE",headers:auth()}))}

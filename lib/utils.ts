import {clsx,type ClassValue} from "clsx";import {twMerge} from "tailwind-merge"
export const cn=(...i:ClassValue[])=>twMerge(clsx(i))
/** A short window of words centred on the first matched term — search snippets read like the passage, not its header. */
export function around(text:string,term:string,words=24){const flat=text.replace(/\s+/g," ").trim(),first=(term.trim().split(/\s+/)[0]||"").replace(/[.*+?^${}()|[\]\\]/g,"\\$&")
 if(!first)return flat.slice(0,120)
 const parts=flat.split(" "),start=parts.findIndex(w=>new RegExp(first,"i").test(w));if(start<0)return flat.slice(0,120)
 const from=Math.max(0,start-Math.floor(words/3)),to=from+words
 return `${from>0?"…":""}${parts.slice(from,to).join(" ")}${parts.length>to?"…":""}`}
export function timeAgo(t:number){const s=Math.max(1,Math.round((Date.now()-t)/1000));if(s<60)return "just now";const m=Math.round(s/60);if(m<60)return `${m}m ago`;const h=Math.round(m/60);if(h<24)return `${h}h ago`;const d=Math.round(h/24);return d<7?`${d}d ago`:new Date(t).toLocaleDateString()}
export function groupByDate<T extends {updatedAt:number;pinned?:boolean}>(items:T[]){
 const out:[string,T[]][]=[];const start=new Date();start.setHours(0,0,0,0);const s=start.getTime(),day=864e5
 items.slice().sort((a,b)=>b.updatedAt-a.updatedAt).forEach(x=>{const t=x.updatedAt;const l=x.pinned?"Pinned":t>=s?"Today":t>=s-day?"Yesterday":t>=s-7*day?"Previous 7 days":"Older";const g=out.find(o=>o[0]===l);g?g[1].push(x):out.push([l,[x]])})
 const order=["Pinned","Today","Yesterday","Previous 7 days","Older"];return out.sort((a,b)=>order.indexOf(a[0])-order.indexOf(b[0]))}

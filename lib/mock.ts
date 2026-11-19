import type {Source} from "./types"
export type DocRef={id:string;name:string;kind:string}
/** `fresh` asks the server to skip its answer cache — what "Regenerate" means to a user. */
export type StreamArgs={messages:{role:string;content:string}[];docs:DocRef[];signal:AbortSignal;onChunk:(t:string)=>void;fresh?:boolean}
export const SUGGESTED=["How do I authenticate API requests?","Summarize the getting-started guide","What are the rate limits?","Show an example webhook handler"]
const ANSWER=`Based on your documentation:\n\n## Authentication\n\nSend your key as a **Bearer token** in the \`Authorization\` header [1]:\n\n\`\`\`bash\ncurl -H "Authorization: Bearer $KEY" https://api.example.com/v1/items\n\`\`\`\n\n- Keys are scoped per project [1]\n- Requests are limited to *60 per minute* [2]\n- Going over the limit returns \`429\`, so retry with backoff [2]\n\n| Plan | Limit |\n|------|-------|\n| Free | 60 / min |\n| Pro | 600 / min |\n\n> If a detail isn't in your documents, I'll say so instead of guessing.`
const NONE="I can't answer that yet. There are no indexed documents in this chat's scope, and I only answer from your documents, so I won't guess. Add a document on the Documents page or widen the sources for this chat."
const link=(d:DocRef)=>d.kind==="url"?d.name:""
export const sources=(d:DocRef[]):Source[]=>[
 {id:"s1",title:d[0].name,page:4,url:link(d[0]),snippet:"Pass your API key in the Authorization header as a Bearer token. Keys are scoped per project."},
 {id:"s2",title:(d[1]??d[0]).name,page:12,url:link(d[1]??d[0]),snippet:"Requests are limited to 60 per minute per key. Exceeding the limit returns HTTP 429."}]
export function mockStream(a:StreamArgs):Promise<Source[]>{return new Promise((res,rej)=>{
 let tick:ReturnType<typeof setInterval>|undefined;const wait=setTimeout(start,700)
 a.signal.addEventListener("abort",()=>{clearTimeout(wait);clearInterval(tick);rej(new DOMException("Aborted","AbortError"))},{once:true})
 function start(){const q=a.messages[a.messages.length-1]?.content??""
  if(/\b(error|fail)\b/i.test(q))return rej(new Error("The model service is unavailable. Please try again."))
  const text=a.docs.length?ANSWER:NONE;let i=0
  tick=setInterval(()=>{i+=3;a.onChunk(text.slice(0,i));if(i>=text.length){clearInterval(tick);res(a.docs.length?sources(a.docs):[])}},30)}})}

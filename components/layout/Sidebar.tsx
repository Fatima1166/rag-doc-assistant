"use client"
import {useEffect,useState} from "react";import Link from "next/link";import {usePathname,useRouter} from "next/navigation";import {motion,AnimatePresence} from "framer-motion"
import {Plus,Trash2,Pencil,Pin,PinOff,Home,MessageSquare,FileText,Sparkles,Menu,LogOut} from "lucide-react"
import {useChat} from "@/lib/store";import {groupByDate,timeAgo} from "@/lib/utils";import {useUser,endSession} from "@/lib/auth";import {ThemeToggle} from "@/components/theme-toggle";import {Avatar} from "@/components/ui/avatar";import {toast} from "sonner";
const NAV=[["Home","/",Home],["Chat","/chat",MessageSquare],["Documents","/documents",FileText]] as const
const act="rounded p-1 text-[var(--muted)] opacity-0 transition hover:text-[var(--fg)] group-hover:opacity-100 focus:opacity-100 [@media(hover:none)]:opacity-100"
export function Sidebar({onPick}:{onPick?:()=>void}){
 const {convs,activeId,newChat,setActive,rename,remove,restore,pin}=useChat();const router=useRouter();const path=usePathname();const user=useUser()
 const [mounted,setMounted]=useState(false);useEffect(()=>setMounted(true),[]);const [q,setQ]=useState("");const [edit,setEdit]=useState<string|null>(null)
 const groups=mounted?groupByDate(convs.filter(c=>c.title.toLowerCase().includes(q.toLowerCase()))):[]
 const open=(id:string)=>{setActive(id);router.push("/chat");onPick?.()}
 return <aside className="flex h-full w-[280px] flex-col gap-3 border-r border-[var(--line)] p-4" aria-label="Conversations">
  <div className="flex items-center justify-between"><Link href="/" className="flex items-center gap-2 font-semibold"><span className="grad grid size-8 place-items-center rounded-lg"><Sparkles size={16} className="text-white"/></span>RAGDocs</Link><ThemeToggle/></div>
  <nav className="space-y-1" aria-label="App">{NAV.map(([n,h,I])=>{const on=path===h;return <Link key={h} href={h} onClick={()=>onPick?.()} aria-current={on?"page":undefined} className={`flex items-center gap-3 rounded-xl border-l-2 px-3 py-2 text-sm transition ${on?"border-purple-500 bg-gradient-to-r from-purple-500/25 to-cyan-500/10 font-medium":"border-transparent text-[var(--muted)] hover:bg-purple-500/10 hover:text-[var(--fg)]"}`}><I size={16}/>{n}</Link>})}</nav>
  <button onClick={()=>{newChat();router.push("/chat");onPick?.()}} className="grad flex items-center justify-center gap-2 rounded-xl py-2.5 font-medium text-white shadow-lg shadow-purple-500/25 transition hover:scale-[1.02] active:scale-[.98]"><Plus size={18}/>New chat</button>
  <ul className="-mx-1 flex-1 overflow-y-auto px-1">{groups.map(([label,items])=><li key={label}><p className="px-2 pb-1 pt-3 text-[11px] font-semibold uppercase tracking-wider text-[var(--muted)]">{label}</p>
   <ul className="space-y-1">{items.map(c=><li key={c.id} className={`group flex items-center gap-0.5 rounded-lg border-l-2 px-2 py-1.5 text-sm ${c.id===activeId?"border-purple-500 bg-purple-500/15":"border-transparent hover:bg-purple-500/10"}`}>
    {edit===c.id?<input autoFocus defaultValue={c.title} aria-label="Rename chat" onBlur={e=>{rename(c.id,e.target.value.trim()||c.title);setEdit(null)}} onKeyDown={e=>{if(e.key==="Enter")(e.target as HTMLInputElement).blur();if(e.key==="Escape")setEdit(null)}} className="w-full bg-transparent outline-none"/>
    :<button className="min-w-0 flex-1 text-left" onClick={()=>open(c.id)}><span className="block truncate">{c.title}</span><span className="block text-xs text-[var(--muted)]">{timeAgo(c.updatedAt)}</span></button>}
    <button aria-label={c.pinned?"Unpin chat":"Pin chat"} onClick={()=>pin(c.id)} className={act}>{c.pinned?<PinOff size={14}/>:<Pin size={14}/>}</button>
    <button aria-label="Rename chat" onClick={()=>setEdit(c.id)} className={act}><Pencil size={14}/></button>
    <button aria-label="Delete chat" onClick={()=>{const d=remove(c.id);if(d)toast("Chat deleted",{action:{label:"Undo",onClick:()=>restore(d)}})}} className={act}><Trash2 size={14}/></button></li>)}</ul></li>)}
   {mounted&&!groups.length&&<li className="p-2 text-sm text-[var(--muted)]">{q?"No chats match.":"No chats yet."}</li>}</ul>
  <button onClick={()=>{endSession();toast("Signed out");router.push("/")}} className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm text-[var(--muted)] transition hover:bg-red-500/10 hover:text-red-400"><LogOut size={16}/>Sign out</button>
  </aside>}
export function MobileSidebar({open,onClose}:{open:boolean;onClose:()=>void}){return <AnimatePresence>{open&&<motion.div className="fixed inset-0 z-50 flex md:hidden" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}>
 <motion.div className="h-full bg-[var(--bg)] shadow-2xl" initial={{x:-280}} animate={{x:0}} exit={{x:-280}} transition={{type:"spring",damping:28,stiffness:300}}><Sidebar onPick={onClose}/></motion.div>
 <button aria-label="Close menu" className="flex-1 bg-black/50 backdrop-blur-sm" onClick={onClose}/></motion.div>}</AnimatePresence>}
export function AppShell({children}:{children:React.ReactNode}){const [o,setO]=useState(false)
 return <div className="flex h-dvh"><div className="hidden md:block"><Sidebar/></div><MobileSidebar open={o} onClose={()=>setO(false)}/>
  <div className="flex min-w-0 flex-1 flex-col overflow-y-auto"><header className="sticky top-0 z-30 flex items-center gap-3 border-b border-[var(--line)] p-3 backdrop-blur-xl md:hidden"><button aria-label="Open menu" onClick={()=>setO(true)}><Menu/></button><span className="font-semibold">RAGDocs</span></header>{children}</div></div>}

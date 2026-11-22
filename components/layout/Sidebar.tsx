"use client"
import { useEffect, useState } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"
import { Plus, Trash2, Pencil, Pin, PinOff, MessageSquare, FileText, Menu, LogOut } from "lucide-react"
import { toast } from "sonner"
import { useChat } from "@/lib/store"
import { groupByDate, timeAgo } from "@/lib/utils"
import { useUser, endSession } from "@/lib/auth"
import { ThemeToggle } from "@/components/theme-toggle"
import { Avatar } from "@/components/ui/avatar"
import { Wordmark } from "@/components/ui/logo"

const NAV = [["Chat", "/chat", MessageSquare], ["Documents", "/documents", FileText]] as const
const act = "rounded p-1 text-muted opacity-0 transition hover:text-ink group-hover:opacity-100 focus:opacity-100 [@media(hover:none)]:opacity-100"

export function Sidebar({ onPick }: { onPick?: () => void }) {
  const { convs, activeId, newChat, setActive, rename, remove, restore, pin } = useChat()
  const router = useRouter()
  const path = usePathname()
  const user = useUser()
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  const [q, setQ] = useState("")
  const [edit, setEdit] = useState<string | null>(null)
  const groups = mounted ? groupByDate(convs.filter((c) => c.title.toLowerCase().includes(q.toLowerCase()))) : []
  const open = (id: string) => { setActive(id); router.push("/chat"); onPick?.() }

  return (
    <aside className="flex h-full w-[284px] flex-col gap-3 border-r border-rule bg-paper/60 p-4" aria-label="Conversations">
      <div className="flex items-center justify-between">
        <Link href="/chat" aria-label="RAGDocs home"><Wordmark /></Link>
        <ThemeToggle />
      </div>
      <nav className="space-y-0.5" aria-label="App">
        {NAV.map(([n, h, I]) => {
          const on = path === h
          return (
            <Link key={h} href={h} onClick={() => onPick?.()} aria-current={on ? "page" : undefined}
              className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition ${on ? "bg-sunken font-medium text-ink" : "text-muted hover:bg-sunken/70 hover:text-ink"}`}>
              <I size={16} className={on ? "text-moss" : ""} />{n}
              {on && <span className="ml-auto size-1.5 rounded-full bg-moss" />}
            </Link>
          )
        })}
      </nav>
      <button onClick={() => { newChat(); router.push("/chat"); onPick?.() }} className="btn btn-primary w-full"><Plus size={17} />New chat</button>
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search chats" aria-label="Search chats" className="field !py-1.5" />
      <ul className="-mx-1 flex-1 overflow-y-auto px-1">
        {groups.map(([label, items]) => (
          <li key={label}>
            <p className="eyebrow px-2 pb-1 pt-3 !text-[10px]">{label}</p>
            <ul className="space-y-0.5">
              {items.map((c) => (
                <li key={c.id} className={`group flex items-center gap-0.5 rounded-lg px-2 py-1.5 text-sm ${c.id === activeId ? "bg-sunken" : "hover:bg-sunken/60"}`}>
                  {edit === c.id ? (
                    <input autoFocus defaultValue={c.title} aria-label="Rename chat" className="w-full bg-transparent outline-none"
                      onBlur={(e) => { rename(c.id, e.target.value.trim() || c.title); setEdit(null) }}
                      onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); if (e.key === "Escape") setEdit(null) }} />
                  ) : (
                    <button className="min-w-0 flex-1 text-left" onClick={() => open(c.id)}>
                      <span className="block truncate">{c.title}</span>
                      <span className="block font-mono text-[10px] text-muted">{timeAgo(c.updatedAt)}</span>
                    </button>
                  )}
                  <button aria-label={c.pinned ? "Unpin chat" : "Pin chat"} onClick={() => pin(c.id)} className={act}>{c.pinned ? <PinOff size={14} /> : <Pin size={14} />}</button>
                  <button aria-label="Rename chat" onClick={() => setEdit(c.id)} className={act}><Pencil size={14} /></button>
                  <button aria-label="Delete chat" onClick={() => { const d = remove(c.id); if (d) toast("Chat deleted", { action: { label: "Undo", onClick: () => restore(d) } }) }} className={act}><Trash2 size={14} /></button>
                </li>
              ))}
            </ul>
          </li>
        ))}
        {mounted && !groups.length && <li className="p-2 text-sm text-muted">{q ? "No chats match." : "No chats yet."}</li>}
      </ul>
      {user && (
        <div className="flex items-center gap-3 rounded-xl border border-rule bg-card p-2.5">
          <Avatar name={user.name} src={user.avatar} size={36} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{user.name}</p>
            <p className="truncate text-xs text-muted" title={user.email}>{user.email}</p>
          </div>
          <button aria-label="Sign out" title="Sign out" onClick={() => { endSession(); toast("Signed out"); router.push("/") }} className="btn btn-ghost !p-2 hover:!text-clay"><LogOut size={16} /></button>
        </div>
      )}
    </aside>
  )
}

export function MobileSidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-50 flex md:hidden" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <motion.div className="h-full bg-paper shadow-2xl" initial={{ x: -284 }} animate={{ x: 0 }} exit={{ x: -284 }} transition={{ type: "spring", damping: 28, stiffness: 300 }}>
            <Sidebar onPick={onClose} />
          </motion.div>
          <button aria-label="Close menu" className="flex-1 bg-ink/50 backdrop-blur-[2px]" onClick={onClose} />
        </motion.div>
      )}
    </AnimatePresence>
  )
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const [o, setO] = useState(false)
  return (
    <div className="flex h-dvh">
      <div className="hidden md:block"><Sidebar /></div>
      <MobileSidebar open={o} onClose={() => setO(false)} />
      <div className="flex min-w-0 flex-1 flex-col overflow-y-auto">
        <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-rule bg-paper/90 p-3 backdrop-blur md:hidden">
          <button aria-label="Open menu" onClick={() => setO(true)}><Menu /></button>
          <Wordmark />
        </header>
        {children}
      </div>
    </div>
  )
}

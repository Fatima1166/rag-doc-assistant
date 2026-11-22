"use client"
import { useRef, useState } from "react"
import { ArrowUp, Square } from "lucide-react"
import { AttachButton, MicButton } from "./InputTools"
export function ChatInput({ onSend, onStop, busy }: { onSend: (t: string) => void; onStop: () => void; busy: boolean }) {
  const [t, setT] = useState("")
  const ta = useRef<HTMLTextAreaElement>(null)
  const fit = () => { const e = ta.current; if (e) { e.style.height = "auto"; e.style.height = Math.min(e.scrollHeight, 200) + "px" } }
  const submit = () => { if (!t.trim() || busy) return; onSend(t); setT(""); requestAnimationFrame(fit) }
  return (
    <form onSubmit={(e) => { e.preventDefault(); submit() }} className="card mx-auto flex max-w-3xl items-end gap-1 p-2 transition focus-within:border-moss focus-within:shadow-[0_0_0_3px_color-mix(in_srgb,var(--moss)_20%,transparent)]">
      <AttachButton />
      <textarea ref={ta} value={t} onChange={(e) => { setT(e.target.value); fit() }} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit() } }}
        rows={1} placeholder="Ask about your documents…" aria-label="Message" className="max-h-[200px] min-w-0 flex-1 resize-none bg-transparent px-2 py-2.5 text-[15px] outline-none placeholder:text-muted" />
      <MicButton onText={(x) => { setT((v) => (v + " " + x).trim()); requestAnimationFrame(fit) }} />
      {busy
        ? <button type="button" aria-label="Stop generating" onClick={onStop} className="btn btn-primary size-10 shrink-0 !p-0"><Square size={15} /></button>
        : <button aria-label="Send message" disabled={!t.trim()} className="btn btn-primary size-10 shrink-0 !p-0"><ArrowUp size={18} /></button>}
    </form>
  )
}

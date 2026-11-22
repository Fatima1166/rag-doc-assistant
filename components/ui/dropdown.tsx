"use client"
import { useEffect, useRef, useState } from "react"
import { MoreHorizontal } from "lucide-react"
export function Dropdown({ label, items }: { label: string; items: { text: string; onClick: () => void; danger?: boolean }[] }) {
  const [o, setO] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  const btn = useRef<HTMLButtonElement>(null)
  const els = () => [...(root.current?.querySelectorAll<HTMLElement>("[role=menuitem]") ?? [])]
  const focus = (i: number) => { const l = els(); if (l.length) l[(i + l.length) % l.length].focus() }
  useEffect(() => {
    if (!o) return
    focus(0)
    const f = (e: MouseEvent) => !root.current?.contains(e.target as Node) && setO(false)
    addEventListener("mousedown", f)
    return () => removeEventListener("mousedown", f)
  }, [o])
  const onKey = (e: React.KeyboardEvent) => {
    if (!o) return
    const i = els().indexOf(document.activeElement as HTMLElement)
    if (e.key === "ArrowDown") { e.preventDefault(); focus(i + 1) }
    else if (e.key === "ArrowUp") { e.preventDefault(); focus(i - 1) }
    else if (e.key === "Home") { e.preventDefault(); focus(0) }
    else if (e.key === "End") { e.preventDefault(); focus(-1) }
    else if (e.key === "Escape") { setO(false); btn.current?.focus() }
    else if (e.key === "Tab") setO(false)
  }
  return (
    <div ref={root} className="relative" onKeyDown={onKey}>
      <button ref={btn} aria-label={label} aria-haspopup="menu" aria-expanded={o} onClick={() => setO(!o)} className="btn btn-ghost !p-1.5"><MoreHorizontal size={18} /></button>
      {o && (
        <ul role="menu" aria-label={label} className="card absolute right-0 z-30 mt-1 min-w-44 p-1">
          {items.map((i) => (
            <li key={i.text} role="none">
              <button role="menuitem" tabIndex={-1} onClick={() => { i.onClick(); setO(false); btn.current?.focus() }}
                className={`w-full rounded-lg px-3 py-1.5 text-left text-sm outline-none hover:bg-sunken focus:bg-sunken ${i.danger ? "text-clay" : ""}`}>{i.text}</button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

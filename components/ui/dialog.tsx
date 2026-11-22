"use client"
import { useEffect, useRef } from "react"
import { motion } from "framer-motion"
import { X } from "lucide-react"
const SEL = 'a[href],button,input,textarea,select,[tabindex]:not([tabindex="-1"])'
const W = { md: "max-w-lg", lg: "max-w-2xl", xl: "max-w-6xl" } as const
type P = { open: boolean; onClose: () => void; title: string; children: React.ReactNode; bare?: boolean; top?: boolean; size?: keyof typeof W }
/** `bare` = no built-in header/padding (caller draws its own); `top` = pinned near the top (palette). */
export function Dialog({ open, onClose, title, children, bare, top, size = "md" }: P) {
  const ref = useRef<HTMLDivElement>(null)
  const close = useRef(onClose)
  close.current = onClose
  useEffect(() => {
    if (!open) return
    const el = ref.current!
    const prev = document.activeElement as HTMLElement | null
    const items = () => [...el.querySelectorAll<HTMLElement>(SEL)].filter((x) => !x.hasAttribute("disabled"))
    ;(el.querySelector<HTMLElement>("[data-autofocus]") ?? items()[0] ?? el).focus()
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.stopPropagation(); close.current(); return }
      if (e.key !== "Tab") return
      const l = items()
      if (!l.length) { e.preventDefault(); return }
      const a = l[0], z = l[l.length - 1]
      if (e.shiftKey && document.activeElement === a) { e.preventDefault(); z.focus() }
      else if (!e.shiftKey && document.activeElement === z) { e.preventDefault(); a.focus() }
    }
    document.addEventListener("keydown", key)
    const ov = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => { document.removeEventListener("keydown", key); document.body.style.overflow = ov; prev?.focus?.() }
  }, [open])
  if (!open) return null
  return (
    <div className={`fixed inset-0 z-50 grid justify-items-center bg-ink/55 p-3 backdrop-blur-[3px] sm:p-4 ${top ? "items-start pt-[12vh]" : "items-center"}`}
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <motion.div ref={ref} role="dialog" aria-modal="true" aria-label={title} tabIndex={-1}
        initial={{ opacity: 0, scale: 0.97, y: 8 }} animate={{ opacity: 1, scale: 1, y: 0 }} transition={{ duration: 0.18 }}
        className={`w-full ${W[size]} rounded-2xl border border-rule bg-card shadow-2xl ${bare ? "overflow-hidden" : "max-h-[88dvh] overflow-y-auto p-6"}`}>
        {!bare && (
          <div className="mb-4 flex items-center justify-between gap-3">
            <h3 className="font-serif text-lg font-semibold">{title}</h3>
            <button aria-label="Close" onClick={onClose} className="btn btn-ghost !p-1.5"><X size={18} /></button>
          </div>
        )}
        {children}
      </motion.div>
    </div>
  )
}

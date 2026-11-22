"use client"
import Link from "next/link"
import { Upload } from "lucide-react"
import { motion } from "framer-motion"
import { useDocs } from "@/lib/docs"
import { LogoMark } from "@/components/ui/logo"

export function EmptyState({ onPick }: { onPick: (q: string) => void }) {
  const ready = useDocs((s) => s.docs).filter((d) => d.status === "ready")
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mx-auto mt-10 max-w-xl text-center sm:mt-20">
      <span className="mx-auto inline-block"><LogoMark size={46} /></span>
      <h2 className="mt-5 font-serif text-4xl font-semibold leading-tight tracking-tight">What would you like to <span className="marker italic">find</span>?</h2>
      {ready.length ? (
        <>
          <p className="mt-3 text-muted">Searching {ready.length} document{ready.length === 1 ? "" : "s"}. Every answer comes with the page it was read from.</p>
          <div className="mt-6 flex flex-wrap justify-center gap-2">
            {["Summarize the main points", "What are the key requirements?", "List any deadlines or limits"].map((q) => (
              <button key={q} onClick={() => onPick(q)} className="btn btn-quiet !rounded-full !py-1.5 text-muted hover:text-ink">{q}</button>
            ))}
          </div>
        </>
      ) : (
        <div className="card mt-8 p-6">
          <p className="text-sm text-muted">There's nothing to search yet. Add a document and ask away.</p>
          <Link href="/documents" className="btn btn-primary mt-4"><Upload size={16} />Add documents</Link>
        </div>
      )}
    </motion.div>
  )
}

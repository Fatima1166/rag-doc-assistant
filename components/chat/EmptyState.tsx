"use client"
import Link from "next/link"
import {Sparkles,Upload} from "lucide-react"
import {motion} from "framer-motion"
import {useDocs} from "@/lib/docs"

export function EmptyState({onPick}:{onPick:(q:string)=>void}){
  const docs=useDocs(s=>s.docs)
  const hasReadyDocs=docs.some(d=>d.status==="ready")

  return (
    <motion.div initial={{opacity:0,y:12}} animate={{opacity:1,y:0}} className="mx-auto mt-8 max-w-xl text-center sm:mt-16">
      <span className="grad float mx-auto mb-4 grid size-16 place-items-center rounded-2xl shadow-lg shadow-purple-500/40">
        <Sparkles size={30} className="text-white"/>
      </span>
      <h2 className="grad-text text-4xl font-bold">Ask me anything</h2>
      <p className="mt-2 text-[var(--muted)]">Answers come directly from your indexed documents.</p>

      {hasReadyDocs ? (
        <div className="glass mt-8 p-6 text-sm text-[var(--muted)]">
          <p>Type your question in the box below to chat with your documents.</p>
        </div>
      ) : (
        <div className="glass mt-8 p-6">
          <p className="text-sm text-[var(--muted)]">You don&apos;t have any indexed documents yet.</p>
          <div className="mt-4 flex justify-center">
            <Link
              href="/documents"
              className="grad inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-medium text-white shadow-lg shadow-purple-500/25 transition hover:scale-105 active:scale-95"
            >
              <Upload size={16}/>Upload documents
            </Link>
          </div>
        </div>
      )}
    </motion.div>
  )
}

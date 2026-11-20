import { create } from "zustand"
import { persist } from "zustand/middleware"

export type Doc = {
  id: string
  name: string
  kind: "pdf" | "url" | "text"
  chunks: number
  size: string
  at: number
  status: "ready" | "indexing" | "error"
  progress: number
  stage?: string
  error?: string | null
  pages?: number
  tags?: string[]
}

export const STAGES: Record<string, string> = {
  uploading: "Uploading",
  queued: "Queued",
  extracting: "Extracting text",
  chunking: "Splitting into chunks",
  indexing: "Building search index",
  ready: "Ready",
  failed: "Failed"
}

export const stageName = (d: Doc) => STAGES[d.stage ?? ""] ?? STAGES.indexing

type D = {
  docs: Doc[]
  add: (name: string, kind: Doc["kind"], size: string, simulate?: boolean) => string
  patch: (id: string, p: Partial<Doc>) => void
  remove: (id: string) => void
  reindex: (id: string) => void
  setAll: (d: Doc[]) => void
  addSamples: () => void
}

export const useDocs = create<D>()(
  persist(
    (set, get) => {
      const run = (id: string) => {
        const t = setInterval(() => {
          const d = get().docs.find((x) => x.id === id)
          if (!d) {
            clearInterval(t)
            return
          }
          if (d.name.includes("fail") && d.progress >= 48) {
            clearInterval(t)
            get().patch(id, { status: "error" })
            return
          }
          const p = Math.min(100, d.progress + 12)
          if (p >= 100) {
            clearInterval(t)
            get().patch(id, { progress: 100, status: "ready", chunks: 20 + Math.floor(Math.random() * 60) })
          } else {
            get().patch(id, { progress: p })
          }
        }, 400)
      }

      return {
        docs: [],
        add: (name, kind, size, simulate = true) => {
          const id = Math.random().toString(36).slice(2)
          set((s) => ({
            docs: [{ id, name, kind, chunks: 0, size, at: Date.now(), status: "indexing", progress: 0 }, ...s.docs]
          }))
          if (simulate) run(id)
          return id
        },
        patch: (id, p) => set((s) => ({ docs: s.docs.map((d) => (d.id === id ? { ...d, ...p } : d)) })),
        remove: (id) => set((s) => ({ docs: s.docs.filter((d) => d.id !== id) })),
        reindex: (id) => {
          get().patch(id, { status: "indexing", progress: 0, chunks: 0 })
          run(id)
        },
        setAll: (d) => set({ docs: d }),
        addSamples: () => {}
      }
    },
    {
      name: "ragdocs-docs",
      merge: (p: any, c) => ({
        ...c,
        ...p,
        docs: (p?.docs ?? c.docs).map((d: Doc) => (d.status === "indexing" ? { ...d, status: "error" as const } : d))
      })
    }
  )
)

import { create } from "zustand"
/** Open the document reader from anywhere (chat citations, command palette, documents list). */
export type ViewerTarget = { docId: string; page?: number | null; snippet?: string; query?: string }
type V = { target: ViewerTarget | null; open: (t: ViewerTarget) => void; close: () => void }
export const useViewer = create<V>((set) => ({ target: null, open: (t) => set({ target: t }), close: () => set({ target: null }) }))

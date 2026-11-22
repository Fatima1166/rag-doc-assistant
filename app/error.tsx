"use client"
import { useEffect } from "react"
import { AlertCircle } from "lucide-react"
export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error(error) }, [error])
  return (
    <main id="main" className="grid min-h-dvh place-items-center p-6">
      <div role="alert" className="card max-w-md p-8 text-center">
        <AlertCircle className="mx-auto text-clay" size={34} />
        <h1 className="mt-3 font-serif text-2xl font-semibold">Something went wrong</h1>
        <p className="mt-1 text-sm text-muted">This page failed to load. Try again, and reload the app if it keeps happening.</p>
        <button onClick={reset} className="btn btn-primary mt-5">Try again</button>
      </div>
    </main>
  )
}

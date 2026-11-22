import Link from "next/link"
import { Wordmark } from "@/components/ui/logo"
export default function NotFound() {
  return (
    <main id="main" className="grid min-h-dvh place-items-center p-6 text-center">
      <div>
        <Wordmark className="mb-8" />
        <p className="font-serif text-8xl font-semibold text-moss">404</p>
        <p className="mt-3 text-muted">That page isn't in the <span className="marker">index</span>.</p>
        <Link href="/" className="btn btn-primary mt-6">Back to home</Link>
      </div>
    </main>
  )
}

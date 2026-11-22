"use client"
import { useEffect, useState } from "react"
import { usePathname, useRouter } from "next/navigation"
import { ThemeProvider, useTheme } from "next-themes"
import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query"
import { MotionConfig } from "framer-motion"
import { Toaster } from "sonner"
import { CommandPalette } from "@/components/layout/CommandPalette"
import { SyncStatus } from "@/components/layout/SyncStatus"
import { DocViewer } from "@/components/viewer/DocViewer"
import { API, listDocs } from "@/lib/api"
import { endSession, useSession } from "@/lib/auth"
import { useDocs, type Doc } from "@/lib/docs"

function ThemedToaster() {
  const { resolvedTheme } = useTheme()
  return <Toaster position="bottom-right" theme={resolvedTheme === "dark" ? "dark" : "light"} toastOptions={{ classNames: { toast: "!rounded-xl !border-rule !bg-card !text-ink !font-sans" } }} />
}

/** Keeps the signed-in account honest: redirects when there's no session, signs out on a 401,
 *  and loads the document list once so chat + reader work without visiting /documents first. */
function AppEffects() {
  const path = usePathname()
  const router = useRouter()
  const { user, ready } = useSession()
  const inApp = ["/chat", "/documents"].some((p) => path.startsWith(p))
  const setAll = useDocs((s) => s.setAll)

  useEffect(() => { if (API && ready && inApp && !user) router.replace("/") }, [ready, user, inApp, router])
  useEffect(() => {
    const f = () => { endSession(); router.replace("/?oauth_error=1&reason=expired") }
    addEventListener("ragdocs-unauthorized", f)
    return () => removeEventListener("ragdocs-unauthorized", f)
  }, [router])

  const q = useQuery({
    queryKey: ["docs"], queryFn: listDocs, enabled: !!API && inApp && !!user,
    refetchInterval: (x) => ((x.state.data as Doc[] | undefined)?.some((d) => d.status === "indexing") ? 2000 : false),
  })
  useEffect(() => { if (q.data) setAll(q.data) }, [q.data, setAll])
  return null
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [qc] = useState(() => new QueryClient())
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <QueryClientProvider client={qc}>
        <MotionConfig reducedMotion="user">
          {children}
          <AppEffects />
          <CommandPalette />
          <SyncStatus />
          <DocViewer />
        </MotionConfig>
        <ThemedToaster />
      </QueryClientProvider>
    </ThemeProvider>
  )
}

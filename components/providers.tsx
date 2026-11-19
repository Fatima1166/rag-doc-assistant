"use client"
import {ThemeProvider,useTheme} from "next-themes";import {QueryClient,QueryClientProvider} from "@tanstack/react-query"
import {MotionConfig} from "framer-motion";import {CommandPalette} from "@/components/layout/CommandPalette";import {SyncStatus} from "@/components/layout/SyncStatus";import {Toaster} from "sonner";import {useState} from "react"
function ThemedToaster(){const {resolvedTheme}=useTheme();return <Toaster richColors position="bottom-right" theme={resolvedTheme==="light"?"light":"dark"}/>}
export function Providers({children}:{children:React.ReactNode}){const [qc]=useState(()=>new QueryClient())
 return <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange><QueryClientProvider client={qc}><MotionConfig reducedMotion="user">{children}<CommandPalette/><SyncStatus/></MotionConfig><ThemedToaster/></QueryClientProvider></ThemeProvider>}

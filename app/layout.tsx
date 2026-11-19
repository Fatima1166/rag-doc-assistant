import "./globals.css";import type {Metadata,Viewport} from "next";import {Inter} from "next/font/google";import {Providers} from "@/components/providers"
const inter=Inter({subsets:["latin"]});const desc="Upload your documentation and get answers drawn only from it, with a source for every claim."
export const metadata:Metadata={metadataBase:new URL(process.env.NEXT_PUBLIC_SITE_URL??"http://localhost:3000"),applicationName:"RAGDocs",title:{default:"RAGDocs: chat with your documentation",template:"%s · RAGDocs"},description:desc,
 openGraph:{type:"website",siteName:"RAGDocs",title:"RAGDocs: chat with your documentation",description:desc},twitter:{card:"summary_large_image",title:"RAGDocs",description:desc}}
export const viewport:Viewport={width:"device-width",initialScale:1,themeColor:[{media:"(prefers-color-scheme: dark)",color:"#0a0912"},{media:"(prefers-color-scheme: light)",color:"#f8f7fc"}]}
export default function RootLayout({children}:{children:React.ReactNode}){
 return <html lang="en" data-scroll-behavior="smooth" suppressHydrationWarning><body className={inter.className}><a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-lg focus:bg-purple-600 focus:px-4 focus:py-2 focus:text-white">Skip to content</a><Providers>{children}</Providers></body></html>}

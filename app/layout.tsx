import "./globals.css"
import type { Metadata, Viewport } from "next"
import { Fraunces, Instrument_Sans, JetBrains_Mono } from "next/font/google"
import { Providers } from "@/components/providers"

const serif = Fraunces({ subsets: ["latin"], style: ["normal", "italic"], variable: "--font-serif-ui", display: "swap" })
const sans = Instrument_Sans({ subsets: ["latin"], variable: "--font-sans-ui", display: "swap" })
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono-ui", display: "swap" })

const desc = "Upload your documentation and get answers drawn only from it, with a source for every claim."

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
  applicationName: "RAGDocs",
  title: { default: "RAGDocs: chat with your documentation", template: "%s · RAGDocs" },
  description: desc,
  openGraph: { type: "website", siteName: "RAGDocs", title: "RAGDocs: chat with your documentation", description: desc },
  twitter: { card: "summary_large_image", title: "RAGDocs", description: desc },
}
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#141711" },
    { media: "(prefers-color-scheme: light)", color: "#f3eee3" },
  ],
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-scroll-behavior="smooth" suppressHydrationWarning className={`${serif.variable} ${sans.variable} ${mono.variable}`}>
      <body className="font-sans">
        <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-lg focus:bg-moss focus:px-4 focus:py-2 focus:text-moss-ink">
          Skip to content
        </a>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}

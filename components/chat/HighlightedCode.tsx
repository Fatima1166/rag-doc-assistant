"use client"
import { Prism as SH } from "react-syntax-highlighter"
import { oneDark, oneLight } from "react-syntax-highlighter/dist/esm/styles/prism"
import { useTheme } from "next-themes"
export default function HighlightedCode({ lang, children }: { lang: string; children: string }) {
  const { resolvedTheme } = useTheme()
  return <SH language={lang} style={resolvedTheme === "dark" ? oneDark : oneLight} customStyle={{ margin: 0, borderRadius: 0, fontSize: 13, padding: "14px 16px", background: "var(--sunken)" }}>{children}</SH>
}

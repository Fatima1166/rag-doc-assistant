"use client"
import { useEffect, useState } from "react"
import { useTheme } from "next-themes"
import { Sun, Moon } from "lucide-react"
import { Tip } from "@/components/ui/tooltip"
export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme()
  const [m, setM] = useState(false)
  useEffect(() => setM(true), [])
  const dark = m && resolvedTheme === "dark"
  return (
    <Tip label="Toggle theme">
      <button aria-label="Toggle theme" onClick={() => setTheme(dark ? "light" : "dark")} className="btn btn-quiet size-10 !p-0">
        {dark ? <Moon size={17} /> : <Sun size={17} />}
      </button>
    </Tip>
  )
}

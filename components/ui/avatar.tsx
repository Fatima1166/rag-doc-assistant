"use client"
import { useState } from "react"
/** Shows the provider's profile photo (Google / GitHub) and falls back to an initial. */
export function Avatar({ name, src, size = 36 }: { name: string; src?: string; size?: number }) {
  const [bad, setBad] = useState(false)
  const initial = (name.trim()[0] || "?").toUpperCase()
  if (src && !bad) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={src} alt="" width={size} height={size} referrerPolicy="no-referrer" onError={() => setBad(true)}
        className="shrink-0 rounded-full border border-rule bg-sunken object-cover" style={{ width: size, height: size }} />
    )
  }
  return (
    <span role="img" aria-label={name} className="grid shrink-0 place-items-center rounded-full bg-moss font-serif font-semibold text-moss-ink"
      style={{ width: size, height: size, fontSize: size * 0.42 }}>{initial}</span>
  )
}

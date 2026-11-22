import { extOf } from "@/lib/files"
/** File-type tile: the extension is the icon. */
export function FileGlyph({ name, kind, size = 40 }: { name: string; kind: string; size?: number }) {
  const label = kind === "url" ? "URL" : (extOf(name) || "TXT").slice(0, 4).toUpperCase()
  return (
    <span className="grid shrink-0 place-items-center rounded-lg border border-rule bg-sunken font-mono font-medium tracking-tight text-moss"
      style={{ width: size, height: size, fontSize: size > 36 ? 11 : 10 }} aria-hidden="true">{label}</span>
  )
}

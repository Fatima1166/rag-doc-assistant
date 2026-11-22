/** A page of text with one line highlighted: the whole product in one glyph. */
export function LogoMark({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" className="shrink-0">
      <rect width="32" height="32" rx="8" fill="var(--moss)" />
      <rect x="8" y="8.6" width="16" height="2.4" rx="1.2" fill="var(--moss-ink)" opacity=".9" />
      <rect x="6.5" y="13.8" width="19" height="5.4" rx="1.4" fill="var(--mark)" />
      <rect x="8.5" y="15.3" width="12" height="2.4" rx="1.2" fill="var(--moss)" />
      <rect x="8" y="22" width="10" height="2.4" rx="1.2" fill="var(--moss-ink)" opacity=".9" />
    </svg>
  )
}
export function Wordmark({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <LogoMark size={30} />
      <span className="font-serif text-[1.15rem] font-semibold tracking-tight">RAGDocs</span>
    </span>
  )
}

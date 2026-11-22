export function Tip({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <span className="group/tip relative inline-flex">
      {children}
      <span role="tooltip" className="pointer-events-none absolute left-1/2 top-full z-30 mt-2 -translate-x-1/2 whitespace-nowrap rounded-md bg-ink px-2 py-1 text-xs text-paper opacity-0 transition group-hover/tip:opacity-100 group-focus-within/tip:opacity-100">{label}</span>
    </span>
  )
}

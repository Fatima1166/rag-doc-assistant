import { ImageResponse } from "next/og"
export const alt = "RAGDocs: chat with your documentation"
export const size = { width: 1200, height: 630 }
export const contentType = "image/png"
export default function Image() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "center", padding: 84, background: "#f3eee3", color: "#1e2420" }}>
        <div style={{ fontSize: 34, color: "#2f5d4a", fontWeight: 700 }}>RAGDocs</div>
        <div style={{ fontSize: 86, fontWeight: 700, marginTop: 24, lineHeight: 1.05, display: "flex", flexWrap: "wrap" }}>
          Ask your documents.&nbsp;<span style={{ background: "#f2c94c", padding: "0 12px" }}>Get the page number.</span>
        </div>
        <div style={{ fontSize: 34, marginTop: 30, color: "#646858" }}>Answers only from your files, with a source for every claim.</div>
      </div>
    ),
    size
  )
}

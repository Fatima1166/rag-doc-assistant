import type { MetadataRoute } from "next"
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "RAGDocs",
    short_name: "RAGDocs",
    description: "Chat with your documentation",
    start_url: "/chat",
    display: "standalone",
    background_color: "#f3eee3",
    theme_color: "#2f5d4a",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  }
}

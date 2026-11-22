import { NextResponse, type NextRequest } from "next/server"

const PROTECTED = ["/chat", "/documents"]

/** With a backend configured, the app needs a signed-in account unless explicitly turned off.
 *  This cookie is only a fast redirect hint — the backend is what actually enforces access. */
const REQUIRED = process.env.NEXT_PUBLIC_AUTH_REQUIRED
  ? process.env.NEXT_PUBLIC_AUTH_REQUIRED === "true"
  : !!process.env.NEXT_PUBLIC_API_URL

export function middleware(req: NextRequest) {
  const has = req.cookies.has("ragdocs_session")
  const p = req.nextUrl.pathname
  if (REQUIRED && PROTECTED.some((x) => p.startsWith(x)) && !has) {
    return NextResponse.redirect(new URL("/", req.url))
  }
  return NextResponse.next()
}
export const config = { matcher: ["/chat/:path*", "/documents/:path*"] }

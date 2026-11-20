import {NextResponse,type NextRequest} from "next/server"
const PROTECTED=["/chat","/documents"]
export function middleware(req:NextRequest){
 const has=req.cookies.has("ragdocs_session"),p=req.nextUrl.pathname
 const required=process.env.NEXT_PUBLIC_AUTH_REQUIRED==="true"
 if(required&&PROTECTED.some(x=>p.startsWith(x))&&!has){const u=new URL("/",req.url);return NextResponse.redirect(u)}
 return NextResponse.next()}
export const config={matcher:["/chat/:path*","/documents/:path*"]}

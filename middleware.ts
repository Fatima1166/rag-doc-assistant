import {NextResponse,type NextRequest} from "next/server"
const PROTECTED=["/chat","/documents","/settings"],AUTH=["/login","/signup"]
export function middleware(req:NextRequest){
 const has=req.cookies.has("ragdocs_session"),p=req.nextUrl.pathname
 const required=process.env.NEXT_PUBLIC_AUTH_REQUIRED==="true"
 if(required&&PROTECTED.some(x=>p.startsWith(x))&&!has){const u=new URL("/login",req.url);u.searchParams.set("next",p);return NextResponse.redirect(u)}
 if(AUTH.some(x=>p.startsWith(x))&&has)return NextResponse.redirect(new URL("/chat",req.url))
 return NextResponse.next()}
export const config={matcher:["/chat/:path*","/documents/:path*","/settings/:path*","/login","/signup"]}

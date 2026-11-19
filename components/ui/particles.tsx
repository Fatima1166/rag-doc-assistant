"use client"
import {useEffect,useRef} from "react"
export function Particles(){const r=useRef<HTMLCanvasElement>(null)
 useEffect(()=>{const c=r.current!;const x=c.getContext("2d")!;let w=0,h=0,raf=0;const reduce=matchMedia("(prefers-reduced-motion: reduce)").matches
  const ps=Array.from({length:46},()=>({x:Math.random(),y:Math.random(),vx:(Math.random()-.5)*.0004,vy:(Math.random()-.5)*.0004}))
  const fit=()=>{w=c.width=c.offsetWidth;h=c.height=c.offsetHeight};fit();addEventListener("resize",fit)
  const draw=()=>{x.clearRect(0,0,w,h);ps.forEach((p,i)=>{if(!reduce){p.x=(p.x+p.vx+1)%1;p.y=(p.y+p.vy+1)%1}
   x.fillStyle="rgba(255,255,255,.7)";x.beginPath();x.arc(p.x*w,p.y*h,1.6,0,7);x.fill()
   for(let j=i+1;j<ps.length;j++){const q=ps[j],d=Math.hypot((p.x-q.x)*w,(p.y-q.y)*h);if(d<110){x.strokeStyle=`rgba(255,255,255,${.25*(1-d/110)})`;x.beginPath();x.moveTo(p.x*w,p.y*h);x.lineTo(q.x*w,q.y*h);x.stroke()}}});raf=requestAnimationFrame(draw)}
  draw();return()=>{cancelAnimationFrame(raf);removeEventListener("resize",fit)}},[])
 return <canvas ref={r} className="absolute inset-0 size-full" aria-hidden/>}

"use client"
import {Prism as SH} from "react-syntax-highlighter";import {oneDark} from "react-syntax-highlighter/dist/esm/styles/prism"
export default function HighlightedCode({lang,children}:{lang:string;children:string}){return <SH language={lang} style={oneDark} customStyle={{margin:0,borderRadius:12,fontSize:13,paddingTop:34}}>{children}</SH>}

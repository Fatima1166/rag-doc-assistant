export type Source={id:string;title:string;snippet:string;url:string;page?:number;page_end?:number;doc_id?:string}
export type Msg={id:string;role:"user"|"assistant";content:string;sources?:Source[];ts:number;error?:boolean;feedback?:"up"|"down"}
export type Conversation={id:string;title:string;messages:Msg[];updatedAt:number;pinned?:boolean;docIds?:string[]}

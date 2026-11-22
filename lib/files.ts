export const MAX_MB=20
/** Mirrors the backend's ALLOWED_EXT (backend/app/main.py) — keep both in step. */
export const EXT=[".pdf",".txt",".md",".json",".csv",".docx",".pptx",".xlsx",".py",".js",".ts",".jsx",".tsx",".html",".htm",".log"] as const
export const ACCEPT=EXT.join(",")
export const KIND_LABEL="PDF, TXT, MD, CSV, JSON, DOCX, PPTX, XLSX, HTML, LOG or source code"
export function validateFile(f:File){if(!EXT.some(e=>f.name.toLowerCase().endsWith(e)))return `${f.name}: unsupported type — accepted: ${KIND_LABEL}`;if(f.size>MAX_MB*1048576)return `${f.name}: larger than ${MAX_MB} MB`;return null}
export const kindOf=(f:File):"pdf"|"text"=>f.name.toLowerCase().endsWith(".pdf")?"pdf":"text"
export const sizeLabel=(f:File)=>f.size<1048576?`${Math.max(1,Math.round(f.size/1024))} KB`:(f.size/1048576).toFixed(1)+" MB"
/** Lower-case extension without the dot ("Report.PDF" -> "pdf"). */
export const extOf=(n:string)=>{const m=/\.([a-z0-9]+)$/i.exec(n);return m?m[1].toLowerCase():""}
/** Formats the reader can show as text; Office files can only be downloaded or read as indexed text. */
export const TEXT_EXT=new Set(["txt","md","json","csv","log","py","js","ts","jsx","tsx","html","htm"])
export const OFFICE_EXT=new Set(["docx","pptx","xlsx"])

"use client"
import {Legal,type LegalDoc} from "@/components/legal/LegalShell"

const DOC:LegalDoc={
 title:"Terms of Service",
 updated:"1 November 2026",
 intro:"These terms cover your use of RAGDocs — a documentation assistant that answers questions from the documents you index. RAGDocs is normally self-hosted, so the individual or organisation running the instance you are using is the service provider, and these terms are an agreement between you and that provider.",
 contact:"Questions about these terms? Contact the operator of the instance you signed up on. If you are deploying RAGDocs yourself, these terms are a starting point — review them for your own jurisdiction and use.",
 sections:[
  {h:"1. The service",p:["RAGDocs indexes the files and URLs you submit, splits them into passages, and retrieves those passages to ground its answers. Retrieval is a BM25 keyword index held in memory and rebuilt from the database — there is no embedding step and no vector database."],
   li:["Answers are generated only from material you have indexed. When nothing relevant is found, the assistant is designed to say so.",
       "If the operator has configured a language-model key, answers are written by that model; otherwise the app returns the retrieved passages themselves.",
       "Feature availability depends on the configuration of the instance you use (authentication, uploads, email and social sign-in can all be enabled or disabled by the operator)."]},
  {h:"2. Your account",p:["You are responsible for keeping your password safe and for activity that happens under your credentials. Report unauthorised use to the operator as soon as you notice it. Changing your password invalidates sessions issued before the change."],
   note:"Email verification is required on instances that enable it. Unverified accounts can still be limited by the operator."},
  {h:"3. Your content and your rights",p:["You keep all rights to the documents you upload or index. You grant the operator only the access needed to run the service for you: storing your files, splitting them into passages, and retrieving those passages to answer your questions."],
   li:["Do not index material you have no right to process, and do not use the service to violate someone else's confidentiality, licence or intellectual-property rights.",
       "You are responsible for the questions you ask and the answers you act on."]},
  {h:"4. Acceptable use",p:["Do not use the service to overload it, probe it for weaknesses, gain unauthorised access to other users' data, or upload malicious files. Per-user rate limits apply to authentication and chat requests; large uploads are capped by the operator's configuration (20 MB by default)."],
   note:"Each account can only ever see and search its own documents and conversations; scoping is enforced server-side."},
  {h:"5. Answers are not advice",p:["Generated answers can be wrong, incomplete or out of date, and may quote source passages in a misleading way. Treat them as a search result you still have to read. Every answer carries citations to the passages it used — open them before relying on an answer for anything that matters, especially legal, medical, financial or safety-critical decisions."]},
  {h:"6. Availability, changes and downtime",p:["The service is provided as-is, without an uptime guarantee. Features may be added, changed or removed. The operator may take the instance down for maintenance or for security reasons, and may suspend access if these terms are breached."]},
  {h:"7. Ending your account",p:["You can delete individual documents and chats at any time from the app, export all of your data from Settings, or delete your account. Deletion removes your documents, their indexed passages, your conversations and stored files; it cannot be undone. The operator may terminate access for breach of these terms."]},
  {h:"8. Liability",p:["To the extent the law allows, the operator is not liable for loss arising from reliance on generated answers, or for interruptions to the service. Nothing here limits liability that cannot lawfully be limited, such as for fraud or wilful misconduct."]}
 ]}

export default function Terms(){return <Legal doc={DOC}/>}

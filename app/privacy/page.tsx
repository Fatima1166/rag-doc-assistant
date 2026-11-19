"use client"
import {Legal,type LegalDoc} from "@/components/legal/LegalShell"

const DOC:LegalDoc={
 title:"Privacy Policy",
 updated:"1 November 2026",
 intro:"This policy explains what RAGDocs stores, where it goes, and what you can do about it. RAGDocs is designed to keep your documents on the server you (or your organisation) control — it has no analytics, no advertising trackers and no third-party cookies.",
 contact:"Privacy questions go to the operator of the instance you use. If you host RAGDocs yourself, you are the operator, and this document describes the behaviour of the software you deployed.",
 sections:[
  {h:"1. What we store",p:["Everything the app keeps lives in one server-side database and one upload folder. Nothing about your documents is sent to the browser of another user, and every read and write is scoped to your account id."],
   table:{head:["Data","Why it exists","How long it is kept"],
    rows:[["Your name and email address","Sign-in, verification and password resets","Until you delete the account"],
          ["Your password","Only as a PBKDF2-SHA256 hash (240,000 iterations). Never in plain text, never emailed.","Until you change or delete it"],
          ["Uploaded files","Kept on the server disk so you can download the original again","Until you delete the document"],
          ["Document text, split into passages","This is the index. Retrieval reads it to answer questions","Until you delete the document"],
          ["Your chats, including message text and which sources were in scope","Conversation history and the pin/rename controls in the sidebar","Until you delete the chat or the account"],
          ["API keys you paste in Settings","Stored server-side on disk so answers can be generated; never returned to any browser and never written to local storage","Until you remove them in Settings"]]}},
  {h:"2. What is not collected",p:["There is no product analytics, no session recording, no advertising identifier and no social-plugin tracker on the app pages. The server writes an access log line per request (method, path, status code) for troubleshooting; that is operational logging, not profiling."],
   note:"Session tokens are signed with a server secret and carry your user id, an expiry, and a version of your password hash so a password change can retire old sessions."},
  {h:"3. Who else sees your content",p:["Only the services this instance has been configured to use, and only for the specific step involved."],
   li:["Language model (optional). If a Groq key is configured, your question, the recent turns of the conversation and the retrieved passages are sent to Groq to write the answer. Without a key the app never contacts a model and instead quotes the retrieved passages back to you.",
       "Email provider (optional). Verification and password-reset links are sent through the SMTP account configured on the server. The reset or verification token itself appears only in the link.",
       "Google or GitHub (optional). If social sign-in is enabled, the provider gets your email and display name; RAGDocs receives just enough to sign you in.",
       "URLs you index. Fetching a documentation URL sends a plain request to that site, which sees your server's address."]},
  {h:"4. Cookies",p:["Two cookies are used, both functional."],
   table:{head:["Cookie","Purpose","Lifetime"],
    rows:[["ragdocs_session","A marker with no secret in it, so the app can route you before hydration; the real token stays in browser storage","Ends with the browser session, or 30 days if you tick \"Remember me\""],
          ["ragdocs_oauth_state","Prevents tampering with a social sign-in round-trip","About 10 minutes, cleared on return"]]}},
  {h:"5. How it is protected",p:["Passwords are salted and hashed, never stored plainly. Tokens are HMAC-signed and verified on every request. Document, chunk and conversation queries are filtered by your account id, so one account cannot read another's material. Uploads are checked for extension and size before they are parsed. Access tokens for third-party keys are held on the server, not in the client bundle."],
   note:"Demo mode is different: when an instance runs with authentication disabled, everything is filed under one shared account and is visible to anyone using that instance. Treat such an instance as a public notebook and do not put real material in it."},
  {h:"6. Your choices",p:["You can delete any document or chat at any time, which removes its passages from the index immediately. Settings offers Export data to download your profile, documents with their passages, and conversations as one JSON file, and Delete account to remove all of it, including the stored files. Deleting an account asks for your password because the operation cannot be undone."]},
  {h:"7. Children",p:["RAGDocs is a documentation tool for adults and is not designed for children under 13 (or the equivalent age in your country). If an operator becomes aware that a child's account exists, it should be deleted."]},
  {h:"8. Changes to this policy",p:["If material changes are made, the date at the top of this page changes with them. Continued use after an update means accepting the updated policy."]}
 ]}

export default function Privacy(){return <Legal doc={DOC}/>}

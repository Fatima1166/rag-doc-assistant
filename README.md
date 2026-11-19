# RAGDocs (Next 15 frontend + FastAPI backend)

## Run it (no Docker required)
Two terminals:

```powershell
npm run backend    # FastAPI on http://localhost:8000  (or: backend\run.cmd)
npm run dev        # Next.js on http://localhost:3000
```

`npm run backend` uses the repo's `..\.venv` virtualenv and starts uvicorn with reload and the `PORT` from `backend/.env`. First-time setup if the venv is missing:
`python -m venv .venv && .venv\Scripts\pip install -r backend\requirements.txt` then copy `backend\.env.example` to `backend\.env`.

## Demo mode vs real backend
Without `NEXT_PUBLIC_API_URL` the frontend uses mock data (and any email/password signs in as a demo session). Set it (for example `http://localhost:8000`, already done in `.env.local`) to call the FastAPI server:
- `POST /api/chat` body `{messages, doc_ids, fresh?}`: stream plain text, then `\n[[SOURCES]]` and a JSON array of `{id,title,snippet,url,page?,page_end?,passages?}`. `fresh:true` skips the server's answer cache (what "Regenerate" sends).
- `GET /api/documents` returns `[{id,name,kind,chunks,size,created_at,status,progress,stage,error,num_pages,tags}]`. `stage` is the real lifecycle step (`queued` → `extracting` → `chunking` → `indexing`), and `error` carries the reason a failed document failed.
- `POST /api/documents` (multipart `file`), `POST /api/documents/url` `{url}`, `DELETE /api/documents/{id}`, `POST /api/documents/{id}/reindex`. A repeat of content you already indexed answers `200` with `{deduped:true}` and the existing document instead of a second copy.
- `PATCH /api/documents/{id}` `{name?,tags?}`: rename / re-tag without re-indexing.
- `DELETE /api/documents` body `{ids:[…]}`: bulk delete (foreign ids ignored), returns `{deleted}`.
- `GET /api/documents/{id}/chunks` and `GET /api/documents/{id}/download` back the preview modal.
- `POST /api/search` `{query,doc_ids?,top_k?}` → ranked passages `[{id,doc_id,doc_name,ord,page,url,text,score}]`. The Documents page searches inside document text with it, and Ctrl/Cmd+K shows the same hits.
- `GET|POST|DELETE /api/settings/keys` — read status (`{groq_source,pinecone_source}` is `saved`/`env`/`none`, plus `retrieval:"bm25"` and `scope:"account"`), store a key for **this** account, or forget one (`cleared:false` means the server environment supplies it, which the app can't remove). Enable CORS for the frontend origin.
- `GET /api/me/usage` — this account's daily request and token counts for the last 30 days, plus the context budget and cache window the server is using.

## Retrieval
Passages are found with BM25 (`rank_bm25`) over an index built from SQLite — there is no embedding step and no vector database, so nothing external has to be provisioned. `TOP_K`, `CHUNK_SIZE` and `CHUNK_OVERLAP` in `backend/.env` set the defaults; each account can override them (`PATCH /api/me/prefs`, exposed on the Settings page). Chunk size and overlap apply to documents indexed from then on.
Per question, retrieval pulls a wider candidate pool (`CANDIDATE_POOL`) and then narrows it: MMR selection drops passages that repeat what an earlier pick already said, adjacent passages of the same document are stitched into one contiguous block (so an answer isn't cut in half mid-table), and blocks are added until the estimated token budget (`CONTEXT_TOKENS`) is spent — the estimate over-counts on purpose, because a prompt that fits is worth more than one that is exact. The whole corpus is no longer re-tokenized on every upload: indexing one document adds and removes only its own passages, reusing cached token lists for the rest.
Documents are treated as untrusted input: the `[[SOURCES]]` marker and `system:`/`assistant:` role headers inside a file are neutralised before they reach the prompt, and instruction-looking text is labelled as quoted content rather than followed. Groq 429s and timeouts are retried with capped backoff honouring `Retry-After`, but only while no part of the answer has been streamed. Identical questions from the same account are replayed from a TTL cache for `ANSWER_CACHE_SECONDS`.

## Indexing
Uploads and URLs run as background tasks with real stages and a persisted failure reason, and `.docx`, `.pptx` and `.xlsx` are read with the standard library (`zipfile` + XML), no system tools required. Scanned PDFs have no text layer to extract and this build does not OCR, so such a file fails with a message saying exactly that instead of an empty document. Because background tasks live in the process, documents still marked `indexing` when the server stops are closed out as failed at startup — they report as failures you can retry rather than hanging forever.

## Keys and tenants
API keys are stored per account inside SQLite, encrypted with the server secret, and a chat only ever uses the key of the account asking (falling back to the `GROQ_API_KEY` environment value for accounts that saved none). A single `data/keys.json` left over from older builds is adopted into the built-in account at startup and deleted, so self-hosted upgrades keep working.

## Auth
Real custom auth lives in the backend: PBKDF2 password hashing, HMAC-signed stateless session tokens, one-time password-reset and email-verification links (`backend/app/auth.py`, `main.py`; reset/verify emails go through SMTP or print to the uvicorn console when `SMTP_HOST` is empty), Google/GitHub OAuth sign-in, and per-user data isolation. The `ragdocs_session` cookie checked by `middleware.ts` is a UI-only redirect marker — every API route is protected by the Bearer token itself. Conversations are stored server-side per user.
- `POST /api/auth/change-password` `{current,new}` issues a fresh token and retires every older session, because tokens carry a password version.
- `PATCH /api/me` `{name?,email?}` — changing the email marks the account unverified and sends a new confirmation link.
- `GET /api/me/export` returns the whole account as JSON (profile, documents with chunks, conversations with messages); `DELETE /api/me` `{password}` wipes it, uploaded files included. The Settings page gates both behind a typed confirmation.
- "Remember me" puts the token in `localStorage`, otherwise in `sessionStorage`, and the marker cookie lifetime matches.
- `GET /health` is an unauthenticated liveness probe. `components/layout/SyncStatus.tsx` polls it and shows a retry strip when the backend is down or a conversation failed to push, instead of dropping the error.

## Quality scripts
`npm run test:e2e` (Playwright and axe, run `npx playwright install` once) and `npm run lighthouse`. Backend tests: `pytest` from `backend\` using the venv.
Landing pages for `/terms` and `/privacy` are real (`app/terms`, `app/privacy`) and linked from signup and the footer; `NEXT_PUBLIC_REPO_URL` additionally shows a GitHub link once you have a repository.
Tip: ask the chat to "trigger an error" or index a URL containing "fail" to see the error states. Ctrl/Cmd+K opens the command palette.

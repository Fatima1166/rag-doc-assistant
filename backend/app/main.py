"""FastAPI server implementing the frontend contract (repo README /
frontend lib/api.ts), now with real authentication, per-user data isolation,
server-side conversations, request logging and basic rate limiting.

  POST   /api/auth/signup|login|logout      (public)
  POST   /api/auth/verify-email             (public, confirms email link)
  POST   /api/auth/resend-verification      (auth, re-sends the confirm link)
  POST   /api/auth/forgot-password          (public, emails a reset link)
  POST   /api/auth/reset-password           (public, one-time reset token)
  GET    /api/auth/oauth/google|github(+callback)  (social sign-in)
  GET    /api/me  |  PATCH /api/me          (auth; name + email, re-verify on change)
  POST   /api/auth/change-password          (auth; invalidates older sessions)
  GET    /api/me/export                     (auth; full JSON export)
  DELETE /api/me                            (auth; requires the current password)
  GET    /api/me/prefs  |  PATCH ...        (auth; retrieval tuning)
  GET    /api/me/usage                       (auth; estimated token use per day)
  GET/POST/DELETE /api/documents...         (auth, per-user)
  PATCH  /api/documents/{id}                (rename / tags)
  POST   /api/chat                          (auth, per-user)
  GET/PUT/DELETE /api/conversations...      (auth, per-user)
  GET/POST/DELETE /api/settings/keys         (auth; status, save, remove)

Run:  uvicorn app.main:app --reload --port 8000   (from the backend/ folder)
"""
from __future__ import annotations

import hashlib
import hmac
import json
import logging
import os
import re
import secrets
import time
import uuid
import urllib.parse
from pathlib import Path
from typing import Any, Dict, List, Optional

from fastapi import BackgroundTasks, Depends, FastAPI, File, Header, HTTPException, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, RedirectResponse, StreamingResponse
from pydantic import BaseModel

from . import db, ingest, mail, oauth
from .auth import (auth_limiter, chat_limiter, hash_password, issue_token,
                   verify_password, verify_token)
from .config import get_settings
from .groq import answer_stream
from .index import index
from .keys import adopt_legacy_keys, clear_user_key, get_key_status, save_user_keys

s = get_settings()
db.init_db()
adopt_legacy_keys()      # a pre-per-account data/keys.json belongs to the built-in user
index.rebuild()

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger("ragdocs")

# Background indexing runs inside this process, so anything still "indexing" here
# was interrupted by a restart and will never finish on its own.
_stale = db.fail_stale_indexing()
if _stale:
    log.warning("Closed out %s document(s) left mid-index by a restart — retry them from the Documents page", _stale)

app = FastAPI(title="RAGDocs API", version="2.0.0")

_origins = [o.strip() for o in os.getenv("CORS_ORIGINS", s.frontend_origin).split(",") if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=_origins or ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

ALLOWED_EXT = {
    ".pdf", ".txt", ".md", ".json", ".csv",
    ".docx", ".pptx", ".xlsx",
    ".py", ".js", ".ts", ".jsx", ".tsx",
    ".html", ".htm", ".log"
}
SUPPORTED_LABEL = "PDF, TXT, MD, CSV, JSON, DOCX, PPTX, XLSX, HTML, LOG or source code"
EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


# ----------------------------- request logging ----------------------------

@app.middleware("http")
async def _log_requests(request, call_next):
    resp = await call_next(request)
    log.info("%s %s -> %s", request.method, request.url.path, resp.status_code)
    return resp


# ------------------------------- auth guards -------------------------------

def require_user(authorization: Optional[str] = Header(None)) -> Dict[str, Any]:
    token = (authorization or "").removeprefix("Bearer ").strip()
    user = verify_token(token) if token else None
    if user:
        return user
    if s.auth_required:
        raise HTTPException(status_code=401, detail="Not authenticated")
    u = db.get_user(db.DEFAULT_USER_ID)
    if not u:
        db.ensure_default_user()
        u = db.get_user(db.DEFAULT_USER_ID)
    return u or {"id": db.DEFAULT_USER_ID, "name": "Default User", "email": "user@ragdocs.local", "verified": 1}


def _limit(key: str, limiter) -> None:
    if not limiter.check(key):
        raise HTTPException(status_code=429, detail="Too many requests, slow down")


def human_size(n: int) -> str:
    if n <= 0:
        return "—"
    if n < 1048576:
        return f"{max(1, round(n / 1024))} KB"
    return f"{n / 1048576:.1f} MB"


def chunk_count(doc_id: str) -> int:
    with db.db() as conn:
        return conn.execute("SELECT COUNT(*) AS c FROM chunks WHERE doc_id=?", (doc_id,)).fetchone()["c"]


def to_public(d: Dict[str, Any]) -> Dict[str, Any]:
    return {"id": d["id"], "name": d["name"], "kind": d["kind"], "chunks": chunk_count(d["id"]),
            "size": human_size(int(d.get("size") or 0)), "created_at": d["created_at"],
            "status": d["status"], "progress": d["progress"], "stage": d.get("stage") or d["status"],
            "error": d.get("error") or None,
            "num_pages": d.get("num_pages", 0), "tags": split_tags(d.get("tags"))}


def _public_user(u: Dict[str, Any]) -> Dict[str, Any]:
    return {"id": u["id"], "name": u["name"], "email": u["email"],
            "verified": bool(u.get("verified"))}


MAX_TAGS = 8
TAG_LEN = 24


def split_tags(raw: Any) -> List[str]:
    """Tags live in one comma-joined column; expose them as a clean list."""
    if not raw:
        return []
    if isinstance(raw, list):
        raw = ",".join(str(x) for x in raw)
    return [t.strip() for t in str(raw).split(",") if t.strip()]


def clean_tags(values: List[str]) -> List[str]:
    out: List[str] = []
    for v in values:
        t = " ".join(str(v or "").split())[:TAG_LEN]
        if t and t not in out:
            out.append(t)
    return out[:MAX_TAGS]


# ---------------------------------- models --------------------------------

class SignupIn(BaseModel):
    name: str
    email: str
    password: str


class LoginIn(BaseModel):
    email: str
    password: str


class VerifyIn(BaseModel):
    token: str


class ForgotIn(BaseModel):
    email: str


class ResetIn(BaseModel):
    token: str
    password: str


class ProfileIn(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None


class UrlIn(BaseModel):
    url: str


class DocPatchIn(BaseModel):
    name: Optional[str] = None
    tags: Optional[List[str]] = None


class IdsIn(BaseModel):
    ids: List[str] = []


class ChatIn(BaseModel):
    messages: List[Dict[str, str]] = []
    doc_ids: Optional[List[str]] = None
    fresh: bool = False        # skip the answer cache ("ask again")


class KeysIn(BaseModel):
    groq: Optional[str] = None
    pinecone: Optional[str] = None


class PassIn(BaseModel):
    current: str
    new: str


class ConfirmIn(BaseModel):
    password: str


class PrefsIn(BaseModel):
    top_k: Optional[int] = None
    chunk_size: Optional[int] = None
    chunk_overlap: Optional[int] = None


class ConvIn(BaseModel):
    id: str
    title: str = "New chat"
    messages: List[Dict[str, Any]] = []
    docIds: Optional[List[str]] = None
    pinned: bool = False
    updatedAt: int = 0


class SearchIn(BaseModel):
    query: str
    doc_ids: Optional[List[str]] = None
    top_k: Optional[int] = None


@app.get("/health")
def health() -> Dict[str, Any]:
    stats = db.get_stats()
    return {
        "ok": True,
        "chunks": index.doc_count(),
        "stats": stats,
        "model": s.groq_model,
        "llm": "groq" if s.groq_api_key else "extractive",
        # Accounts can bring their own key; the answer only says whether the
        # server itself has one, never how many accounts stored theirs.
        "keys": "per-account",
        "auth_required": s.auth_required,
    }


def _has_key(user_id: Optional[str] = None) -> bool:
    from .keys import effective_groq_key
    return bool(effective_groq_key(user_id))


# ---------------------------------- auth -----------------------------------

@app.post("/api/auth/signup")
def signup(body: SignupIn, request=None):
    _limit(f"signup:{_client_ip(request)}|{body.email.lower()}", auth_limiter())
    name = body.name.strip()
    email = body.email.lower().strip()
    if not name:
        raise HTTPException(status_code=400, detail="Name is required")
    if not EMAIL_RE.match(email):
        raise HTTPException(status_code=400, detail="Enter a valid email")
    if len(body.password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters")
    if db.get_user_by_email(email):
        raise HTTPException(status_code=409, detail="An account with this email already exists")
    user = {"id": uuid.uuid4().hex, "name": name[:80], "email": email}
    db.create_user(user["id"], email, user["name"], hash_password(body.password))
    user = db.get_user(user["id"])
    _send_verification(user)
    return {"token": issue_token(user), "user": _public_user(user)}


@app.post("/api/auth/login")
def login(body: LoginIn, request=None):
    _limit(f"login:{_client_ip(request)}|{body.email.lower()}", auth_limiter())
    user = db.get_user_by_email(body.email)
    if not user or not verify_password(body.password, user["pw"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    return {"token": issue_token(user), "user": _public_user(user)}


@app.post("/api/auth/logout")
def logout(user: Dict[str, Any] = Depends(require_user)):
    # Tokens are stateless; logout is client-side token discard. Kept for parity.
    return {"ok": True}


RESET_TTL_SECONDS = 3600  # reset links are valid for one hour


@app.post("/api/auth/forgot-password")
def forgot_password(body: ForgotIn, request=None):
    _limit(f"forgot:{_client_ip(request)}|{body.email.lower()}", auth_limiter())
    user = db.get_user_by_email(body.email)
    # Only store the hash of the token; the raw value lives just in the email.
    if user:
        token = secrets.token_urlsafe(32)
        db.create_reset_token(_token_hash(token), user["id"], int(time.time()) + RESET_TTL_SECONDS)
        link = f"{s.frontend_origin.rstrip('/')}/reset-password?token={token}"
        mail.send_reset_email(user["email"], link)
    # Same answer whether or not the account exists — no enumeration.
    return {"ok": True}


@app.post("/api/auth/reset-password")
def reset_password(body: ResetIn, request=None):
    _limit(f"reset:{_client_ip(request)}", auth_limiter())
    if len(body.password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters")
    user = db.get_reset_user(_token_hash(body.token))
    if not user:
        raise HTTPException(status_code=400, detail="Invalid or expired reset link")
    db.update_password(user["id"], hash_password(body.password))
    # One-time use: burn this token and every older one still pending.
    db.consume_reset_tokens(user_id=user["id"])
    return {"ok": True}


def _token_hash(raw: str) -> str:
    return hashlib.sha256(raw.encode()).hexdigest()


# ------------------------------ email verify --------------------------------

VERIFY_TTL_SECONDS = 86400  # confirmation links last 24 hours


def _send_verification(user: Dict[str, Any]) -> None:
    """Create a fresh one-time confirmation token and email its link.
    Only the hash is stored; the raw value lives just in the email."""
    token = secrets.token_urlsafe(32)
    db.create_verify_token(_token_hash(token), user["id"], int(time.time()) + VERIFY_TTL_SECONDS)
    link = f"{s.frontend_origin.rstrip('/')}/verify-email?token={token}"
    mail.send_verify_email(user["email"], link)


@app.post("/api/auth/verify-email")
def verify_email(body: VerifyIn, request=None):
    _limit(f"verify:{_client_ip(request)}", auth_limiter())
    user = db.get_verify_user(_token_hash(body.token))
    if not user:
        raise HTTPException(status_code=400, detail="Invalid or expired verification link")
    db.mark_verified(user["id"])
    return {"ok": True, "user": _public_user(db.get_user(user["id"]))}


@app.post("/api/auth/resend-verification")
def resend_verification(request=None, user: Dict[str, Any] = Depends(require_user)):
    # Auth-only so nobody can spam confirmation mail to arbitrary addresses.
    _limit(f"resend:{user['id']}", auth_limiter())
    if not user.get("verified"):
        _send_verification(user)
    return {"ok": True}


# ------------------------------- social OAuth --------------------------------

def _oauth_redirect_uri(request: Request, provider: str) -> str:
    # Behind a reverse proxy set OAUTH_REDIRECT_BASE to the public backend URL.
    base = os.getenv("OAUTH_REDIRECT_BASE", "").strip() or str(request.base_url).rstrip("/")
    return f"{base}/api/auth/oauth/{provider}/callback"


@app.get("/api/auth/oauth/{provider}")
def oauth_start(provider: str, request: Request):
    try:
        url, state = oauth.start(provider, _oauth_redirect_uri(request, provider))
    except oauth.OAuthError as e:
        raise HTTPException(status_code=400, detail=str(e))
    resp = RedirectResponse(url, status_code=302)
    # HttpOnly + SameSite=lax: sent back on the provider's top-level redirect.
    resp.set_cookie(oauth.STATE_COOKIE, state, max_age=600, httponly=True,
                    samesite="lax", path="/")
    return resp


@app.get("/api/auth/oauth/{provider}/callback")
def oauth_callback(provider: str, request: Request, code: str = "", state: str = ""):
    front = s.frontend_origin.rstrip("/")
    fail = RedirectResponse(f"{front}/login?oauth_error=1", status_code=303)
    fail.delete_cookie(oauth.STATE_COOKIE, path="/")
    stored = request.cookies.get(oauth.STATE_COOKIE, "")
    if not code or not stored or not hmac.compare_digest(stored, state):
        return fail  # tampered/missing state, or provider refused the flow
    try:
        access = oauth.exchange(provider, code, _oauth_redirect_uri(request, provider))
        ident = oauth.fetch_identity(provider, access)
    except oauth.OAuthError:
        return fail
    # Same email as an existing password account -> link, never duplicate.
    user = db.get_user_by_email(ident["email"])
    if not user:
        uid = uuid.uuid4().hex
        # OAuth guarantees the provider already owns this email -> mark verified.
        db.create_user(uid, ident["email"], ident["name"], "", verified=True)
        user = db.get_user(uid)
    ok = RedirectResponse(f"{front}/auth/callback#token={issue_token(user)}", status_code=303)
    ok.delete_cookie(oauth.STATE_COOKIE, path="/")
    return ok


@app.get("/api/me")
def me(user: Dict[str, Any] = Depends(require_user)):
    return _public_user(user)


@app.patch("/api/me")
def patch_me(body: ProfileIn, user: Dict[str, Any] = Depends(require_user)):
    name = (body.name if body.name is not None else user["name"]).strip()
    if not name:
        raise HTTPException(status_code=400, detail="Name is required")
    email = (body.email or user["email"]).lower().strip()
    if email != user["email"].lower():
        # Changing the sign-in address needs proof you own the new one.
        if not EMAIL_RE.match(email):
            raise HTTPException(status_code=400, detail="Enter a valid email")
        if db.get_user_by_email(email):
            raise HTTPException(status_code=409, detail="That email is already in use")
        db.update_user(user["id"], name=name[:80], email=email, verified=False)
        fresh = db.get_user(user["id"])
        _send_verification(fresh)
        return dict(_public_user(fresh), reverified=True)
    db.update_user(user["id"], name=name[:80])
    return _public_user(db.get_user(user["id"]))


@app.post("/api/auth/change-password")
def change_password(body: PassIn, request=None, user: Dict[str, Any] = Depends(require_user)):
    """Rotate the password and hand back a fresh token for THIS device.
    Every older token carries the previous password version, so other sessions
    stop working — which is the point of changing it."""
    _limit(f"changepw:{user['id']}", auth_limiter())
    if not verify_password(body.current, user["pw"]):
        raise HTTPException(status_code=403, detail="Current password is incorrect")
    if len(body.new) < 8:
        raise HTTPException(status_code=400, detail="New password must be at least 8 characters")
    if hmac.compare_digest(body.new, body.current):
        raise HTTPException(status_code=400, detail="New password must be different")
    db.update_password(user["id"], hash_password(body.new))
    db.consume_reset_tokens(user_id=user["id"])
    fresh = db.get_user(user["id"])
    return {"ok": True, "token": issue_token(fresh), "user": _public_user(fresh)}


@app.get("/api/me/export")
def export_account(user: Dict[str, Any] = Depends(require_user)):
    """Profile, documents with their chunks, and conversations — one download."""
    data = db.export_user(user["id"])
    if not data:
        raise HTTPException(status_code=404, detail="Not found")
    return data


@app.delete("/api/me")
def delete_account(body: ConfirmIn, user: Dict[str, Any] = Depends(require_user)):
    """Permanent self-service deletion. The password is required because the
    request destroys documents, chunks and conversations in one shot."""
    _limit(f"delete-account:{user['id']}", auth_limiter())
    if user["id"] == db.DEFAULT_USER_ID:
        raise HTTPException(status_code=400, detail="The built-in demo account can't be deleted")
    if not verify_password(body.password, user["pw"]):
        raise HTTPException(status_code=403, detail="Password is incorrect")
    paths = db.delete_account(user["id"])
    for p in paths:
        try:
            Path(p).unlink()
        except Exception:
            pass
    index.rebuild()
    return {"ok": True, "deleted_documents": len(paths)}


@app.get("/api/me/prefs")
def read_prefs(user: Dict[str, Any] = Depends(require_user)):
    return db.get_prefs(user["id"])


@app.patch("/api/me/prefs")
def patch_prefs(body: PrefsIn, user: Dict[str, Any] = Depends(require_user)):
    """Retrieval tuning. top_k applies to the next answer; chunk size only
    affects documents indexed from now on, so re-index to see it."""
    vals: Dict[str, int] = {}
    if body.top_k is not None:
        if not 1 <= body.top_k <= 20:
            raise HTTPException(status_code=400, detail="Passages per answer must be between 1 and 20")
        vals["top_k"] = body.top_k
    if body.chunk_size is not None:
        if not 200 <= body.chunk_size <= 4000:
            raise HTTPException(status_code=400, detail="Chunk size must be between 200 and 4000 characters")
        vals["chunk_size"] = body.chunk_size
    if body.chunk_overlap is not None:
        if body.chunk_overlap < 0:
            raise HTTPException(status_code=400, detail="Chunk overlap can't be negative")
        vals["chunk_overlap"] = body.chunk_overlap
    if not vals:
        raise HTTPException(status_code=400, detail="Nothing to update")
    size = vals.get("chunk_size", db.get_prefs(user["id"])["chunk_size"])
    # Keep whatever overlap the caller didn't mention, but never let it exceed
    # the window it has to fit inside.
    overlap = vals.get("chunk_overlap", db.get_prefs(user["id"])["chunk_overlap"])
    vals["chunk_overlap"] = max(0, min(overlap, size - 200))
    return db.set_prefs(user["id"], vals)


@app.get("/api/me/usage")
def read_usage(user: Dict[str, Any] = Depends(require_user)):
    """Rough per-day token use for this account. Estimated from the text we sent
    and received (characters / 3.5), not read off an invoice."""
    days = db.get_usage(user["id"], 30)
    totals = {k: sum(int(d[k]) for d in days) for k in ("requests", "prompt_tokens", "completion_tokens")}
    return {
        "days": days,
        "totals": totals,
        "estimated": True,
        "model": s.groq_model,
        "context_tokens": s.context_tokens,
        "answer_cache_seconds": s.answer_cache_seconds,
    }


def _client_ip(request) -> str:
    if request is None:
        return "unknown"
    try:
        return request.client.host if request.client else "unknown"
    except Exception:
        return "unknown"


# ------------------------------- documents --------------------------------

@app.get("/api/documents")
def list_documents(user: Dict[str, Any] = Depends(require_user)):
    return [to_public(d) for d in db.list_documents(user["id"])]


def _norm_url(url: str) -> str:
    """Compare-and-store form of a source URL: no fragment, no trailing slash."""
    parts = urllib.parse.urlsplit(url.strip())
    path = parts.path.rstrip("/") or "/"
    return urllib.parse.urlunsplit((parts.scheme.lower(), parts.netloc.lower(), path, parts.query, ""))


def _deduped(doc: Dict[str, Any]) -> JSONResponse:
    """200, not 202: nothing was queued, the document the caller already has is
    the answer."""
    return JSONResponse(status_code=200, content={
        "id": doc["id"], "name": doc["name"], "status": doc["status"], "deduped": True,
        "message": "Already indexed — this is the same content as an existing document.",
    })


@app.post("/api/documents", status_code=202)
async def upload_document(background: BackgroundTasks, file: UploadFile = File(...),
                          user: Dict[str, Any] = Depends(require_user)):
    name = file.filename or "upload"
    ext = Path(name).suffix.lower()
    if ext not in ALLOWED_EXT:
        raise HTTPException(status_code=400,
                            detail=f"Unsupported file type '{ext or 'none'}'. "
                                   f"Accepted: {SUPPORTED_LABEL}")
    raw = await file.read()
    if len(raw) > s.max_upload_mb * 1048576:
        raise HTTPException(status_code=413, detail=f"File larger than {s.max_upload_mb} MB")
    sha = hashlib.sha256(raw).hexdigest()
    existing = db.find_duplicate(user["id"], sha256=sha)
    if existing:
        # Same bytes twice = twice the chunks = the same passage winning every
        # search for that account. Refuse the copy instead of indexing it.
        return _deduped(existing)
    doc_id = uuid.uuid4().hex
    kind = "pdf" if ext == ".pdf" else "text"
    path = s.files_dir / f"{doc_id}{ext}"
    path.write_bytes(raw)
    db.create_document(doc_id, name=name, kind=kind, size=len(raw), path=str(path),
                       user_id=user["id"], sha256=sha)
    background.add_task(process_document, doc_id)
    return {"id": doc_id, "status": "indexing"}


# Registered before /api/documents/{doc_id} on purpose: FastAPI matches in
# declaration order, and a route declared after the wildcard would be shadowed
# for every other verb (GET /api/documents/url would 404 as "document url").
@app.post("/api/documents/url", status_code=202)
def index_url(body: UrlIn, background: BackgroundTasks, user: Dict[str, Any] = Depends(require_user)):
    url = body.url.strip()
    if not re.match(r"^https?://", url, re.I):
        raise HTTPException(status_code=400, detail="Enter a full http(s) URL")
    target = _norm_url(url)
    existing = db.find_duplicate(user["id"], url=target)
    if existing:
        return _deduped(existing)
    doc_id = uuid.uuid4().hex
    db.create_document(doc_id, name=target, kind="url", size=0, url=target, user_id=user["id"])
    background.add_task(process_document, doc_id)
    return {"id": doc_id, "status": "indexing"}


@app.get("/api/documents/{doc_id}")
def get_document(doc_id: str, user: Dict[str, Any] = Depends(require_user)):
    doc = db.get_document(doc_id, user["id"])
    if not doc:
        raise HTTPException(status_code=404, detail="Not found")
    return to_public(doc)


@app.get("/api/documents/{doc_id}/chunks")
def get_document_chunks(doc_id: str, user: Dict[str, Any] = Depends(require_user)):
    doc = db.get_document(doc_id, user["id"])
    if not doc:
        raise HTTPException(status_code=404, detail="Not found")
    chunks = db.get_chunks(doc_id, user["id"])
    return {"doc_id": doc_id, "name": doc["name"], "chunks": chunks}


@app.get("/api/documents/{doc_id}/download")
def download_document(doc_id: str, user: Dict[str, Any] = Depends(require_user)):
    from fastapi.responses import FileResponse
    doc = db.get_document(doc_id, user["id"])
    if not doc or not doc.get("path") or not Path(doc["path"]).exists():
        raise HTTPException(status_code=404, detail="File not found")
    return FileResponse(doc["path"], filename=doc["name"])


@app.delete("/api/documents/{doc_id}")
def delete_document(doc_id: str, user: Dict[str, Any] = Depends(require_user)):
    doc = db.get_document(doc_id, user["id"])
    if not doc:
        raise HTTPException(status_code=404, detail="Not found")
    if doc.get("path"):
        try:
            Path(doc["path"]).unlink()
        except Exception:
            pass
    db.delete_document(doc_id, user["id"])
    index.drop_doc(doc_id)
    return {"ok": True}


@app.patch("/api/documents/{doc_id}")
def patch_document(doc_id: str, body: DocPatchIn, user: Dict[str, Any] = Depends(require_user)):
    """Rename and/or re-tag a document. Neither change touches the index."""
    doc = db.get_document(doc_id, user["id"])
    if not doc:
        raise HTTPException(status_code=404, detail="Not found")
    fields: Dict[str, Any] = {}
    if body.name is not None:
        name = " ".join(body.name.split())
        if not name:
            raise HTTPException(status_code=400, detail="Name is required")
        fields["name"] = name[:200]
    if body.tags is not None:
        fields["tags"] = ",".join(clean_tags(body.tags))
    if not fields:
        raise HTTPException(status_code=400, detail="Nothing to update")
    db.update_document(doc_id, user["id"], **fields)
    if "name" in fields:
        index.rename_doc(doc_id, fields["name"])   # citations show the new title
    return to_public(db.get_document(doc_id, user["id"]))


@app.delete("/api/documents")
def delete_documents(body: IdsIn, user: Dict[str, Any] = Depends(require_user)):
    """Bulk delete. Ids the caller doesn't own are silently ignored."""
    ids = [i for i in dict.fromkeys(body.ids) if i][:200]
    deleted = db.delete_documents(ids, user["id"])
    for d in deleted:
        if d.get("path"):
            try:
                Path(d["path"]).unlink()
            except Exception:
                pass
    if deleted:
        for d in deleted:
            index.drop_doc(d["id"])
    return {"ok": True, "deleted": len(deleted)}


@app.post("/api/documents/{doc_id}/reindex", status_code=202)
def reindex_document(doc_id: str, background: BackgroundTasks, user: Dict[str, Any] = Depends(require_user)):
    doc = db.get_document(doc_id, user["id"])
    if not doc:
        raise HTTPException(status_code=404, detail="Not found")
    # error=None: a retry of an interrupted document must not keep showing the
    # reason the previous attempt stopped.
    db.update_document(doc_id, status="indexing", progress=0, stage="queued", error=None)
    index.drop_doc(doc_id)   # the old passages must stop answering questions
    background.add_task(process_document, doc_id)
    return {"ok": True}


# ---------------------------------- chat ----------------------------------

@app.post("/api/chat")
def chat(body: ChatIn, request=None, user: Dict[str, Any] = Depends(require_user)):
    _limit(f"chat:{user['id']}", chat_limiter())
    # Only ever search within this user's own ready documents.
    mine = set(db.ready_doc_ids(user["id"]))
    if body.doc_ids is None:
        scoped = sorted(mine)
    else:
        scoped = [d for d in body.doc_ids if d in mine]
    gen = answer_stream(body.messages, scoped, user_id=user["id"], fresh=body.fresh)
    return StreamingResponse(gen, media_type="text/plain; charset=utf-8",
                             headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})


@app.post("/api/search")
def search_endpoint(body: SearchIn, user: Dict[str, Any] = Depends(require_user)):
    mine = set(db.ready_doc_ids(user["id"]))
    if body.doc_ids is None:
        scoped = sorted(mine)
    else:
        scoped = [d for d in body.doc_ids if d in mine]
    k = body.top_k if body.top_k else db.get_prefs(user["id"])["top_k"]
    results = index.search(body.query, doc_ids=scoped, top_k=max(1, min(int(k), 50)), user_id=user["id"])
    return {"query": body.query, "results": results}


# ------------------------------ conversations ------------------------------

@app.get("/api/conversations")
def conversations_list(user: Dict[str, Any] = Depends(require_user)):
    out = []
    for c in db.list_conversations(user["id"]):
        out.append({
            "id": c["id"], "title": c["title"], "pinned": c["pinned"], "updatedAt": c["updated_at"],
            "messages": json.loads(c["messages"] or "[]"),
            "docIds": json.loads(c["doc_ids"]) if c.get("doc_ids") else None,
        })
    return out


@app.get("/api/conversations/{conv_id}")
def conversations_get(conv_id: str, user: Dict[str, Any] = Depends(require_user)):
    c = db.get_conversation(conv_id, user["id"])
    if not c:
        raise HTTPException(status_code=404, detail="Conversation not found")
    return {
        "id": c["id"],
        "title": c["title"],
        "pinned": bool(c.get("pinned")),
        "updatedAt": c["updated_at"],
        "messages": json.loads(c["messages"] or "[]"),
        "docIds": json.loads(c["doc_ids"]) if c.get("doc_ids") else None,
    }


@app.put("/api/conversations")
def conversations_put(body: ConvIn, user: Dict[str, Any] = Depends(require_user)):
    db.upsert_conversation(body.model_dump(), user["id"])
    return {"ok": True}


@app.delete("/api/conversations/{conv_id}")
def conversations_delete(conv_id: str, user: Dict[str, Any] = Depends(require_user)):
    db.delete_conversation(conv_id, user["id"])
    return {"ok": True}


@app.delete("/api/conversations")
def conversations_clear(user: Dict[str, Any] = Depends(require_user)):
    return {"ok": True, "deleted": db.delete_all_conversations(user["id"])}


# --------------------------------- settings --------------------------------

@app.get("/api/settings/keys")
def read_keys_status(user: Dict[str, Any] = Depends(require_user)):
    return get_key_status(user["id"])


@app.post("/api/settings/keys")
def store_keys(body: KeysIn, user: Dict[str, Any] = Depends(require_user)):
    """Store a key against this account only. Keys are encrypted at rest and are
    never read back — the response carries status, not the value."""
    groq = (body.groq or "").strip()
    pinecone = (body.pinecone or "").strip()
    if not groq and not pinecone:
        raise HTTPException(status_code=400, detail="Provide at least one key")
    save_user_keys(user["id"], groq or None, pinecone or None)
    return {"ok": True, "scope": "account", "status": get_key_status(user["id"])}


@app.delete("/api/settings/keys")
def remove_keys(provider: str = "", user: Dict[str, Any] = Depends(require_user)):
    """Forget this account's stored key. Answers with the new status, and with
    `cleared=false` when the server environment still provides that key (it isn't
    ours to remove)."""
    if provider not in ("groq", "pinecone"):
        raise HTTPException(status_code=400, detail="Unknown key provider")
    cleared = clear_user_key(user["id"], provider)
    return {"ok": True, "cleared": cleared, "status": get_key_status(user["id"])}


# --------------------------------- indexing ---------------------------------

def _finish_error(doc_id: str, reason: Any = None) -> None:
    # The reason is stored, not just logged: a failed upload list that can't say
    # why it failed sends people back to the same broken file.
    db.update_document(doc_id, status="error", progress=0, stage="failed",
                       error=(" ".join(str(reason or "").split())[:400] or None))
    index.drop_doc(doc_id)


def _stage(doc_id: str, progress: int, stage: str, **extra: Any) -> None:
    db.update_document(doc_id, progress=progress, stage=stage, **extra)


def process_document(doc_id: str) -> None:
    """Background indexing: extract -> chunk -> store -> ready -> index.

    Progress is reported per stage rather than jumping 40 to 100, because a
    large PDF sitting in extraction for a minute otherwise looks like a hang."""
    doc = db.get_document(doc_id)
    if not doc:
        return
    try:
        _stage(doc_id, 10, "queued", status="indexing")
        kind = doc["kind"]
        if kind == "url":
            url = doc.get("url") or ""
            if "fail" in url.lower():
                raise ValueError("simulated indexing failure")
            _stage(doc_id, 30, "extracting")
            data = ingest.fetch_url(url)
            sections = [{"page": None, "text": data["text"], "url": url}]
            num_pages = 1 if data["text"].strip() else 0
            if data["name"] and data["name"] != url:
                db.update_document(doc_id, name=data["name"][:200])
        else:
            _stage(doc_id, 25, "extracting")
            raw = Path(doc["path"]).read_bytes()
            ext = Path(doc["path"]).suffix.lower()
            sections = ingest.extract_content_by_ext(raw, ext)
            num_pages = len({sec["page"] for sec in sections if sec.get("page")}) or (1 if sections else 0)
        prefs = db.get_prefs(doc["user_id"])
        _stage(doc_id, 60, "chunking")
        chunks = ingest.chunk(sections, size=prefs["chunk_size"], overlap=prefs["chunk_overlap"])
        if not chunks:
            raise ingest.EmptySource("No readable text found in the source — nothing to index.")
        _stage(doc_id, 80, "indexing")
        db.replace_chunks(doc_id, chunks)
        db.update_document(doc_id, status="ready", progress=100, stage="ready",
                           num_pages=num_pages, error=None)
        index.add_doc(doc_id)
    except Exception as e:
        log.warning("indexing failed for %s: %s", doc_id, e)
        _finish_error(doc_id, e)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=s.port, reload=True)

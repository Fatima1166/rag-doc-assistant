"""SQLite persistence for documents and their chunks. One short-lived
connection per operation keeps it safe across FastAPI's threadpool workers."""
from __future__ import annotations

import sqlite3
import time
from contextlib import contextmanager
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from .config import get_settings

SCHEMA = """
CREATE TABLE IF NOT EXISTS users(
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  pw TEXT NOT NULL,
  verified INTEGER NOT NULL DEFAULT 0,
  prefs TEXT NOT NULL DEFAULT '{}',
  keys TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS documents(
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  kind TEXT NOT NULL,
  size INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'indexing',
  progress INTEGER NOT NULL DEFAULT 0,
  stage TEXT NOT NULL DEFAULT 'queued',
  num_pages INTEGER NOT NULL DEFAULT 0,
  sha256 TEXT,
  error TEXT,
  url TEXT,
  path TEXT,
  tags TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS chunks(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  doc_id TEXT NOT NULL,
  ord INTEGER NOT NULL,
  page INTEGER,
  url TEXT,
  text TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS conversations(
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  title TEXT NOT NULL,
  messages TEXT NOT NULL,
  doc_ids TEXT,
  pinned INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS reset_tokens(
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS verify_tokens(
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS usage_day(
  user_id TEXT NOT NULL,
  day TEXT NOT NULL,
  requests INTEGER NOT NULL DEFAULT 0,
  prompt_tokens INTEGER NOT NULL DEFAULT 0,
  completion_tokens INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY(user_id, day)
);
"""

# Indexes are created only after _migrate has run, because a legacy database may
# not have the indexed columns (documents.user_id) yet — building them first
# makes startup fail outright with "no such column: user_id".
INDEXES = """
CREATE INDEX IF NOT EXISTS idx_chunks_doc ON chunks(doc_id);
CREATE INDEX IF NOT EXISTS idx_docs_user ON documents(user_id);
CREATE INDEX IF NOT EXISTS idx_conv_user ON conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_docs_sha ON documents(user_id, sha256);
"""


def _connect() -> sqlite3.Connection:
    conn = sqlite3.connect(get_settings().db_path)
    conn.row_factory = sqlite3.Row
    return conn


@contextmanager
def db():
    conn = _connect()
    try:
        yield conn
        conn.commit()
    finally:
        conn.close()


DEFAULT_USER_ID = "default_user"


def ensure_default_user() -> None:
    with db() as conn:
        row = conn.execute("SELECT id FROM users WHERE id=?", (DEFAULT_USER_ID,)).fetchone()
        if not row:
            conn.execute(
                "INSERT INTO users(id,email,name,pw,verified,created_at) VALUES(?,?,?,?,?,?)",
                (DEFAULT_USER_ID, "user@ragdocs.local", "Default User", "default", 1, now_iso()),
            )


def init_db() -> None:
    with db() as conn:
        conn.executescript(SCHEMA)
        _migrate(conn)
        conn.executescript(INDEXES)   # after migrating, so new columns exist
    ensure_default_user()


def _migrate(conn: sqlite3.Connection) -> None:
    """Add columns that older databases are missing (idempotent)."""
    cols = {r["name"] for r in conn.execute("PRAGMA table_info(documents)").fetchall()}
    if cols and "user_id" not in cols:
        conn.execute("ALTER TABLE documents ADD COLUMN user_id TEXT NOT NULL DEFAULT ''")
    if cols and "tags" not in cols:
        conn.execute("ALTER TABLE documents ADD COLUMN tags TEXT NOT NULL DEFAULT ''")
    if cols and "sha256" not in cols:
        conn.execute("ALTER TABLE documents ADD COLUMN sha256 TEXT")
    if cols and "error" not in cols:
        conn.execute("ALTER TABLE documents ADD COLUMN error TEXT")
    if cols and "stage" not in cols:
        conn.execute("ALTER TABLE documents ADD COLUMN stage TEXT NOT NULL DEFAULT 'queued'")
    dcols = {r["name"] for r in conn.execute("PRAGMA table_info(conversations)").fetchall()}
    if "doc_ids" not in dcols and dcols:
        conn.execute("ALTER TABLE conversations ADD COLUMN doc_ids TEXT")
    ucols = {r["name"] for r in conn.execute("PRAGMA table_info(users)").fetchall()}
    if ucols and "verified" not in ucols:
        # Accounts predating email verification had no way to verify — treat them as verified.
        conn.execute("ALTER TABLE users ADD COLUMN verified INTEGER NOT NULL DEFAULT 0")
        conn.execute("UPDATE users SET verified=1")
    if ucols and "prefs" not in ucols:
        conn.execute("ALTER TABLE users ADD COLUMN prefs TEXT NOT NULL DEFAULT '{}'")
    if ucols and "keys" not in ucols:
        # Keys used to live in one shared data/keys.json; see keys.adopt_legacy_keys().
        conn.execute("ALTER TABLE users ADD COLUMN keys TEXT NOT NULL DEFAULT '{}'")


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def create_document(doc_id: str, name: str, kind: str, size: int, url: Optional[str] = None,
                    path: Optional[str] = None, user_id: str = "", sha256: Optional[str] = None) -> None:
    with db() as conn:
        conn.execute(
            "INSERT INTO documents(id,name,kind,size,status,progress,stage,num_pages,sha256,url,path,created_at,user_id)"
            " VALUES(?,?,?,?,'indexing',0,'queued',0,?,?,?,?,?)",
            (doc_id, name, kind, size, sha256, url, path, now_iso(), user_id),
        )


def find_duplicate(user_id: str, sha256: Optional[str] = None,
                   url: Optional[str] = None) -> Optional[Dict[str, Any]]:
    """An existing, non-failed document this user already added with the same
    bytes (or the same URL). Re-uploading a file shouldn't double the corpus."""
    if not sha256 and not url:
        return None
    with db() as conn:
        if sha256:
            row = conn.execute(
                "SELECT * FROM documents WHERE user_id=? AND sha256=? AND status!='error'"
                " ORDER BY created_at DESC LIMIT 1", (user_id, sha256)).fetchone()
        else:
            row = conn.execute(
                "SELECT * FROM documents WHERE user_id=? AND url=? AND status!='error'"
                " ORDER BY created_at DESC LIMIT 1", (user_id, url)).fetchone()
        return dict(row) if row else None


def update_document(doc_id: str, user_id: Optional[str] = None, **fields: Any) -> None:
    if not fields:
        return
    cols = ", ".join(f"{k}=?" for k in fields)
    where = "id=?" + (" AND user_id=?" if user_id is not None else "")
    args = (*fields.values(), doc_id) + ((user_id,) if user_id is not None else ())
    with db() as conn:
        conn.execute(f"UPDATE documents SET {cols} WHERE {where}", args)


def replace_chunks(doc_id: str, items: List[Dict[str, Any]]) -> None:
    with db() as conn:
        conn.execute("DELETE FROM chunks WHERE doc_id=?", (doc_id,))
        for ord_, it in enumerate(items):
            conn.execute(
                "INSERT INTO chunks(doc_id,ord,page,url,text) VALUES(?,?,?,?,?)",
                (doc_id, ord_, it.get("page"), it.get("url"), it["text"]),
            )


def get_document(doc_id: str, user_id: Optional[str] = None) -> Optional[Dict[str, Any]]:
    with db() as conn:
        if user_id is None:
            row = conn.execute("SELECT * FROM documents WHERE id=?", (doc_id,)).fetchone()
        else:
            row = conn.execute("SELECT * FROM documents WHERE id=? AND user_id=?", (doc_id, user_id)).fetchone()
        return dict(row) if row else None


def list_documents(user_id: str) -> List[Dict[str, Any]]:
    with db() as conn:
        rows = conn.execute(
            "SELECT * FROM documents WHERE user_id=? ORDER BY created_at DESC", (user_id,)
        ).fetchall()
        return [dict(r) for r in rows]


def ready_doc_ids(user_id: str) -> List[str]:
    with db() as conn:
        rows = conn.execute(
            "SELECT id FROM documents WHERE user_id=? AND status='ready'", (user_id,)
        ).fetchall()
        return [r["id"] for r in rows]


def delete_document(doc_id: str, user_id: Optional[str] = None) -> None:
    with db() as conn:
        conn.execute("DELETE FROM chunks WHERE doc_id=?", (doc_id,))
        if user_id is None:
            conn.execute("DELETE FROM documents WHERE id=?", (doc_id,))
        else:
            conn.execute("DELETE FROM documents WHERE id=? AND user_id=?", (doc_id, user_id))


def delete_documents(doc_ids: List[str], user_id: str) -> List[Dict[str, Any]]:
    """Bulk-delete only the ids this user actually owns.
    Returns the deleted rows (so the caller can unlink their files)."""
    if not doc_ids:
        return []
    marks = ",".join("?" * len(doc_ids))
    with db() as conn:
        rows = conn.execute(
            f"SELECT id, path FROM documents WHERE user_id=? AND id IN ({marks})",
            (user_id, *doc_ids),
        ).fetchall()
        deleted = [dict(r) for r in rows]
        owned = [d["id"] for d in deleted]
        if owned:
            own = ",".join("?" * len(owned))
            conn.execute(f"DELETE FROM chunks WHERE doc_id IN ({own})", owned)
            conn.execute(f"DELETE FROM documents WHERE user_id=? AND id IN ({own})", (user_id, *owned))
        return deleted


def all_ready_chunks() -> List[Dict[str, Any]]:
    with db() as conn:
        rows = conn.execute(
            "SELECT c.id AS id, c.doc_id AS doc_id, c.ord AS ord, c.page AS page,"
            " c.url AS url, c.text AS text, d.name AS doc_name, d.user_id AS user_id"
            " FROM chunks c JOIN documents d ON d.id = c.doc_id"
            " WHERE d.status = 'ready' ORDER BY c.doc_id, c.ord"
        ).fetchall()
        return [dict(r) for r in rows]


def ready_chunk_count() -> int:
    """How many passages the retrieval index should be holding. Cheap enough to
    check on every search, so a document can never be 'ready' but unfindable."""
    with db() as conn:
        return conn.execute(
            "SELECT COUNT(*) FROM chunks c JOIN documents d ON d.id = c.doc_id"
            " WHERE d.status = 'ready'"
        ).fetchone()[0]


def ready_chunks_for(doc_id: str) -> List[Dict[str, Any]]:
    """One document's searchable passages, shaped like all_ready_chunks rows, so
    the index can absorb an upload without re-tokenizing the whole corpus."""
    with db() as conn:
        rows = conn.execute(
            "SELECT c.id AS id, c.doc_id AS doc_id, c.ord AS ord, c.page AS page,"
            " c.url AS url, c.text AS text, d.name AS doc_name, d.user_id AS user_id"
            " FROM chunks c JOIN documents d ON d.id = c.doc_id"
            " WHERE c.doc_id = ? AND d.status = 'ready' ORDER BY c.ord", (doc_id,)
        ).fetchall()
        return [dict(r) for r in rows]


def fail_stale_indexing() -> int:
    """Background indexing lives in this process, so anything still marked
    'indexing' after a restart is work that died with the old process. Close those
    out as errors — the UI then offers a Retry instead of showing a spinner that
    will never finish. The reason goes in the row, because "it failed" with no
    explanation sends people to re-upload the same file and watch it hang again."""
    with db() as conn:
        cur = conn.execute(
            "UPDATE documents SET status='error', stage='failed', progress=0,"
            " error='Indexing stopped when the server restarted — retry it to index the document again.'"
            " WHERE status='indexing'")
        return cur.rowcount


def get_chunks(doc_id: str, user_id: Optional[str] = None) -> List[Dict[str, Any]]:
    with db() as conn:
        if user_id:
            doc = conn.execute("SELECT id FROM documents WHERE id=? AND user_id=?", (doc_id, user_id)).fetchone()
            if not doc:
                return []
        rows = conn.execute(
            "SELECT id, doc_id, ord, page, url, text FROM chunks WHERE doc_id=? ORDER BY ord",
            (doc_id,)
        ).fetchall()
        return [dict(r) for r in rows]


def get_stats(user_id: Optional[str] = None) -> Dict[str, Any]:
    with db() as conn:
        if user_id:
            docs = conn.execute("SELECT COUNT(*) as c, SUM(size) as s FROM documents WHERE user_id=?", (user_id,)).fetchone()
            ready = conn.execute("SELECT COUNT(*) as c FROM documents WHERE user_id=? AND status='ready'", (user_id,)).fetchone()
            chunks = conn.execute("SELECT COUNT(*) as c FROM chunks c JOIN documents d ON d.id=c.doc_id WHERE d.user_id=?", (user_id,)).fetchone()
        else:
            docs = conn.execute("SELECT COUNT(*) as c, SUM(size) as s FROM documents").fetchone()
            ready = conn.execute("SELECT COUNT(*) as c FROM documents WHERE status='ready'").fetchone()
            chunks = conn.execute("SELECT COUNT(*) as c FROM chunks").fetchone()
        return {
            "total_documents": docs["c"] if docs and docs["c"] else 0,
            "ready_documents": ready["c"] if ready and ready["c"] else 0,
            "total_chunks": chunks["c"] if chunks and chunks["c"] else 0,
            "total_size_bytes": docs["s"] if docs and docs["s"] else 0,
        }


# --------------------------------- users ----------------------------------

def create_user(user_id: str, email: str, name: str, pw_hash: str, verified: bool = False) -> None:
    with db() as conn:
        conn.execute(
            "INSERT INTO users(id,email,name,pw,verified,created_at) VALUES(?,?,?,?,?,?)",
            (user_id, email.lower().strip(), name, pw_hash, 1 if verified else 0, now_iso()),
        )


def get_user(user_id: str) -> Optional[Dict[str, Any]]:
    with db() as conn:
        row = conn.execute("SELECT * FROM users WHERE id=?", (user_id,)).fetchone()
        return dict(row) if row else None


def get_user_by_email(email: str) -> Optional[Dict[str, Any]]:
    with db() as conn:
        row = conn.execute("SELECT * FROM users WHERE email=?", (email.lower().strip(),)).fetchone()
        return dict(row) if row else None


def update_user(user_id: str, name: Optional[str] = None, email: Optional[str] = None,
                verified: Optional[bool] = None) -> None:
    """Patch only the fields that were supplied."""
    fields: Dict[str, Any] = {}
    if name is not None:
        fields["name"] = name
    if email is not None:
        fields["email"] = email.lower().strip()
    if verified is not None:
        fields["verified"] = 1 if verified else 0
    if not fields:
        return
    cols = ", ".join(f"{k}=?" for k in fields)
    with db() as conn:
        conn.execute(f"UPDATE users SET {cols} WHERE id=?", (*fields.values(), user_id))


def update_password(user_id: str, pw_hash: str) -> None:
    with db() as conn:
        conn.execute("UPDATE users SET pw=? WHERE id=?", (pw_hash, user_id))


# ------------------------------ user API keys -------------------------------

# Stored per account (encrypted by keys.py) — one shared file meant that whoever
# pasted a Groq key was silently paying for every other account's answers.


def _safe_json(raw: str) -> Any:
    import json
    try:
        return json.loads(raw or "{}")
    except Exception:
        return {}


def get_user_keys(user_id: str) -> Dict[str, str]:
    with db() as conn:
        row = conn.execute("SELECT keys FROM users WHERE id=?", (user_id,)).fetchone()
    saved = _safe_json(row["keys"] if row else "{}")
    if not isinstance(saved, dict):
        return {}
    return {k: v for k, v in saved.items() if isinstance(v, str) and v.strip()}


def set_user_key(user_id: str, provider: str, value: Optional[str]) -> bool:
    """Write (or, with an empty value, drop) one provider key. True if the row changed."""
    import json
    current = get_user_keys(user_id)
    wanted = dict(current)
    if value:
        wanted[provider] = value
    else:
        wanted.pop(provider, None)
    if wanted == current:
        return False
    with db() as conn:
        conn.execute("UPDATE users SET keys=? WHERE id=?", (json.dumps(wanted), user_id))
    return True


def key_holder_count(provider: str) -> int:
    """How many accounts have saved a key for this provider (used by /health;
    the key values themselves never leave the database)."""
    with db() as conn:
        rows = conn.execute("SELECT keys FROM users WHERE keys IS NOT NULL AND keys!='{}'").fetchall()
    n = 0
    for r in rows:
        saved = _safe_json(r["keys"])
        if isinstance(saved, dict) and (saved.get(provider) or "").strip():
            n += 1
    return n


# --------------------------------- usage -----------------------------------


def bump_usage(user_id: str, requests: int = 0, prompt_tokens: int = 0, completion_tokens: int = 0) -> None:
    """Accumulate rough per-account token use for the day. Estimated, not billed —
    Groq's stream doesn't return usage counts unless we ask for a final event."""
    if not user_id:
        return
    day = now_iso()[:10]
    with db() as conn:
        conn.execute(
            "INSERT INTO usage_day(user_id,day,requests,prompt_tokens,completion_tokens) VALUES(?,?,?,?,?)"
            " ON CONFLICT(user_id,day) DO UPDATE SET requests=requests+excluded.requests,"
            " prompt_tokens=prompt_tokens+excluded.prompt_tokens,"
            " completion_tokens=completion_tokens+excluded.completion_tokens",
            (user_id, day, requests, prompt_tokens, completion_tokens),
        )


def get_usage(user_id: str, days: int = 30) -> List[Dict[str, Any]]:
    with db() as conn:
        rows = conn.execute(
            "SELECT day,requests,prompt_tokens,completion_tokens FROM usage_day"
            " WHERE user_id=? ORDER BY day DESC LIMIT ?", (user_id, max(1, min(int(days), 365)))
        ).fetchall()
        return [dict(r) for r in rows]


# ------------------------------ user prefs ---------------------------------

# Retrieval tuning lives per user so the Settings page can change it without a
# redeploy; anything not set falls back to the server environment.


def _env_prefs() -> Dict[str, int]:
    s = get_settings()
    return {"top_k": s.top_k, "chunk_size": s.chunk_size, "chunk_overlap": s.chunk_overlap}


def get_prefs(user_id: str) -> Dict[str, int]:
    prefs = _env_prefs()
    with db() as conn:
        row = conn.execute("SELECT prefs FROM users WHERE id=?", (user_id,)).fetchone()
    if row and row["prefs"]:
        import json
        try:
            saved = json.loads(row["prefs"])
        except Exception:
            saved = {}
        if isinstance(saved, dict):
            for k in prefs:
                if k in saved:
                    try:
                        prefs[k] = int(saved[k])
                    except (TypeError, ValueError):
                        pass
    return prefs


def set_prefs(user_id: str, values: Dict[str, int]) -> Dict[str, int]:
    import json
    current = get_prefs(user_id)
    current.update({k: int(v) for k, v in values.items() if k in current})
    with db() as conn:
        conn.execute("UPDATE users SET prefs=? WHERE id=?",
                     (json.dumps({k: current[k] for k in ("top_k", "chunk_size", "chunk_overlap")}), user_id))
    return current


# ------------------------------ account data --------------------------------


def export_user(user_id: str) -> Optional[Dict[str, Any]]:
    """Everything this account owns, in one JSON-safe blob (GDPR-style export).
    Never selects pw or keys — an export is something users paste in issues."""
    with db() as conn:
        u = conn.execute("SELECT id,email,name,verified,created_at FROM users WHERE id=?", (user_id,)).fetchone()
        if not u:
            return None
        docs = [dict(r) for r in conn.execute(
            "SELECT id,name,kind,size,status,num_pages,url,tags,error,created_at FROM documents"
            " WHERE user_id=? ORDER BY created_at DESC", (user_id,)).fetchall()]
        for d in docs:
            d["chunks"] = [dict(r) for r in conn.execute(
                "SELECT ord,page,url,text FROM chunks WHERE doc_id=? ORDER BY ord", (d["id"],)).fetchall()]
            d["path"] = str(d.get("path") or "")
        convs = []
        import json
        for r in conn.execute("SELECT id,title,messages,doc_ids,pinned,updated_at,created_at"
                              " FROM conversations WHERE user_id=? ORDER BY updated_at DESC", (user_id,)).fetchall():
            c = dict(r)
            c["messages"] = json.loads(c["messages"] or "[]")
            c["doc_ids"] = json.loads(c["doc_ids"]) if c["doc_ids"] else None
            c["pinned"] = bool(c["pinned"])
            convs.append(c)
        return {"exported_at": now_iso(), "profile": dict(u), "documents": docs, "conversations": convs}


def delete_account(user_id: str) -> List[str]:
    """Remove the account and everything it owns. Returns stored file paths so
    the caller can unlink them. The default (auth-off) user can't be deleted."""
    with db() as conn:
        paths = [r["path"] for r in conn.execute(
            "SELECT path FROM documents WHERE user_id=? AND path IS NOT NULL", (user_id,)).fetchall()]
        ids = [r["id"] for r in conn.execute("SELECT id FROM documents WHERE user_id=?", (user_id,)).fetchall()]
        if ids:
            marks = ",".join("?" * len(ids))
            conn.execute(f"DELETE FROM chunks WHERE doc_id IN ({marks})", ids)
        conn.execute("DELETE FROM documents WHERE user_id=?", (user_id,))
        conn.execute("DELETE FROM conversations WHERE user_id=?", (user_id,))
        conn.execute("DELETE FROM reset_tokens WHERE user_id=?", (user_id,))
        conn.execute("DELETE FROM verify_tokens WHERE user_id=?", (user_id,))
        conn.execute("DELETE FROM usage_day WHERE user_id=?", (user_id,))
        conn.execute("DELETE FROM users WHERE id=?", (user_id,))
        return [p for p in paths if p]


# ------------------------------ password reset ------------------------------

def create_reset_token(token_hash: str, user_id: str, expires_at: int) -> None:
    with db() as conn:
        conn.execute(
            "INSERT INTO reset_tokens(token_hash,user_id,expires_at,created_at) VALUES(?,?,?,?)",
            (token_hash, user_id, expires_at, now_iso()),
        )


def get_reset_user(token_hash: str) -> Optional[Dict[str, Any]]:
    """Return the user behind a still-valid (non-expired) reset token."""
    with db() as conn:
        row = conn.execute(
            "SELECT u.* FROM reset_tokens r JOIN users u ON u.id = r.user_id"
            " WHERE r.token_hash=? AND r.expires_at > ?",
            (token_hash, int(time.time())),
        ).fetchone()
        return dict(row) if row else None


def consume_reset_tokens(token_hash: Optional[str] = None, user_id: Optional[str] = None) -> None:
    """Invalidate one token and/or every token for a user (one-time use)."""
    with db() as conn:
        if token_hash:
            conn.execute("DELETE FROM reset_tokens WHERE token_hash=?", (token_hash,))
        if user_id:
            conn.execute("DELETE FROM reset_tokens WHERE user_id=?", (user_id,))


# ------------------------------ email verify --------------------------------

def create_verify_token(token_hash: str, user_id: str, expires_at: int) -> None:
    with db() as conn:
        conn.execute(
            "INSERT INTO verify_tokens(token_hash,user_id,expires_at,created_at) VALUES(?,?,?,?)",
            (token_hash, user_id, expires_at, now_iso()),
        )


def get_verify_user(token_hash: str) -> Optional[Dict[str, Any]]:
    """Return the user behind a still-valid (non-expired) verification token."""
    with db() as conn:
        row = conn.execute(
            "SELECT u.* FROM verify_tokens v JOIN users u ON u.id = v.user_id"
            " WHERE v.token_hash=? AND v.expires_at > ?",
            (token_hash, int(time.time())),
        ).fetchone()
        return dict(row) if row else None


def mark_verified(user_id: str) -> None:
    """Flip the account to verified and drop every pending verification token."""
    with db() as conn:
        conn.execute("UPDATE users SET verified=1 WHERE id=?", (user_id,))
        conn.execute("DELETE FROM verify_tokens WHERE user_id=?", (user_id,))


# ------------------------------ conversations ------------------------------

def list_conversations(user_id: str) -> List[Dict[str, Any]]:
    with db() as conn:
        rows = conn.execute(
            "SELECT * FROM conversations WHERE user_id=? ORDER BY updated_at DESC", (user_id,)
        ).fetchall()
        out = []
        for r in rows:
            d = dict(r)
            d["pinned"] = bool(d.get("pinned"))
            out.append(d)
        return out


def upsert_conversation(conv: Dict[str, Any], user_id: str) -> None:
    import json
    with db() as conn:
        conn.execute(
            "INSERT INTO conversations(id,user_id,title,messages,doc_ids,pinned,updated_at,created_at)"
            " VALUES(?,?,?,?,?,?,?,?)"
            " ON CONFLICT(id) DO UPDATE SET title=excluded.title, messages=excluded.messages,"
            " doc_ids=excluded.doc_ids, pinned=excluded.pinned, updated_at=excluded.updated_at",
            (conv["id"], user_id, conv.get("title") or "New chat",
             json.dumps(conv.get("messages") or []),
             json.dumps(conv.get("docIds")) if conv.get("docIds") is not None else None,
             1 if conv.get("pinned") else 0, int(conv.get("updatedAt") or 0), now_iso()),
        )


def get_conversation(conv_id: str, user_id: str) -> Optional[Dict[str, Any]]:
    with db() as conn:
        row = conn.execute(
            "SELECT * FROM conversations WHERE id=? AND user_id=?", (conv_id, user_id)
        ).fetchone()
        return dict(row) if row else None


def delete_conversation(conv_id: str, user_id: str) -> None:
    with db() as conn:
        conn.execute("DELETE FROM conversations WHERE id=? AND user_id=?", (conv_id, user_id))


def delete_all_conversations(user_id: str) -> int:
    with db() as conn:
        cur = conn.execute("DELETE FROM conversations WHERE user_id=?", (user_id,))
        return cur.rowcount

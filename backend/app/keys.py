"""Per-account API key storage.

Keys live in the account's row (users.keys), encrypted with a key derived from
the token signing secret, and are never returned to the client — the Settings
page only ever learns "saved" / "env" / "none".

Before this, one shared data/keys.json served the whole instance, so the first
account to paste a Groq key was silently billed for every other account's
answers. adopt_legacy_keys() runs at startup and moves that file's contents to
the built-in account (the one used when auth is off), then removes the file.
"""
from __future__ import annotations

import json
from typing import Dict, Optional

from . import db
from .auth import decrypt_secret, encrypt_secret
from .config import get_settings

PROVIDERS = ("groq", "pinecone")


def _saved(user_id: Optional[str]) -> Dict[str, str]:
    """Decrypted provider -> key map for one account ({} without an account)."""
    if not user_id:
        return {}
    out: Dict[str, str] = {}
    for provider, blob in db.get_user_keys(user_id).items():
        plain = decrypt_secret(blob).strip()
        if plain:
            out[provider] = plain
    return out


def save_user_keys(user_id: str, groq: Optional[str] = None, pinecone: Optional[str] = None) -> None:
    for provider, value in (("groq", groq), ("pinecone", pinecone)):
        if value is None:
            continue
        key = value.strip()
        # An empty string means "forget it", same as the DELETE endpoint.
        db.set_user_key(user_id, provider, encrypt_secret(key) if key else "")


def clear_user_key(user_id: str, provider: str) -> bool:
    """Drop an account's stored key. Returns False when the server environment
    still supplies one, so the UI can say honestly that it isn't ours to remove."""
    had = bool(_saved(user_id).get(provider))
    db.set_user_key(user_id, provider, "")
    return had and not bool(_env_key(provider))


def _env_key(provider: str) -> str:
    s = get_settings()
    return (s.groq_api_key if provider == "groq" else s.pinecone_api_key).strip()


def effective_groq_key(user_id: Optional[str] = None) -> str:
    """This account's own key first, then the server environment. Never another
    account's — that was the multi-tenant leak."""
    return _saved(user_id).get("groq", "") or _env_key("groq")


def effective_pinecone_key(user_id: Optional[str] = None) -> str:
    return _saved(user_id).get("pinecone", "") or _env_key("pinecone")


def _source(saved: str, env: str) -> str:
    if (saved or "").strip():
        return "saved"
    return "env" if (env or "").strip() else "none"


def get_key_status(user_id: Optional[str] = None) -> dict:
    s = get_settings()
    owned = _saved(user_id)
    return {
        "groq_configured": bool(effective_groq_key(user_id)),
        "groq_source": _source(owned.get("groq", ""), s.groq_api_key),
        "groq_model": s.groq_model,
        "pinecone_configured": bool(effective_pinecone_key(user_id)),
        "pinecone_source": _source(owned.get("pinecone", ""), s.pinecone_api_key),
        # Keys are per account: an env key is shared, a saved key bills only this account.
        "scope": "account",
        # Retrieval in this build is BM25 over SQLite; no vector store is called.
        "retrieval": "bm25",
    }


def adopt_legacy_keys() -> int:
    """Move the old shared data/keys.json onto the built-in account and delete it."""
    p = get_settings().keys_path
    if not p.exists():
        return 0
    try:
        data = json.loads(p.read_text(encoding="utf-8"))
    except Exception:
        data = {}
    moved = 0
    if isinstance(data, dict):
        db.ensure_default_user()   # the key has to land on a row that exists
        for provider in PROVIDERS:
            value = (data.get(provider) or "").strip()
            if value:
                db.set_user_key(db.DEFAULT_USER_ID, provider, encrypt_secret(value))
                moved += 1
    try:
        p.unlink()
    except Exception:
        pass
    return moved

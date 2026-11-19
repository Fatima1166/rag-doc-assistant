"""Authentication primitives: pbkdf2 password hashing, HMAC-SHA256 signed
session tokens, per-user document helpers and a small in-process rate limiter.

Stdlib only (no JWT / passlib deps). The signing secret comes from
SECRET_KEY env, else it is generated once and persisted to data/secret.key.
"""
from __future__ import annotations

import hashlib
import hmac
import json
import os
import secrets
import threading
import base64
import time
from typing import Any, Dict, List, Optional

from .config import get_settings

PBKDF2_ITERATIONS = 240_000
_secret_cache: Optional[bytes] = None
_secret_lock = threading.Lock()
_auth_limiter: Optional["RateLimiter"] = None
_chat_limiter: Optional["RateLimiter"] = None
_limiter_lock = threading.Lock()


def _b64e(raw: bytes) -> str:
    return base64.urlsafe_b64encode(raw).decode().rstrip("=")


def _b64d(s: str) -> bytes:
    return base64.urlsafe_b64decode(s + "=" * (-len(s) % 4))


def _secret() -> bytes:
    global _secret_cache
    with _secret_lock:
        if _secret_cache:
            return _secret_cache
        env = (os.getenv("SECRET_KEY") or "").strip()
        if env:
            _secret_cache = env.encode()
        else:
            p = get_settings().data_dir / "secret.key"
            if p.exists():
                _secret_cache = p.read_bytes()
            else:
                _secret_cache = secrets.token_bytes(32)
                p.write_bytes(_secret_cache)
                try:
                    p.chmod(0o600)
                except Exception:
                    pass
        return _secret_cache


def _keystream(iv: bytes, n: int) -> bytes:
    """HMAC-SHA256 in counter mode used as a pseudorandom one-time pad."""
    out = bytearray()
    counter = 0
    while len(out) < n:
        out += hmac.new(_secret(), iv + counter.to_bytes(8, "big"), hashlib.sha256).digest()
        counter += 1
    return bytes(out[:n])


def encrypt_secret(plain: str) -> str:
    """Encrypt-then-MAC against the token signing secret, so a copied database or
    a stolen backup doesn't hand over the API keys accounts have stored.
    Format: v1.<base64(iv | ciphertext | tag)>."""
    iv = secrets.token_bytes(16)
    data = (plain or "").encode()
    ct = bytes(a ^ b for a, b in zip(data, _keystream(iv, len(data))))
    tag = hmac.new(_secret(), iv + ct, hashlib.sha256).digest()
    return "v1." + _b64e(iv + ct + tag)


def decrypt_secret(value: str) -> str:
    """Inverse of encrypt_secret. '' means "nothing usable" — a tampered or
    foreign payload fails the tag check and is never decrypted."""
    if not value:
        return ""
    if not value.startswith("v1."):
        return value  # a bare value written by an older build
    try:
        raw = _b64d(value[3:])
        iv, ct, tag = raw[:16], raw[16:-32], raw[-32:]
        if not hmac.compare_digest(hmac.new(_secret(), iv + ct, hashlib.sha256).digest(), tag):
            return ""
        return bytes(a ^ b for a, b in zip(ct, _keystream(iv, len(ct)))).decode()
    except Exception:
        return ""


def hash_password(pw: str) -> str:
    salt = secrets.token_bytes(16)
    dk = hashlib.pbkdf2_hmac("sha256", pw.encode(), salt, PBKDF2_ITERATIONS)
    return f"pbkdf2${PBKDF2_ITERATIONS}${salt.hex()}${dk.hex()}"


def verify_password(pw: str, stored: str) -> bool:
    try:
        _scheme, iters, salt_hex, hash_hex = stored.split("$")
        dk = hashlib.pbkdf2_hmac("sha256", pw.encode(), bytes.fromhex(salt_hex), int(iters))
        return hmac.compare_digest(dk.hex(), hash_hex)
    except Exception:
        return False


def issue_token(user: Dict[str, Any]) -> str:
    days = int(os.getenv("SESSION_DAYS", "30"))
    payload: Dict[str, Any] = {"sub": user["id"], "pv": password_version(user)}
    if days > 0:  # 0 = token never expires
        payload["exp"] = int(time.time()) + days * 86400
    body = _b64e(json.dumps(payload, separators=(",", ":")).encode())
    sig = hmac.new(_secret(), body.encode(), hashlib.sha256).hexdigest()
    return f"{body}.{sig}"


def password_version(user: Dict[str, Any]) -> str:
    """Short digest of the stored password hash, carried inside the token.
    Changing (or setting) the password therefore invalidates every session that
    was issued before it — tokens are stateless, so this is how we log others out."""
    return hashlib.sha256((user.get("pw") or "").encode()).hexdigest()[:12]


def verify_token(token: str) -> Optional[Dict[str, Any]]:
    if not token or "." not in token:
        return None
    body, _, sig = token.rpartition(".")
    expected = hmac.new(_secret(), body.encode(), hashlib.sha256).hexdigest()
    if not hmac.compare_digest(expected, sig):
        return None
    try:
        payload = json.loads(_b64d(body))
    except Exception:
        return None
    exp = int(payload.get("exp", 0))
    if exp and exp < int(time.time()):  # tokens issued with SESSION_DAYS=0 have no exp
        return None
    from . import db
    user = db.get_user(payload["sub"])
    if not user:
        return None
    pv = payload.get("pv")
    # Tokens minted before password-versioning still work; newer ones are bound
    # to the password they were issued under.
    if pv and not hmac.compare_digest(str(pv), password_version(user)):
        return None
    return user


class RateLimiter:
    """Simple in-process sliding window. For multi-worker deployments put
    this behind Redis / nginx limit_req. limit <= 0 disables the limiter."""

    def __init__(self, limit: int, window_seconds: int) -> None:
        self.disabled = limit <= 0
        self.limit, self.window = max(1, limit), max(1, window_seconds)
        self._hits: Dict[str, List[float]] = {}
        self._lock = threading.Lock()

    def check(self, key: str) -> bool:
        if self.disabled:
            return True
        now = time.time()
        with self._lock:
            hits = [t for t in self._hits.get(key, []) if now - t < self.window]
            if len(hits) >= self.limit:
                self._hits[key] = hits
                return False
            hits.append(now)
            self._hits[key] = hits
            return True


def auth_limiter() -> RateLimiter:
    global _auth_limiter
    with _limiter_lock:
        if _auth_limiter is None:
            _auth_limiter = RateLimiter(int(os.getenv("RATE_LIMIT_AUTH", "10")), 60)
        return _auth_limiter


def chat_limiter() -> RateLimiter:
    global _chat_limiter
    with _limiter_lock:
        if _chat_limiter is None:
            _chat_limiter = RateLimiter(int(os.getenv("RATE_LIMIT_CHAT", "30")), 60)
        return _chat_limiter

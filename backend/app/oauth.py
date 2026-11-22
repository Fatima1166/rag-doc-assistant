"""Social sign-in for Google and GitHub — stdlib only (urllib/secrets).

Flow:  GET /api/auth/oauth/<provider>  -> 302 to the provider carrying a
random state value (also stored in an HttpOnly cookie).  The provider
redirects back to /api/auth/oauth/<provider>/callback, the authorization
code is exchanged for an access token, the account email/name is fetched,
the local user is found-or-created and the browser lands on
<FRONTEND_ORIGIN>/auth/callback#token=<session token> — the fragment keeps
the token out of server logs and Referer headers.

Redirect URIs to register with the providers (local dev):
  http://localhost:8000/api/auth/oauth/google/callback
  http://localhost:8000/api/auth/oauth/github/callback
"""
from __future__ import annotations

import json
import os
import secrets
import urllib.error
import urllib.parse
import urllib.request
from typing import Any, Dict, Tuple

STATE_COOKIE = "ragdocs_oauth_state"


class OAuthError(Exception):
    pass


def _configs() -> Dict[str, Dict[str, str]]:
    return {
        "google": {
            "client_id": os.getenv("GOOGLE_CLIENT_ID", "").strip(),
            "secret": os.getenv("GOOGLE_CLIENT_SECRET", "").strip(),
            "authorize": "https://accounts.google.com/o/oauth2/v2/auth",
            "token": "https://oauth2.googleapis.com/token",
            "userinfo": "https://openidconnect.googleapis.com/v1/userinfo",
            "scope": "openid email profile",
        },
        "github": {
            "client_id": os.getenv("GITHUB_CLIENT_ID", "").strip(),
            "secret": os.getenv("GITHUB_CLIENT_SECRET", "").strip(),
            "authorize": "https://github.com/login/oauth/authorize",
            "token": "https://github.com/login/oauth/access_token",
            "userinfo": "https://api.github.com/user",
            "scope": "user:email",
        },
    }


def _provider(name: str) -> Dict[str, str]:
    p = _configs().get(name)
    if not p:
        raise OAuthError("Unknown OAuth provider")
    if not (p["client_id"] and p["secret"]):
        raise OAuthError(f"{name.title()} sign-in isn't configured on this backend")
    return p


def configured() -> Dict[str, bool]:
    """Which providers have both a client id and secret (safe to show in the UI)."""
    return {n: bool(c["client_id"] and c["secret"]) for n, c in _configs().items()}


def start(name: str, redirect_uri: str) -> Tuple[str, str]:
    """Return (provider authorize URL, state)."""
    p = _provider(name)
    state = secrets.token_urlsafe(24)
    q = {"client_id": p["client_id"], "redirect_uri": redirect_uri,
         "response_type": "code", "scope": p["scope"], "state": state}
    return f"{p['authorize']}?{urllib.parse.urlencode(q)}", state


def _form_post(url: str, data: Dict[str, str]) -> Dict[str, Any]:
    req = urllib.request.Request(
        url, data=urllib.parse.urlencode(data).encode(),
        headers={"Accept": "application/json"})
    return _call(req)


def _get_json(url: str, access_token: str) -> Any:
    req = urllib.request.Request(url, headers={
        "Authorization": f"Bearer {access_token}",
        "Accept": "application/json", "User-Agent": "ragdocs-backend"})
    return _call(req)


def _call(req: urllib.request.Request) -> Any:
    try:
        with urllib.request.urlopen(req, timeout=15) as r:
            return json.loads(r.read())
    except urllib.error.HTTPError as e:
        raise OAuthError(f"provider request failed ({e.code})")
    except Exception:
        raise OAuthError("provider request failed")


def exchange(name: str, code: str, redirect_uri: str) -> str:
    """Authorization code -> access token."""
    p = _provider(name)
    tok = _form_post(p["token"], {
        "client_id": p["client_id"], "client_secret": p["secret"],
        "code": code, "grant_type": "authorization_code", "redirect_uri": redirect_uri,
    })
    access = tok.get("access_token")
    if not access:
        raise OAuthError("code exchange failed")
    return access


def fetch_identity(name: str, access_token: str) -> Dict[str, str]:
    """Access token -> {email, name, avatar}.

    A *verified* email is mandatory: it is what links a social login to an
    existing account, so an unverified address would be an account-takeover hole.
    """
    p = _provider(name)
    info = _get_json(p["userinfo"], access_token)
    email = ""
    if name == "google":
        flag = info.get("email_verified")
        if flag is True or str(flag).lower() == "true":
            email = (info.get("email") or "").strip().lower()
        avatar = info.get("picture") or ""
    else:  # github
        try:
            for e in _get_json("https://api.github.com/user/emails", access_token):
                if e.get("primary") and e.get("verified"):
                    email = (e.get("email") or "").strip().lower()
                    break
        except OAuthError:
            email = ""
        if not email:
            # GitHub only lets verified addresses be made public.
            email = (info.get("email") or "").strip().lower()
        avatar = info.get("avatar_url") or ""
    if not email:
        raise OAuthError("provider account has no verified email")
    display = info.get("name") or info.get("login") or email.split("@")[0]
    avatar = avatar if isinstance(avatar, str) and avatar.startswith("https://") else ""
    return {"email": email, "name": (display or email.split("@")[0])[:80], "avatar": avatar[:400]}

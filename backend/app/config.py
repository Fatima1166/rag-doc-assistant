"""Runtime settings loaded from environment / backend/.env (no external deps)."""
from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path
from typing import List

BASE_DIR = Path(__file__).resolve().parents[1]

# Free GroqCloud chat models, in the order we try them. The primary (first)
# model is used when it works; if a model 404s, errors, or returns only
# reasoning with no answer text, generation silently shifts to the next one.
# Override the whole list with a comma-separated GROQ_MODELS env var.
DEFAULT_FREE_MODELS = [
    "qwen/qwen3.8-27b",
    "openai/gpt-oss-20b",
    "openai/gpt-oss-120b",
    "allam-2-7b",
    "openai/gpt-oss-safeguard-20b",
]


def _model_list(primary: str) -> list[str]:
    """Candidate models, primary first, de-duplicated, order preserved."""
    raw = os.getenv("GROQ_MODELS", "").strip()
    pool = [m.strip() for m in raw.split(",") if m.strip()] if raw else list(DEFAULT_FREE_MODELS)
    ordered, seen = [primary] + pool, set()
    out = []
    for m in ordered:
        if m and m not in seen:
            seen.add(m)
            out.append(m)
    return out


def _load_env() -> None:
    env = BASE_DIR / ".env"
    if not env.exists():
        return
    for line in env.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))


_load_env()


@dataclass
class Settings:
    frontend_origin: str
    data_dir: Path
    files_dir: Path
    db_path: Path
    keys_path: Path
    groq_api_key: str
    pinecone_api_key: str
    groq_model: str
    groq_models: List[str]
    chunk_size: int
    chunk_overlap: int
    top_k: int
    max_upload_mb: int
    port: int
    auth_required: bool = False
    context_tokens: int = 6000
    max_output_tokens: int = 1024
    groq_retries: int = 3
    answer_cache_seconds: int = 900
    candidate_pool: int = 3


def _data_dir() -> Path:
    d = Path(os.getenv("RAGDATA_DIR", str(BASE_DIR / "data")))
    d.mkdir(parents=True, exist_ok=True)
    (d / "files").mkdir(parents=True, exist_ok=True)
    return d


def get_settings() -> Settings:
    data_dir = _data_dir()
    return Settings(
        frontend_origin=os.getenv("FRONTEND_ORIGIN", "http://localhost:3000"),
        data_dir=data_dir,
        files_dir=data_dir / "files",
        db_path=data_dir / "ragdocs.db",
        keys_path=data_dir / "keys.json",
        groq_api_key=os.getenv("GROQ_API_KEY", "").strip(),
        pinecone_api_key=os.getenv("PINECONE_API_KEY", "").strip(),
        groq_model=os.getenv("GROQ_MODEL", "qwen/qwen3.8-27b").strip(),
        groq_models=_model_list(os.getenv("GROQ_MODEL", "qwen/qwen3.8-27b").strip()),
        chunk_size=int(os.getenv("CHUNK_SIZE", "800")),
        chunk_overlap=int(os.getenv("CHUNK_OVERLAP", "120")),
        top_k=int(os.getenv("TOP_K", "4")),
        max_upload_mb=int(os.getenv("MAX_UPLOAD_MB", "20")),
        port=int(os.getenv("PORT", "8000")),
        auth_required=os.getenv("AUTH_REQUIRED", "false").lower() in ("1", "true"),
        # Hard ceiling on how much retrieved text one prompt may carry. Estimated
        # conservatively (see estimate_tokens) so a big corpus can't overflow the
        # model window; the oldest/lowest-ranked passages are dropped first.
        context_tokens=max(500, int(os.getenv("CONTEXT_TOKENS", "6000"))),
        max_output_tokens=max(128, int(os.getenv("MAX_OUTPUT_TOKENS", "1024"))),
        groq_retries=max(1, min(int(os.getenv("GROQ_RETRIES", "3")), 6)),
        answer_cache_seconds=max(0, int(os.getenv("ANSWER_CACHE_SECONDS", "900"))),
        # How many extra hits retrieval pulls before diversity/merging trims it to top_k.
        candidate_pool=max(1, int(os.getenv("CANDIDATE_POOL", "3"))),
    )


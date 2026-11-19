"""In-memory BM25 retrieval index kept in sync with SQLite.

Absorbing a document only tokenizes that document's passages — the previous
corpus's token lists are cached and reused, and rank_bm25 is re-instantiated
from those lists instead of re-tokenizing everything on every upload.
Uses rank_bm25 when available and falls back to a simple term-frequency scorer
so the server still returns sensible passages with zero heavy deps."""
from __future__ import annotations

import math
import re
import threading
from collections import Counter
from typing import Any, Dict, List, Optional

from .config import get_settings
from .db import all_ready_chunks, ready_chunk_count, ready_chunks_for

_TOKEN = re.compile(r"[a-zA-Z0-9_]+")
MMR_LAMBDA = 0.72   # 1.0 = pure relevance, 0.0 = pure novelty
MAX_MERGE = 4       # how many adjacent passages may be stitched into one block


def estimate_tokens(text: str) -> int:
    """Cheap token proxy: ~3.5 characters per token.

    A real BPE tokenizer averages closer to 4 for English prose and lower for
    code and punctuation, so 3.5 deliberately over-counts — over-counting costs
    a passage, under-counting blows the model's context window.
    """
    if not text:
        return 0
    return max(1, math.ceil(len(text) / 3.5))


def tokenize(text: str) -> List[str]:
    if not text:
        return []
    raw = text.lower()
    tokens = _TOKEN.findall(raw)
    extra = []
    for t in tokens:
        if "_" in t or "-" in t:
            parts = [p for p in re.split(r"[_\-]+", t) if p]
            if len(parts) > 1:
                extra.extend(parts)
    return tokens + extra


def _basic_score(q_tokens: List[str], d_tokens: List[str]) -> float:
    if not d_tokens or not q_tokens:
        return 0.0
    c = Counter(d_tokens)
    hits = sum(c[t] for t in set(q_tokens))
    return hits / math.sqrt(len(d_tokens) + 1)


def _jaccard(a: set, b: set) -> float:
    if not a or not b:
        return 0.0
    return len(a & b) / len(a | b)


def _clip_to_tokens(text: str, budget: int) -> str:
    """Hard-stop a block that alone exceeds the budget, at a word boundary."""
    limit = max(200, int(budget * 3.5))
    if len(text) <= limit:
        return text
    cut = text.rfind(" ", int(limit * 0.6), limit)
    return (text[:cut] if cut > 0 else text[:limit]).rstrip() + " …[truncated]"


def plan_context(pool: List[Dict[str, Any]], top_k: int, token_budget: int) -> List[Dict[str, Any]]:
    """Turn a ranked hit list into what actually goes into the prompt.

    Three steps, none of which need a model or a vector store:
    1. MMR selection — a hit that restates an already-chosen hit costs the
       reader nothing, so near-duplicates are penalised instead of crowding out
       the rest of the corpus.
    2. Neighbour stitching — adjacent passages of the same document are merged
       into one contiguous block, which is what "parent chunk expansion" buys
       you when chunks were cut by size rather than by structure.
    3. Token budget — blocks are added in rank order until the estimate hits the
       ceiling, so a huge corpus can't overflow the model window.
    """
    if not pool or top_k <= 0:
        return []
    ranked = [dict(c) for c in pool]
    sets = [set(tokenize(c.get("text", ""))) for c in ranked]
    top_score = max((float(c.get("score") or 0.0) for c in ranked), default=0.0) or 1.0
    chosen: List[int] = []
    left = list(range(len(ranked)))
    while left and len(chosen) < top_k:
        best, best_value = left[0], None
        for i in left:
            rel = MMR_LAMBDA * (float(ranked[i].get("score") or 0.0) / top_score)
            rep = max((_jaccard(sets[i], sets[j]) for j in chosen), default=0.0)
            value = rel - (1 - MMR_LAMBDA) * rep
            if best_value is None or value > best_value:
                best, best_value = i, value
        chosen.append(best)
        left.remove(best)

    # (doc_id, ord) -> pool position, for stitching neighbours together
    positions: Dict[str, Dict[int, int]] = {}
    for i, c in enumerate(ranked):
        positions.setdefault(str(c.get("doc_id")), {})[int(c.get("ord") or 0)] = i

    used: set = set()
    blocks: List[Dict[str, Any]] = []
    for i in chosen:
        if i in used:
            continue
        head = ranked[i]
        doc_id = str(head.get("doc_id"))
        ords = positions.get(doc_id, {})
        lo = hi = int(head.get("ord") or 0)
        while (lo - 1) in ords and (hi - (lo - 1)) < MAX_MERGE and (ords[lo - 1] not in used):
            lo -= 1
        while (hi + 1) in ords and (hi + 1 - lo) < MAX_MERGE and (ords[hi + 1] not in used):
            hi += 1
        parts = sorted((n for n in range(lo, hi + 1) if n in ords and ords[n] not in used))
        if not parts:
            parts = [int(head.get("ord") or 0)]
        pieces = [ranked[ords[n]] for n in parts if n in ords]
        if not pieces:
            pieces = [head]
        for n in parts:
            used.add(ords[n])
        pages = [int(p["page"]) for p in pieces if p.get("page")]
        block = dict(pieces[0])
        block["text"] = "\n\n".join((p.get("text") or "").strip() for p in pieces)
        block["merged"] = len(pieces)
        if pages:
            block["page"] = min(pages)
            block["page_end"] = max(pages)
        block["score"] = round(max(float(p.get("score") or 0.0) for p in pieces), 3)
        blocks.append(block)

    out: List[Dict[str, Any]] = []
    spent = 0
    for b in blocks:
        cost = estimate_tokens(b.get("text", ""))
        if spent + cost > token_budget:
            if not out:   # never answer with nothing because the best hit was huge
                b = dict(b)
                b["text"] = _clip_to_tokens(b["text"], token_budget)
                out.append(b)
            break
        spent += cost
        out.append(b)
    return out


class SearchIndex:
    def __init__(self) -> None:
        self._lock = threading.RLock()
        self._docs: List[Dict[str, Any]] = []
        self._toks: List[List[str]] = []
        self._bm25 = None
        self._n = -1          # corpus size currently held in memory
        self._cache: Dict[int, List[str]] = {}   # chunk id -> tokens, reused across updates

    def _compile(self, docs: List[Dict[str, Any]], toks: List[List[str]]) -> None:
        """Rebuild the scorer from already-tokenized text (no DB read, no tokenize)."""
        bm25 = None
        if docs:
            try:
                from rank_bm25 import BM25Okapi
                bm25 = BM25Okapi(toks)
            except Exception:
                bm25 = None
        with self._lock:
            self._docs, self._toks, self._bm25, self._n = docs, toks, bm25, len(docs)

    def rebuild(self) -> int:
        docs = all_ready_chunks()
        toks: List[List[str]] = []
        for d in docs:
            cached = self._cache.get(int(d["id"]))
            if cached is None:
                cached = tokenize(d["text"]) or [""]
            toks.append(cached)
        with self._lock:
            self._cache = {int(d["id"]): t for d, t in zip(docs, toks)}
        self._compile(docs, toks)
        return len(docs)

    def add_doc(self, doc_id: str) -> int:
        """Fold one document's passages into the corpus. Only this document's text
        is tokenized, so a big library doesn't pay for a full re-scan per upload."""
        fresh = ready_chunks_for(doc_id)
        with self._lock:
            docs = [d for d in self._docs if d.get("doc_id") != doc_id]
            toks = [self._cache.get(int(d["id"])) or tokenize(d["text"]) or [""] for d in docs]
            for c in fresh:
                t = self._cache.get(int(c["id"]))
                if t is None:
                    t = tokenize(c["text"]) or [""]
                self._cache[int(c["id"])] = t
                docs.append(c)
                toks.append(t)
        self._compile(docs, toks)
        return len(self._docs)

    def drop_doc(self, doc_id: str) -> int:
        """Remove one document's passages (deleted, re-indexed, or no longer ready)."""
        with self._lock:
            keep = [(d, self._cache.get(int(d["id"])) or tokenize(d["text"]) or [""])
                    for d in self._docs if d.get("doc_id") != doc_id]
            for d in self._docs:
                if d.get("doc_id") == doc_id:
                    self._cache.pop(int(d["id"]), None)
            docs = [d for d, _ in keep]
            toks = [t for _, t in keep]
        self._compile(docs, toks)
        return len(self._docs)

    def rename_doc(self, doc_id: str, name: str) -> None:
        """Keep citation titles honest after a rename — the corpus holds the name
        that was current when the passages were loaded, and no re-index is due."""
        with self._lock:
            for d in self._docs:
                if d.get("doc_id") == doc_id:
                    d["doc_name"] = name

    def ensure_fresh(self) -> None:
        """Indexing marks a document ready a moment before the in-memory corpus
        is rebuilt. Check the passage count so a search that arrives in that gap
        still finds the new text instead of reporting nothing."""
        with self._lock:
            held = self._n
        if held != ready_chunk_count():
            self.rebuild()

    def search(
        self,
        query: str,
        doc_ids: Optional[List[str]] = None,
        top_k: int = 4,
        user_id: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        self.ensure_fresh()
        with self._lock:
            docs, toks, bm25 = self._docs, self._toks, self._bm25
        if not docs:
            return []
        # If caller explicitly provided an empty list of doc_ids, scope is empty.
        if doc_ids is not None and len(doc_ids) == 0:
            return []

        wanted = {str(x) for x in doc_ids} if doc_ids is not None else None
        q_tokens = tokenize(query)
        if not q_tokens:
            return []

        if bm25 is not None:
            try:
                # rank_bm25 expects a token list, NOT the raw query string.
                scores = list(bm25.get_scores(q_tokens))
            except Exception:
                scores = [_basic_score(q_tokens, t) for t in toks]
        else:
            scores = [_basic_score(q_tokens, t) for t in toks]

        # Add phrase boost if exact phrase appears in text
        q_lower = query.strip().lower()
        if len(q_lower) > 3:
            for idx, d in enumerate(docs):
                if q_lower in (d.get("text") or "").lower():
                    scores[idx] += 2.5

        order = sorted(range(len(docs)), key=lambda i: scores[i], reverse=True)
        q_set = set(q_tokens)
        out: List[Dict[str, Any]] = []
        for i in order:
            d = docs[i]
            # Relevance gate: at least one shared query/document token
            if not (q_set & set(toks[i])):
                continue
            if wanted is not None and str(d.get("doc_id")) not in wanted:
                continue
            if user_id and d.get("user_id") and d["user_id"] != user_id:
                continue
            out.append(dict(d, score=round(float(scores[i]), 3)))
            if len(out) >= top_k:
                break
        return out

    def retrieve(
        self,
        query: str,
        doc_ids: Optional[List[str]] = None,
        top_k: int = 4,
        user_id: Optional[str] = None,
        token_budget: Optional[int] = None,
    ) -> List[Dict[str, Any]]:
        """Passages to hand the model: a wider candidate pool, then MMR, stitching
        and the token budget. `search()` stays the raw per-passage view."""
        s = get_settings()
        budget = int(token_budget if token_budget is not None else s.context_tokens)
        pool_k = min(32, max(top_k * s.candidate_pool, top_k + 4))
        pool = self.search(query, doc_ids=doc_ids, top_k=pool_k, user_id=user_id)
        return plan_context(pool, top_k, budget)

    def doc_count(self) -> int:
        with self._lock:
            return len(self._docs)


index = SearchIndex()

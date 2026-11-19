"""Live workflow probe: upload -> poll -> search -> dedup -> reindex -> chat -> delete.

Run against a started backend:  python backend/tests_live/live_check.py
"""
import sys
import time
import uuid
from pathlib import Path

import httpx

B = "http://localhost:8000"
DOC = (
    "RAGDocs E2E Probe\n\n"
    "The capital of the fictional kingdom of Eldoria is Sunspire.\n"
    "Quantum entanglement was first demonstrated in the lab of Dr. Iyer in 2031.\n"
)

client = httpx.Client(base_url=B, timeout=30)
ok = True


def check(label: str, cond: bool, detail: str = "") -> None:
    global ok
    ok = ok and cond
    print(f"{'PASS' if cond else 'FAIL'}  {label}  {detail}")


def poll(doc_id: str, seconds: float = 15.0) -> dict:
    deadline = time.time() + seconds
    d = {}
    while time.time() < deadline:
        d = client.get(f"/api/documents/{doc_id}").json()
        if d.get("status") in ("ready", "error"):
            return d
        time.sleep(0.3)
    return d


# 1. upload
r = client.post("/api/documents", files={"file": ("probe.txt", DOC.encode(), "text/plain")})
check("upload accepted (202)", r.status_code == 202, f"-> {r.status_code} {r.text[:120]}")
doc_id = r.json().get("id", "")

# 2. indexing reaches ready
d = poll(doc_id)
check("indexing -> ready", d.get("status") == "ready", f"status={d.get('status')} stage={d.get('stage')} error={d.get('error')}")
check("chunks stored", d.get("chunks", 0) >= 1, f"chunks={d.get('chunks')}")

# 3. immediate search sees the new content (stale-index regression)
s = client.post("/api/search", json={"query": "capital of Eldoria"}).json()
hits = s.get("results", [])
check("search finds new doc", any(h.get("doc_id") == doc_id for h in hits), f"hits={len(hits)}")
check("snippet has answer text", bool(hits) and "Sunspire" in hits[0].get("text", ""), f"first={hits[0].get('text', '')[:60] if hits else ''}")

# 4. duplicate upload is deduped, not re-indexed
r2 = client.post("/api/documents", files={"file": ("probe.txt", DOC.encode(), "text/plain")})
check("duplicate deduped (200 + deduped flag)", r2.status_code == 200 and r2.json().get("deduped"), f"-> {r2.status_code} {r2.text[:120]}")

# 5. reindex then immediate search
r3 = client.post(f"/api/documents/{doc_id}/reindex")
check("reindex accepted (202)", r3.status_code == 202, f"-> {r3.status_code}")
d2 = poll(doc_id)
check("reindex -> ready", d2.get("status") == "ready", f"status={d2.get('status')} error={d2.get('error')}")
s2 = client.post("/api/search", json={"query": "Dr. Iyer quantum", "doc_ids": [doc_id]}).json()
check("scoped search after reindex", len(s2.get("results", [])) >= 1, f"hits={len(s2.get('results', []))}")

# 6. chat streams an answer built from the doc
chunks = []
with client.stream("POST", "/api/chat", json={"messages": [{"role": "user", "content": "What is the capital of Eldoria?"}], "doc_ids": [doc_id]}) as resp:
    check("chat 200", resp.status_code == 200, f"-> {resp.status_code}")
    for line in resp.iter_text():
        chunks.append(line)
answer = "".join(chunks)
check("answer cites doc text", "Sunspire" in answer, f"len={len(answer)}")
check("sources delimiter present", "[[SOURCES]]" in answer, "")

# 7. error path: unsupported type + empty file
r4 = client.post("/api/documents", files={"file": ("bad.exe", b"MZ", "application/octet-stream")})
check("bad extension rejected (400)", r4.status_code == 400, f"-> {r4.status_code} {r4.text[:80]}")
r5 = client.post("/api/documents", files={"file": ("empty.txt", b"", "text/plain")})
d3 = poll(r5.json().get("id", "")) if r5.status_code == 202 else {}
check("empty file -> error with message", r5.status_code == 202 and d3.get("status") == "error" and bool(d3.get("error")), f"status={d3.get('status')} error={d3.get('error')}")

# 8. cleanup probe docs
for p in client.get("/api/documents").json():
    if p.get("name") in ("probe.txt", "empty.txt"):
        client.delete(f"/api/documents/{p['id']}")
print("\nRESULT:", "ALL PASS" if ok else "FAILURES PRESENT")
sys.exit(0 if ok else 1)

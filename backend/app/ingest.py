"""Text extraction and chunking for uploaded files and remote URLs.

Extraction is best-effort and dependency-light:
- PDF via pypdf, page by page (page numbers drive citations).
- .docx / .pptx / .xlsx via stdlib zipfile + ElementTree — those formats are
  just ZIP archives of XML, so no Office libraries are needed.
- .txt / .md / code / csv decoded as text; .html stripped to readable text.
- URL fetched with httpx, tags stripped to readable text.
If pypdf is unavailable, PDF extraction degrades to a simple byte scan so the
server still runs (quality drops, but nothing crashes).
"""
from __future__ import annotations

import io
import re
import zipfile
import xml.etree.ElementTree as ET
from typing import Any, Dict, List, Optional

import httpx

from .config import get_settings


class EmptySource(ValueError):
    """The source produced no text to index. Carries a message that tells the
    user what to do next, because a generic failure invites repeat uploads."""


def decode_text(raw: bytes) -> str:
    for enc in ("utf-8", "utf-16", "latin-1"):
        try:
            return raw.decode(enc)
        except UnicodeDecodeError:
            continue
    return raw.decode("utf-8", errors="ignore")


def de_space(text: str) -> str:
    """Undo pypdf's letter-spaced rendering. Many PDFs draw a title like
    'WisRule' as one text run per glyph, and extraction then yields
    'W i s R u l e' (or one glyph per line) — every word becomes single
    characters, which no tokenizer can match, so the document looks indexed
    but finds nothing.

    pypdf keeps the original spacing distances, which gives the structure:
    a single space between one-character tokens is intra-word glyph spacing;
    two spaces or a newline is a real word boundary. Only lines made almost
    entirely of one-character tokens are that artifact — prose like 'I am a
    student' has two-letter words and is left alone. Applied to PDF extraction
    only; legitimate 'a b c' lists in txt/md files are kept."""
    out_lines: List[str] = []
    for line in text.splitlines():
        # Each token paired with the size of the space run AFTER it (the gap
        # before token i is therefore gaps[i-1]). Trailing whitespace is dropped.
        pairs = [(part, len(gap)) for part, gap in re.findall(r"(\S+)([ \t]*)", line)
                 if part]
        toks = [p for p, _ in pairs]
        gaps = [g for _, g in pairs]
        if len(toks) >= 4 and sum(1 for t in toks if len(t) == 1) >= 0.8 * len(toks):
            merged = toks[0]
            for i in range(1, len(toks)):
                if gaps[i - 1] == 1:
                    merged += toks[i]            # intra-word glyph join
                else:
                    merged += " " + toks[i]      # real word boundary
            line = merged
        out_lines.append(line)
    return "\n".join(out_lines)


def extract_pdf(raw: bytes) -> List[Dict[str, Any]]:
    """Return a list of {page, text} sections, one per non-empty page."""
    try:
        from pypdf import PdfReader
    except Exception:
        return [{"page": None, "text": decode_text(raw)}]
    reader = PdfReader(io.BytesIO(raw))
    sections: List[Dict[str, Any]] = []
    for i, page in enumerate(reader.pages, start=1):
        try:
            text = de_space((page.extract_text() or "").strip())
        except Exception:
            text = ""
        if text:
            sections.append({"page": i, "text": text})
    if not sections:
        raise EmptySource(
            f"No text layer found in a {len(reader.pages)}-page PDF — it looks like a "
            "scan or a picture of pages, and this build doesn't do OCR. Export the PDF "
            "with selectable text, or upload the document as Markdown or plain text.")
    return sections


_TAG = re.compile(r"<[^>]+>")
_WS = re.compile(r"[ \t\f\r]+")
_BLANK = re.compile(r"\n\s*\n\s*\n+")


def html_to_text(html: str) -> str:
    html = re.sub(r"(?is)<(script|style|noscript|svg|head)[^>]*>.*?</\1>", " ", html)
    html = re.sub(r"(?i)<br\s*/?>|</p>|</div>|</li>|</h[1-6]>", "\n", html)
    text = _TAG.sub(" ", html)
    text = (text.replace("&#39;", "'").replace("&quot;", '"').replace("&nbsp;", " ")
                .replace("&amp;", "&").replace("&lt;", "<").replace("&gt;", ">"))
    text = _WS.sub(" ", text)
    text = _BLANK.sub("\n\n", text)
    return "\n".join(line.strip() for line in text.splitlines()).strip()


def _local(tag: str) -> str:
    """ElementTree keeps the namespace in the tag; Office documents only differ by it."""
    return tag.rsplit("}", 1)[-1]


def _slide_no(name: str) -> int:
    m = re.search(r"(\d+)\.xml$", name)
    return int(m.group(1)) if m else 0


def extract_docx(raw: bytes) -> List[Dict[str, Any]]:
    """Word: paragraphs of <w:t> runs inside word/document.xml. One section for the
    whole file — docx carries no page breaks that survive a plain text dump."""
    with zipfile.ZipFile(io.BytesIO(raw)) as z:
        if "word/document.xml" not in z.namelist():
            raise ValueError("not a readable .docx (word/document.xml is missing)")
        root = ET.fromstring(z.read("word/document.xml"))
    paragraphs: List[str] = []
    for p in root.iter():
        if _local(p.tag) != "p":
            continue
        buf: List[str] = []
        for el in p.iter():
            kind = _local(el.tag)
            if kind == "t":
                buf.append(el.text or "")
            elif kind == "tab":
                buf.append("\t")
            elif kind in ("br", "cr"):
                buf.append("\n")
        text = "".join(buf).strip()
        if text:
            paragraphs.append(text)
    body = "\n\n".join(paragraphs)
    return [{"page": None, "text": body}] if body else [{"page": None, "text": ""}]


def extract_pptx(raw: bytes) -> List[Dict[str, Any]]:
    """PowerPoint: one section per slide, numbered, so citations can say 'slide 7'."""
    with zipfile.ZipFile(io.BytesIO(raw)) as z:
        slides = sorted((n for n in z.namelist() if re.fullmatch(r"ppt/slides/slide\d+\.xml", n)), key=_slide_no)
        sections: List[Dict[str, Any]] = []
        for i, name in enumerate(slides, start=1):
            root = ET.fromstring(z.read(name))
            runs = [(el.text or "").strip() for el in root.iter() if _local(el.tag) == "t"]
            text = "\n".join(r for r in runs if r)
            if text:
                sections.append({"page": i, "text": text})
    if not sections:
        return [{"page": None, "text": ""}]
    return sections


def extract_xlsx(raw: bytes) -> List[Dict[str, Any]]:
    """Excel: rows joined with ' | ', one section per sheet, named from the workbook."""
    with zipfile.ZipFile(io.BytesIO(raw)) as z:
        names = set(z.namelist())
        shared: List[str] = []
        if "xl/sharedStrings.xml" in names:
            for si in ET.fromstring(z.read("xl/sharedStrings.xml")).iter():
                if _local(si.tag) == "si":
                    shared.append("".join((t.text or "") for t in si.iter() if _local(t.tag) == "t"))
        titles: List[str] = []
        if "xl/workbook.xml" in names:
            titles = [el.get("name") or "" for el in ET.fromstring(z.read("xl/workbook.xml")).iter()
                      if _local(el.tag) == "sheet"]
        sheets = sorted((n for n in names if re.fullmatch(r"xl/worksheets/sheet\d+\.xml", n)), key=_slide_no)
        sections: List[Dict[str, Any]] = []
        for i, name in enumerate(sheets):
            root = ET.fromstring(z.read(name))
            lines: List[str] = []
            for row in root.iter():
                if _local(row.tag) != "row":
                    continue
                cells: List[str] = []
                for c in row:
                    if _local(c.tag) != "c":
                        continue
                    value = "".join((ch.text or "") for ch in c.iter()
                                    if _local(ch.tag) in ("v", "t")).strip()
                    if c.get("t") == "s" and value.isdigit() and int(value) < len(shared):
                        value = shared[int(value)].strip()
                    cells.append(value)
                line = " | ".join(cells).strip(" |")
                if line:
                    lines.append(line)
            title = titles[i] if i < len(titles) and titles[i] else f"Sheet {i + 1}"
            body = "\n".join(lines)
            if body:
                sections.append({"page": i + 1, "text": f"{title}\n{body}"})
    if not sections:
        return [{"page": None, "text": ""}]
    return sections


_OFFICE = {".docx": extract_docx, ".pptx": extract_pptx, ".xlsx": extract_xlsx}


def extract_content_by_ext(raw: bytes, ext: str) -> List[Dict[str, Any]]:
    """Extract sections based on file extension."""
    ext = ext.lower().strip()
    if ext == ".pdf":
        return extract_pdf(raw)
    if ext in _OFFICE:
        sections = _OFFICE[ext](raw)
        if not any((sec.get("text") or "").strip() for sec in sections):
            raise EmptySource(
                f"No readable text in this {ext} — the file is either empty, all images, "
                "or an encrypted/legacy format. Save it again from Office and retry.")
        return sections
    decoded = decode_text(raw)
    if ext in (".html", ".htm"):
        return [{"page": None, "text": html_to_text(decoded)}]
    if ext == ".json":
        import json
        try:
            parsed = json.loads(decoded)
            formatted = json.dumps(parsed, indent=2, ensure_ascii=False)
            return [{"page": None, "text": formatted}]
        except Exception:
            return [{"page": None, "text": decoded}]
    return [{"page": None, "text": decoded}]


def fetch_url(url: str) -> Dict[str, Any]:
    """Download a URL and return {name, text}. Raises on non-http(s) or errors."""
    if not re.match(r"^https?://", url, re.I):
        raise ValueError("Only http(s) URLs are supported")
    r = httpx.get(url, timeout=20, follow_redirects=True,
                  headers={"User-Agent": "RAGDocs/1.0 (+docs indexer)"})
    r.raise_for_status()
    ctype = r.headers.get("content-type", "")
    body = r.text if "html" in ctype or "text" in ctype or not ctype else ""
    text = html_to_text(body) if "html" in ctype else body.strip()
    if not text:
        raise EmptySource(
            f"That URL returned no readable text (content-type: {ctype or 'unknown'}"
            + ("; it isn't HTML or plain text" if body == "" else "") + "). "
            "Upload the file itself instead of linking it.")
    m = re.search(r"(?is)<title[^>]*>(.*?)</title>", body or "")
    name = (m.group(1).strip() if m else "") or url
    return {"name": name, "text": text}


def chunk(sections: List[Dict[str, Any]], url: Optional[str] = None, size: Optional[int] = None,
          overlap: Optional[int] = None) -> List[Dict[str, Any]]:
    """Split page/section texts into overlapping chunks that carry page + url.
    size/overlap default to the server environment; callers pass per-user values."""
    s = get_settings()
    size, overlap = max(200, size if size is not None else s.chunk_size), max(0, overlap if overlap is not None else s.chunk_overlap)
    chunks: List[Dict[str, Any]] = []
    for sec in sections:
        text = (sec.get("text") or "").strip()
        if not text:
            continue
        page, u = sec.get("page"), (sec.get("url") or url)
        start, n = 0, len(text)
        while start < n:
            end = min(start + size, n)
            # extend to a sentence/word boundary when possible
            if end < n:
                nl = text.rfind("\n", start, end)
                sp = text.rfind(" ", start, end)
                cut = nl if nl > start + size // 2 else (sp if sp > start + size // 2 else end)
                end = cut
            piece = text[start:end].strip()
            if piece:
                chunks.append({"text": piece, "page": page, "url": u})
            if end >= n:
                break
            start = max(0, end - overlap)
    return chunks

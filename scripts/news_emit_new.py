#!/usr/bin/env python3
"""Emit newly deployed news films as JSON items for content-notify."""
from __future__ import annotations

import json
import os
import sys
from pathlib import Path

WWW = Path(os.environ.get("NEWS_WWW", "/var/www/movie-awards-site"))
BASE = (os.environ.get("NEWS_PUBLIC_BASE") or "https://news.readcine.com").rstrip("/")
FILMS_JSON_CANDIDATES = [
    Path(os.environ.get("NEWS_FILMS_JSON", "")),
    WWW / "films-data.json",
    Path("/opt/movie-awards-site/src/data/films.json"),
]


def load_films() -> list[dict]:
    # Prefer film/*.html listing on deployed site (always present after export)
    film_dir = WWW / "film"
    items = []
    if film_dir.is_dir():
        for p in sorted(film_dir.glob("*.html")):
            fid = p.stem
            # title from <title> if possible
            title = fid
            try:
                html = p.read_text(encoding="utf-8", errors="replace")
                import re
                m = re.search(r"<title>(.*?)</title>", html, re.I | re.S)
                if m:
                    t = re.sub(r"\s*[|\-–].*$", "", m.group(1)).strip()
                    if t:
                        title = t
            except Exception:
                pass
            items.append({"id": fid, "title": title, "url": f"{BASE}/film/{fid}"})
        return items
    for cand in FILMS_JSON_CANDIDATES:
        if cand and cand.is_file():
            data = json.loads(cand.read_text(encoding="utf-8"))
            rows = data if isinstance(data, list) else data.get("films") or []
            for r in rows:
                fid = str(r.get("id") or "").strip()
                title = str(r.get("title") or fid).strip()
                if fid:
                    items.append({"id": fid, "title": title, "url": f"{BASE}/film/{fid}"})
            return items
    return items


def main() -> int:
    items = load_films()
    print(json.dumps(items, ensure_ascii=False))
    print(f"[news-emit] films={len(items)}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

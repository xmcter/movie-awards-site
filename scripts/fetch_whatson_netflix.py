#!/usr/bin/env python3
"""Fetch What's on Netflix US coming-soon calendar and ingest confirmed movie dates.

Public calendar page + JSON-LD ItemList (Movie with datePublished).
robots.txt only disallows wp-admin / search; identify UA; sleep >= 1.2s between GETs.

Usage (from repo root):
  python3 scripts/fetch_whatson_netflix.py
  python3 scripts/fetch_whatson_netflix.py --dry-run
  python3 scripts/fetch_whatson_netflix.py --report /tmp/won-report.json

Writes/updates:
  src/data/won-streaming-catalog.json  (new Netflix films)
  may patch streaming[] on existing catalog films (same id / titleEn)
Does NOT wipe When To Stream far-window entries on other platforms.
"""
from __future__ import annotations

import argparse
import json
import re
import sys
import time
import urllib.error
import urllib.request
from datetime import date
from html import unescape
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "src" / "data"
CALENDAR_URL = "https://www.whats-on-netflix.com/coming-soon/calendar/"
UA = "ReadCineBot/1.0 (+https://news.readcine.com; contact=tonyecter@gmail.com)"
MIN_INTERVAL_S = 1.2
SOURCE_LABEL = "What's on Netflix"
REGION = "美国"
PLATFORM = "netflix"
CATALOG_FILES = [
    "films.json",
    "major-awards.json",
    "more-catalog.json",
    "extra-catalog.json",
    "density-pack.json",
    "wts-streaming-catalog.json",
    "won-streaming-catalog.json",
    "motn-streaming-catalog.json",
]

DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")
SERIES_RE = re.compile(
    r"(?i)\b(season\s*\d+|series|miniseries|limited\s*series|tv\s*series|"
    r"episode|docuseries)\b|剧集|迷你剧|连续剧|限定剧"
)
DOC_RE = re.compile(r"(?i)\bdocumentary\b|\bdocuseries\b|纪录片|档案纪录")
ROUNDUP_RE = re.compile(
    r"(?i)\b(what'?s coming|first look|this week|guide to|slate|round[- ]?up|"
    r"everything coming|new on netflix)\b"
)


def log(msg: str) -> None:
    print(msg, flush=True)


def slugify(title: str) -> str:
    s = title.lower().strip()
    s = re.sub(r"['’]", "", s)
    s = re.sub(r"[^a-z0-9]+", "-", s)
    return s.strip("-") or "untitled"


def sleep_polite(last: list[float]) -> None:
    if last[0] > 0:
        elapsed = time.monotonic() - last[0]
        if elapsed < MIN_INTERVAL_S:
            time.sleep(MIN_INTERVAL_S - elapsed)
    last[0] = time.monotonic()


def http_get(url: str, last: list[float]) -> str:
    sleep_polite(last)
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "text/html,application/json"})
    with urllib.request.urlopen(req, timeout=60) as resp:
        return resp.read().decode("utf-8", errors="replace")


def parse_calendar_movies(html: str) -> list[dict[str, Any]]:
    blocks = re.findall(
        r'<script[^>]*type=["\']application/ld\+json["\'][^>]*>(.*?)</script>',
        html,
        flags=re.I | re.S,
    )
    movies: list[dict[str, Any]] = []
    for block in blocks:
        try:
            data = json.loads(block)
        except json.JSONDecodeError:
            continue
        stack = [data]
        while stack:
            cur = stack.pop()
            if isinstance(cur, dict):
                if cur.get("@type") == "Movie":
                    movies.append(cur)
                stack.extend(cur.values())
            elif isinstance(cur, list):
                stack.extend(cur)
    return movies


def is_real_date(s: str) -> bool:
    if not DATE_RE.match(s):
        return False
    try:
        date.fromisoformat(s)
        return True
    except ValueError:
        return False


def should_skip_movie(item: dict[str, Any]) -> str | None:
    name = unescape(str(item.get("name") or "")).strip()
    desc = unescape(str(item.get("description") or "")).strip()
    blob = f"{name} {desc}"
    if not name:
        return "empty_title"
    if ROUNDUP_RE.search(name):
        return "roundup"
    if DOC_RE.search(blob):
        return "documentary"
    if SERIES_RE.search(blob):
        return "series"
    # JSON-LD sometimes tags series as Movie with "Season N · …"
    if re.search(r"(?i)season\s*\d+", desc):
        return "series"
    d = item.get("datePublished")
    if not d or not is_real_date(str(d)):
        return "no_confirmed_date"
    return None


def load_catalog(path: Path) -> Any:
    if not path.exists():
        if path.name == "won-streaming-catalog.json":
            return {"films": [], "ceremonies": []}
        raise FileNotFoundError(path)
    return json.loads(path.read_text(encoding="utf-8"))


def iter_film_records() -> list[tuple[str, dict[str, Any], dict[str, Any]]]:
    """Return list of (filename, catalog_obj, film)."""
    out: list[tuple[str, dict[str, Any], dict[str, Any]]] = []
    for name in CATALOG_FILES:
        path = DATA / name
        if not path.exists() and name == "won-streaming-catalog.json":
            continue
        raw = load_catalog(path)
        if isinstance(raw, list):
            # density-ceremonies style — skip
            continue
        if not isinstance(raw, dict):
            continue
        for film in raw.get("films") or []:
            if isinstance(film, dict) and film.get("id"):
                out.append((name, raw, film))
    return out


def index_films(
    records: list[tuple[str, dict[str, Any], dict[str, Any]]],
) -> dict[str, tuple[str, dict[str, Any], dict[str, Any]]]:
    by_key: dict[str, tuple[str, dict[str, Any], dict[str, Any]]] = {}
    for name, catalog, film in records:
        fid = str(film["id"])
        by_key[fid] = (name, catalog, film)
        te = (film.get("titleEn") or "").strip().lower()
        if te:
            by_key.setdefault(f"en:{te}", (name, catalog, film))
        tt = (film.get("title") or "").strip().lower()
        if tt:
            by_key.setdefault(f"t:{tt}", (name, catalog, film))
    return by_key


def make_release(day: str, source_url: str, note_extra: str = "") -> dict[str, Any]:
    note = f"Netflix · 地区：{REGION}（What's on Netflix；须以平台官方为准） · 来源 {source_url}"
    if note_extra:
        note = f"{note_extra} · {note}"
    return {
        "platform": PLATFORM,
        "date": day,
        "status": "announced",
        "region": REGION,
        "note": note,
        "source": source_url,
        "sourceLabel": SOURCE_LABEL,
    }


def upsert_release(film: dict[str, Any], release: dict[str, Any]) -> str:
    """Merge release into film.streaming. Returns action: added|updated|skipped."""
    streaming = list(film.get("streaming") or [])
    day = release["date"]
    same_day = [
        i
        for i, r in enumerate(streaming)
        if r.get("platform") == PLATFORM
        and r.get("status") == "announced"
        and r.get("date") == day
    ]
    if same_day:
        # ensure sourceLabel on old WTS/editorial rows when identical day
        i = same_day[0]
        cur = dict(streaming[i])
        changed = False
        if not cur.get("sourceLabel"):
            # keep existing source URL host label preference if already WTS
            src = (cur.get("source") or "") + " " + (release.get("source") or "")
            if "whats-on-netflix" in src:
                cur["sourceLabel"] = SOURCE_LABEL
                changed = True
            elif "whentostream" in (cur.get("source") or ""):
                cur["sourceLabel"] = "When To Stream"
                changed = True
        if changed:
            streaming[i] = cur
            film["streaming"] = streaming
            return "labeled"
        return "skipped"

    other_netflix = [
        i
        for i, r in enumerate(streaming)
        if r.get("platform") == PLATFORM and r.get("status") == "announced" and r.get("date")
    ]
    if other_netflix:
        # WON calendar is authoritative for Netflix US dated drops: replace date
        i = other_netflix[0]
        streaming[i] = release
        # drop duplicate announced netflix rows
        streaming = [
            r
            for j, r in enumerate(streaming)
            if not (j != i and r.get("platform") == PLATFORM and r.get("status") == "announced")
        ]
        film["streaming"] = streaming
        return "updated"

    # drop same-platform estimated/tba without date when promoting to announced
    streaming = [
        r
        for r in streaming
        if not (
            r.get("platform") == PLATFORM
            and r.get("status") in ("estimated", "tba")
            and not r.get("date")
        )
    ]
    streaming.append(release)
    film["streaming"] = streaming
    return "added"


def build_new_film(title_en: str, day: str, source_url: str, year: int | None) -> dict[str, Any]:
    fid = slugify(title_en)
    y = year or int(day[:4])
    return {
        "id": fid,
        "title": title_en,  # EN catalog titles; Chinese copy can enrich later
        "titleEn": title_en,
        "year": y,
        "synopsis": f"{title_en}。流媒体定档来自 What's on Netflix（美国区）。",
        "directors": [],
        "cast": [],
        "genres": ["剧情"],
        "country": ["美国"],
        "posterColors": ["#0f172a", "#1e3a5f"],
        "streaming": [make_release(day, source_url)],
    }


def write_json(path: Path, data: Any) -> None:
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--report", type=Path, default=None)
    ap.add_argument("--calendar-url", default=CALENDAR_URL)
    args = ap.parse_args()

    last = [0.0]
    log(f"GET {args.calendar_url}")
    try:
        html = http_get(args.calendar_url, last)
    except urllib.error.URLError as e:
        log(f"error: fetch failed: {e}")
        return 2

    raw_movies = parse_calendar_movies(html)
    log(f"json-ld Movie nodes: {len(raw_movies)}")

    confirmed: list[dict[str, Any]] = []
    skip_counts: dict[str, int] = {}
    for item in raw_movies:
        reason = should_skip_movie(item)
        if reason:
            skip_counts[reason] = skip_counts.get(reason, 0) + 1
            continue
        name = unescape(str(item["name"])).strip()
        day = str(item["datePublished"])
        year = item.get("copyrightYear")
        try:
            year_i = int(year) if year is not None else int(day[:4])
        except (TypeError, ValueError):
            year_i = int(day[:4])
        confirmed.append(
            {
                "titleEn": name,
                "date": day,
                "year": year_i,
                "netflixUrl": item.get("url"),
                "description": unescape(str(item.get("description") or "")),
                "image": item.get("image"),
            }
        )

    # dedupe by titleEn|date
    uniq: dict[str, dict[str, Any]] = {}
    for row in confirmed:
        key = f"{row['titleEn'].lower()}|{row['date']}"
        uniq[key] = row
    confirmed = sorted(uniq.values(), key=lambda r: (r["date"], r["titleEn"].lower()))
    log(f"confirmed movies: {len(confirmed)}; skips={skip_counts}")

    records = iter_film_records()
    index = index_films(records)

    # ensure won catalog object
    won_path = DATA / "won-streaming-catalog.json"
    won = load_catalog(won_path) if won_path.exists() else {"films": [], "ceremonies": []}
    if "films" not in won:
        won["films"] = []
    if "ceremonies" not in won:
        won["ceremonies"] = []

    dirty: set[str] = set()
    report = {
        "fetched_at": time.strftime("%Y-%m-%dT%H:%M:%S%z"),
        "calendar_url": args.calendar_url,
        "confirmed": len(confirmed),
        "skips": skip_counts,
        "added_new": [],
        "updated_existing": [],
        "labeled_existing": [],
        "skipped_dup": [],
        "actions": {},
    }

    for row in confirmed:
        title_en = row["titleEn"]
        day = row["date"]
        fid = slugify(title_en)
        source_url = args.calendar_url
        release = make_release(day, source_url)

        hit = (
            index.get(fid)
            or index.get(f"en:{title_en.lower()}")
            or index.get(f"t:{title_en.lower()}")
        )
        if hit:
            fname, catalog, film = hit
            action = upsert_release(film, release)
            report["actions"][fid] = action
            if action == "skipped":
                report["skipped_dup"].append({"id": film["id"], "date": day, "file": fname})
            elif action == "labeled":
                dirty.add(fname)
                report["labeled_existing"].append({"id": film["id"], "date": day, "file": fname})
            else:
                dirty.add(fname)
                report["updated_existing"].append(
                    {"id": film["id"], "date": day, "file": fname, "action": action}
                )
            continue

        # new film → won catalog
        film = build_new_film(title_en, day, source_url, row.get("year"))
        # collision on id with different title?
        if any(f.get("id") == film["id"] for f in won["films"]):
            # merge into existing won film
            existing = next(f for f in won["films"] if f["id"] == film["id"])
            action = upsert_release(existing, release)
            report["actions"][film["id"]] = action
            dirty.add("won-streaming-catalog.json")
            if action in ("added", "updated", "labeled"):
                report["updated_existing"].append(
                    {"id": film["id"], "date": day, "file": "won-streaming-catalog.json", "action": action}
                )
            else:
                report["skipped_dup"].append(
                    {"id": film["id"], "date": day, "file": "won-streaming-catalog.json"}
                )
        else:
            won["films"].append(film)
            dirty.add("won-streaming-catalog.json")
            index[film["id"]] = ("won-streaming-catalog.json", won, film)
            index[f"en:{title_en.lower()}"] = ("won-streaming-catalog.json", won, film)
            report["added_new"].append(film["id"])
            report["actions"][film["id"]] = "added_new"

    if not args.dry_run:
        # write dirty catalogs
        # always refresh won catalog (may be new)
        write_json(won_path, won)
        for fname in sorted(dirty):
            if fname == "won-streaming-catalog.json":
                continue
            # find catalog object from records
            cat_obj = None
            for name, catalog, _film in records:
                if name == fname:
                    cat_obj = catalog
                    break
            if cat_obj is None:
                log(f"warn: missing catalog object for {fname}")
                continue
            write_json(DATA / fname, cat_obj)
        log(f"wrote won catalog ({len(won['films'])} films); dirty={sorted(dirty)}")
    else:
        log(f"dry-run; would dirty={sorted(dirty)}; new={len(report['added_new'])}")

    report["won_catalog_size"] = len(won["films"])
    report["dirty_files"] = sorted(dirty)

    if args.report:
        write_json(args.report, report)
        log(f"report → {args.report}")
    else:
        print(json.dumps({k: report[k] for k in ("confirmed", "skips", "added_new", "updated_existing", "skipped_dup", "won_catalog_size", "dirty_files")}, ensure_ascii=False, indent=2))

    return 0


if __name__ == "__main__":
    sys.exit(main())

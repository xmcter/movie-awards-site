#!/usr/bin/env python3
"""Fetch What's on Netflix US coming-soon calendar and ingest confirmed movie dates.

Public calendar page + JSON-LD ItemList (Movie with datePublished).
robots.txt only disallows wp-admin / search; identify UA; sleep >= 1.2s between GETs.

Usage (from repo root):
  python3 scripts/fetch_whatson_netflix.py
  python3 scripts/fetch_whatson_netflix.py --dry-run
  python3 scripts/fetch_whatson_netflix.py --report /tmp/won-report.json

Posters: JSON-LD image is downloaded into public/posters/ with the same
Content-Type and file-header checks as scripts/fetch_motn_upcoming.py.
Failure keeps the remote URL and is listed in the report. No image is
poster_no_image. --no-localize-posters skips the download.
WON_LOCALIZE_POSTERS=0 also turns localization off. The CLI flag wins.
Dry-run does not download and does not write catalogs; it lists
poster_would_download.

Writes/updates:
  src/data/won-streaming-catalog.json  (new Netflix films)
  may patch streaming[] on existing catalog films (same titleEn / title)
  public/posters/{id}.{jpg|png|webp} when poster localization is on
Does NOT wipe When To Stream far-window entries on other platforms.
Does NOT replace an existing announced date on the same platform when the
WON date differs; that case is report["date_conflicts"] for a person to confirm.
A slug that already belongs to a different title is report["slug_collisions"]
and is not inserted.
"""
from __future__ import annotations

import argparse
import json
import os
import re
import sys
import time
import urllib.error
import urllib.request
from datetime import date, datetime
from html import unescape
from pathlib import Path
from typing import Any
from zoneinfo import ZoneInfo

# Same directory. `python3 scripts/fetch_whatson_netflix.py` puts scripts/ on path.
_SCRIPTS = Path(__file__).resolve().parent
if str(_SCRIPTS) not in sys.path:
    sys.path.insert(0, str(_SCRIPTS))

from fetch_motn_upcoming import (  # noqa: E402
    PosterOutcome,
    apply_film_copy,
    localize_remote_poster,
    local_poster_public_path,
    record_poster,
    set_copy_pending,
    title_zh_for,
)

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "src" / "data"
CALENDAR_URL = "https://www.whats-on-netflix.com/coming-soon/calendar/"
UA = "ReadCineBot/1.0 (+https://news.readcine.com; contact=tonyecter@gmail.com)"
MIN_INTERVAL_S = 1.2
SOURCE_LABEL = "Netflix上新日历"
REGION = "美国"
PLATFORM = "netflix"
# Title match stays on the streaming catalogs. films.json is a list and was
# never part of that index; it is included only in the slug id scan.
CATALOG_FILES = [
    "major-awards.json",
    "more-catalog.json",
    "extra-catalog.json",
    "density-pack.json",
    "wts-streaming-catalog.json",
    "won-streaming-catalog.json",
    "motn-streaming-catalog.json",
]
# Slug check is every film id, including films.json and movie-peek.
ID_SCAN_FILES = ["films.json", *CATALOG_FILES, "movie-peek-catalog.json"]
# First fetch plus 3 retries. Backoff is applied only after an empty result.
EMPTY_ATTEMPTS = 4
EMPTY_BACKOFF_S = (2.0, 4.0, 8.0)

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
# Old build_new_film boilerplate. Not a plot.
TEMPLATE_SYNOPSIS_RE = re.compile(
    r"^.+。流媒体定档来自 What's on Netflix（美国区）。$"
)
# JSON-LD description tokens that are distribution notes, not genres.
_GENRE_RULES: tuple[tuple[str, str], ...] = (
    (r"(?i)\bromantic\s+comed(?:y|ies)\b|\brom-?com\b", "爱情"),
    (r"(?i)\bcomed(?:y|ies)\b|喜剧", "喜剧"),
    (r"(?i)\bromance\b|\bromantic\b|爱情|浪漫", "爱情"),
    (r"(?i)\bhorror\b|恐怖", "恐怖"),
    (r"(?i)\bthriller\b|惊悚", "惊悚"),
    (r"(?i)\bcrime\b|犯罪", "犯罪"),
    (r"(?i)\bmystery\b|悬疑", "悬疑"),
    (r"(?i)\baction\b|动作", "动作"),
    (r"(?i)\badventure\b|冒险", "冒险"),
    (r"(?i)\banimation\b|\banimated\b|动画", "动画"),
    (r"(?i)\bfamily\b|家庭", "家庭"),
    (r"(?i)\bfantasy\b|奇幻", "奇幻"),
    (r"(?i)\bsci-?fi\b|\bscience\s+fiction\b|科幻", "科幻"),
    (r"(?i)\bdocumentary\b|纪录片", "纪录片"),
    (r"(?i)\bwar\b|战争", "战争"),
    (r"(?i)\bwestern\b|西部", "西部"),
    (r"(?i)\bmusical\b|\bmusic\b|音乐", "音乐"),
    (r"(?i)\bbiograph(?:y|ical)\b|传记", "传记"),
    (r"(?i)\bsport\b|运动", "运动"),
    (r"(?i)\bhistor(?:y|ical)\b|历史", "历史"),
    (r"(?i)\bdrama\b|剧情", "剧情"),
)


def log(msg: str) -> None:
    print(msg, flush=True)


def slugify(title: str) -> str:
    s = title.lower().strip()
    s = re.sub(r"['’]", "", s)
    s = re.sub(r"[^a-z0-9]+", "-", s)
    return s.strip("-") or "untitled"


def norm_title(value: str) -> str:
    return re.sub(r"\s+", " ", (value or "").strip().lower())


def titles_equal(film: dict[str, Any], title_en: str) -> bool:
    incoming = norm_title(title_en)
    if not incoming:
        return False
    return incoming in {
        norm_title(str(film.get("titleEn") or "")),
        norm_title(str(film.get("title") or "")),
    }


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


def env_localize_posters() -> bool:
    """Download posters unless WON_LOCALIZE_POSTERS is an explicit off."""
    raw = (os.environ.get("WON_LOCALIZE_POSTERS") or "").strip().lower()
    return raw not in {"0", "false", "no", "off"}


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


def parse_card_kinds(html: str) -> dict[str, str]:
    """Card kind by normalized title, from <article data-release-kind/title>.

    JSON-LD descriptions are often only "Licensed"/"Netflix Original", so a
    documentary such as "an open field" (2026-12-01) passes the DOC_RE check
    while its card says data-release-kind="doc". The card kind is
    authoritative for doc/series; 'other' (stand-up) is left alone.
    """
    kinds: dict[str, str] = {}
    for tag in re.findall(r"<article\b[^>]*>", html, flags=re.I):
        kind_m = re.search(r'data-release-kind="([^"]+)"', tag)
        title_m = re.search(r'data-release-title="([^"]+)"', tag)
        if not kind_m or not title_m:
            continue
        title = norm_title(unescape(title_m.group(1)))
        if title and title not in kinds:
            kinds[title] = kind_m.group(1).strip().lower()
    return kinds


def is_real_date(s: str) -> bool:
    if not DATE_RE.match(s):
        return False
    try:
        date.fromisoformat(s)
        return True
    except ValueError:
        return False


def min_new_film_year(ref_year: int | None = None) -> int:
    """Align with news timeline / peek: keep copyrightYear >= calendar_year - 2."""
    y = ref_year if ref_year is not None else datetime.now().year
    return y - 2


def should_skip_movie(item: dict[str, Any], kinds: dict[str, str] | None = None) -> str | None:
    name = unescape(str(item.get("name") or "")).strip()
    desc = unescape(str(item.get("description") or "")).strip()
    blob = f"{name} {desc}"
    if not name:
        return "empty_title"
    if ROUNDUP_RE.search(name):
        return "roundup"
    if kinds:
        kind = kinds.get(norm_title(name))
        if kind == "doc":
            return "documentary"
        if kind == "series":
            return "series"
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
    year_raw = item.get("copyrightYear")
    try:
        year_i = int(year_raw) if year_raw is not None else None
    except (TypeError, ValueError):
        year_i = None
    if year_i is not None and year_i < min_new_film_year():
        return "old_film_catalog_add"
    return None


def infer_genres(description: str) -> list[str]:
    """Genres named in the JSON-LD description. Empty when the text has none.

    The live calendar descriptions are often only "Licensed" or
    "Netflix Original". Those yield [] — do not substitute ["剧情"].
    """
    text = description or ""
    found: list[str] = []
    for pattern, label in _GENRE_RULES:
        if label in found:
            continue
        if re.search(pattern, text):
            found.append(label)
    return found[:6]


def image_url(image: Any) -> str | None:
    """https URL from a JSON-LD image string, ImageObject, or list."""
    if isinstance(image, str):
        url = image.strip()
        return url if url.startswith("https://") else None
    if isinstance(image, list):
        for item in image:
            found = image_url(item)
            if found:
                return found
        return None
    if isinstance(image, dict):
        for key in ("url", "contentUrl", "src"):
            found = image_url(image.get(key))
            if found:
                return found
    return None


def is_placeholder_won(film: dict[str, Any]) -> bool:
    """Rows still carrying the old fabricated synopsis and default genre."""
    synopsis = str(film.get("synopsis") or "").strip()
    if not TEMPLATE_SYNOPSIS_RE.match(synopsis):
        return False
    return film.get("genres") == ["剧情"]


def repair_placeholder_film(film: dict[str, Any], description: str) -> bool:
    """Drop the boilerplate plot and the hardcoded 剧情. Keep hand-edited rows."""
    if not is_placeholder_won(film):
        return False
    title_en = str(film.get("titleEn") or film.get("title") or "")
    zh = title_zh_for(title_en)
    if zh != title_en:
        film["title"] = zh
    film["genres"] = infer_genres(description)
    film["synopsis"] = ""
    apply_film_copy(film)
    set_copy_pending(film)
    return True


def load_catalog(path: Path) -> Any:
    if not path.exists():
        if path.name == "won-streaming-catalog.json":
            return {"films": [], "ceremonies": []}
        raise FileNotFoundError(path)
    return json.loads(path.read_text(encoding="utf-8"))


def film_rows(raw: Any) -> list[dict[str, Any]]:
    """Film dicts from a {films: []} catalog or from films.json (a list)."""
    if isinstance(raw, list):
        items = raw
    elif isinstance(raw, dict):
        items = raw.get("films") or []
    else:
        return []
    out: list[dict[str, Any]] = []
    for film in items:
        if isinstance(film, dict) and film.get("id") and film.get("title"):
            out.append(film)
    return out


def iter_named_films(
    names: list[str],
) -> tuple[list[tuple[str, Any, dict[str, Any]]], dict[str, Any]]:
    """Load catalogs once. Returns film rows and the catalog object by filename."""
    out: list[tuple[str, Any, dict[str, Any]]] = []
    catalogs: dict[str, Any] = {}
    for name in names:
        path = DATA / name
        if not path.exists():
            if name == "won-streaming-catalog.json":
                raw = {"films": [], "ceremonies": []}
            else:
                continue
        else:
            raw = load_catalog(path)
        catalogs[name] = raw
        for film in film_rows(raw):
            out.append((name, raw, film))
    return out, catalogs


def iter_film_records() -> list[tuple[str, Any, dict[str, Any]]]:
    """(filename, catalog_obj, film) for the streaming catalogs."""
    rows, _catalogs = iter_named_films(CATALOG_FILES)
    return rows


def iter_all_film_ids(
    shared: list[tuple[str, Any, dict[str, Any]]] | None = None,
) -> tuple[dict[str, list[tuple[str, dict[str, Any]]]], dict[str, Any]]:
    """Every catalog film id. Reuses objects already loaded in `shared`.

    The second value is catalog objects for files that were not in `shared`
    (films.json, movie-peek). Callers write those if a same-title id hit
    updates them.
    """
    by_id: dict[str, list[tuple[str, dict[str, Any]]]] = {}
    if shared:
        for name, _catalog, film in shared:
            by_id.setdefault(str(film["id"]), []).append((name, film))
    present = {name for name, _catalog, _film in (shared or [])}
    extras: dict[str, Any] = {}
    for name in ID_SCAN_FILES:
        if name in present:
            continue
        path = DATA / name
        if not path.exists():
            continue
        raw = load_catalog(path)
        extras[name] = raw
        for film in film_rows(raw):
            by_id.setdefault(str(film["id"]), []).append((name, film))
    return by_id, extras


def index_films(
    records: list[tuple[str, Any, dict[str, Any]]],
) -> dict[str, tuple[str, Any, dict[str, Any]]]:
    """Title indexes only. Bare id is not a same-film match (see slug check)."""
    by_key: dict[str, tuple[str, Any, dict[str, Any]]] = {}
    for name, catalog, film in records:
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
        "publishedAt": datetime.now(ZoneInfo("Asia/Shanghai")).isoformat(timespec="seconds"),
        "platform": PLATFORM,
        "date": day,
        "status": "announced",
        "region": REGION,
        "note": note,
        "source": source_url,
        "sourceLabel": SOURCE_LABEL,
    }


def upsert_release(film: dict[str, Any], release: dict[str, Any]) -> str:
    """Merge release into film.streaming.

    Returns added|updated|labeled|skipped|date_conflict.
    date_conflict keeps the already stored announced date and does not write.
    """
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
                cur["sourceLabel"] = "定档追踪"
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
        # Stored announced dates were already checked in. WON does not replace
        # them when the calendar day differs; main() records date_conflicts.
        return "date_conflict"

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


def build_new_film(
    title_en: str,
    day: str,
    source_url: str,
    year: int | None,
    description: str = "",
) -> dict[str, Any]:
    """New WON film. Genres come from the JSON-LD description or stay empty.

    Synopsis is not a made-up Chinese plot. copyPending lists what still needs
    a person: title (no Han characters) and/or synopsis. Known Chinese titles
    come from KNOWN_TITLE_ZH; film-copy.json overrides that.
    Poster is applied by the caller from the JSON-LD image, not here.
    """
    fid = slugify(title_en)
    y = year or int(day[:4])
    film: dict[str, Any] = {
        "id": fid,
        "title": title_zh_for(title_en),
        "titleEn": title_en,
        "year": y,
        "synopsis": "",
        "directors": [],
        "cast": [],
        "genres": infer_genres(description),
        "country": ["美国"],
        "posterColors": ["#0f172a", "#1e3a5f"],
        "streaming": [make_release(day, source_url)],
    }
    apply_film_copy(film)
    set_copy_pending(film)
    return film


def write_json(path: Path, data: Any) -> None:
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def collect_confirmed(html: str) -> tuple[list[dict[str, Any]], dict[str, int], int]:
    raw_movies = parse_calendar_movies(html)
    kinds = parse_card_kinds(html)
    confirmed: list[dict[str, Any]] = []
    skip_counts: dict[str, int] = {}
    for item in raw_movies:
        reason = should_skip_movie(item, kinds)
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
    uniq: dict[str, dict[str, Any]] = {}
    for row in confirmed:
        key = f"{row['titleEn'].lower()}|{row['date']}"
        uniq[key] = row
    confirmed = sorted(uniq.values(), key=lambda r: (r["date"], r["titleEn"].lower()))
    return confirmed, skip_counts, len(raw_movies)


def fetch_confirmed(url: str, last: list[float]) -> tuple[list[dict[str, Any]], dict[str, int], int]:
    """GET the calendar. Retry when confirmed is empty or the GET fails.

    Returns (confirmed, skips, raw_movie_count). Raises URLError if every
    attempt fails to fetch. An empty confirmed list after the retries is a
    successful fetch of an unusable page; main() exits non-zero and does not
    write catalogs.
    """
    last_error: Exception | None = None
    for attempt in range(1, EMPTY_ATTEMPTS + 1):
        try:
            html = http_get(url, last)
        except urllib.error.URLError as e:
            last_error = e
            log(f"warn: fetch failed (attempt {attempt}/{EMPTY_ATTEMPTS}): {e}")
            if attempt == EMPTY_ATTEMPTS:
                raise
            delay = EMPTY_BACKOFF_S[min(attempt - 1, len(EMPTY_BACKOFF_S) - 1)]
            log(f"retry in {delay:.0f}s")
            time.sleep(delay)
            continue
        confirmed, skips, raw_n = collect_confirmed(html)
        log(
            f"json-ld Movie nodes: {raw_n}; confirmed movies: {len(confirmed)}; "
            f"skips={skips} (attempt {attempt}/{EMPTY_ATTEMPTS})"
        )
        if confirmed:
            return confirmed, skips, raw_n
        log(f"warn: 0 confirmed movies (attempt {attempt}/{EMPTY_ATTEMPTS})")
        if attempt == EMPTY_ATTEMPTS:
            return confirmed, skips, raw_n
        delay = EMPTY_BACKOFF_S[min(attempt - 1, len(EMPTY_BACKOFF_S) - 1)]
        log(f"retry in {delay:.0f}s")
        time.sleep(delay)
    if last_error:
        raise urllib.error.URLError(str(last_error))
    return [], {}, 0


def announced_netflix_dates(film: dict[str, Any]) -> list[str]:
    dates: list[str] = []
    for rel in film.get("streaming") or []:
        if (
            rel.get("platform") == PLATFORM
            and rel.get("status") == "announced"
            and rel.get("date")
            and rel["date"] not in dates
        ):
            dates.append(rel["date"])
    return dates


def slug_conflict_rows(
    fid: str,
    title_en: str,
    id_index: dict[str, list[tuple[str, dict[str, Any]]]],
) -> list[dict[str, Any]]:
    """Existing ids equal to this slug whose title is not the incoming title."""
    rows: list[dict[str, Any]] = []
    for fname, film in id_index.get(fid, []):
        if titles_equal(film, title_en):
            continue
        rows.append(
            {
                "id": fid,
                "incoming_title": title_en,
                "existing_title": film.get("title"),
                "existing_titleEn": film.get("titleEn"),
                "file": fname,
            }
        )
    return rows


def same_title_id_hit(
    fid: str,
    title_en: str,
    id_index: dict[str, list[tuple[str, dict[str, Any]]]],
) -> tuple[str, dict[str, Any]] | None:
    for fname, film in id_index.get(fid, []):
        if titles_equal(film, title_en):
            return fname, film
    return None


def apply_row_poster(
    film: dict[str, Any],
    image: Any,
    *,
    localize: bool,
    dry_run: bool,
    report: dict[str, Any],
    seen: set[str],
    title: str,
    last: list[float],
) -> bool:
    """Set film['poster'] when it is missing. True when the film dict changed.

    Dry-run records poster_would_download and does not fetch bytes. A poster
    already on disk is attached in both modes (no download).
    """
    if film.get("poster"):
        return False
    fid = str(film["id"])
    url = image_url(image)
    if dry_run:
        if fid in seen:
            return False
        if not url:
            record_poster(report, seen, fid, title, PosterOutcome("no_image", None, None))
            return False
        existing = local_poster_public_path(fid)
        if existing:
            record_poster(report, seen, fid, title, PosterOutcome("localized", existing, None))
            film["poster"] = existing
            return True
        seen.add(fid)
        report["poster_would_download"].append({"id": fid, "title": title, "url": url})
        # Catalog would gain a poster. Dry-run does not write the file.
        return True

    if url and localize and not local_poster_public_path(fid):
        sleep_polite(last)
    outcome = localize_remote_poster(fid, url, localize=localize)
    if not isinstance(outcome, PosterOutcome):
        return False
    record_poster(report, seen, fid, title, outcome)
    if not outcome.stored:
        return False
    film["poster"] = outcome.stored
    return True


def remember_film(
    index: dict[str, tuple[str, Any, dict[str, Any]]],
    id_index: dict[str, list[tuple[str, dict[str, Any]]]],
    fname: str,
    catalog: Any,
    film: dict[str, Any],
) -> None:
    fid = str(film["id"])
    id_index.setdefault(fid, []).append((fname, film))
    te = (film.get("titleEn") or "").strip().lower()
    if te:
        index.setdefault(f"en:{te}", (fname, catalog, film))
    tt = (film.get("title") or "").strip().lower()
    if tt:
        index.setdefault(f"t:{tt}", (fname, catalog, film))


def note_streaming_action(
    report: dict[str, Any],
    dirty: set[str],
    fname: str,
    film: dict[str, Any],
    day: str,
    action: str,
) -> None:
    report["actions"][str(film["id"])] = action
    if action == "skipped":
        report["skipped_dup"].append({"id": film["id"], "date": day, "file": fname})
        return
    if action == "date_conflict":
        report["date_conflicts"].append(
            {
                "id": film["id"],
                "title": film.get("title"),
                "titleEn": film.get("titleEn"),
                "file": fname,
                "platform": PLATFORM,
                "existing_dates": announced_netflix_dates(film),
                "won_date": day,
            }
        )
        return
    dirty.add(fname)
    if action == "labeled":
        report["labeled_existing"].append({"id": film["id"], "date": day, "file": fname})
        return
    report["updated_existing"].append(
        {"id": film["id"], "date": day, "file": fname, "action": action}
    )


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--report", type=Path, default=None)
    ap.add_argument("--calendar-url", default=CALENDAR_URL)
    ap.add_argument(
        "--localize-posters",
        action=argparse.BooleanOptionalAction,
        default=env_localize_posters(),
        help=(
            "Download posters into public/posters/ and store /posters/{id}.{ext}. "
            "Default is on. WON_LOCALIZE_POSTERS=0 turns this off. "
            "--no-localize-posters forces remote URLs (overrides the env var)."
        ),
    )
    args = ap.parse_args()
    localize = bool(args.localize_posters)
    log(
        "posters: "
        + (
            "localize to public/posters/"
            if localize
            else "remote URLs (no download)"
        )
        + (" (dry-run, no download)" if args.dry_run else "")
    )

    last = [0.0]
    log(f"GET {args.calendar_url}")
    try:
        confirmed, skip_counts, _raw_n = fetch_confirmed(args.calendar_url, last)
    except urllib.error.URLError as e:
        log(f"error: fetch failed: {e}")
        return 2

    if not confirmed:
        log(
            "error: 0 confirmed movies after "
            f"{EMPTY_ATTEMPTS} attempts; not writing catalogs"
        )
        report = {
            "fetched_at": time.strftime("%Y-%m-%dT%H:%M:%S%z"),
            "calendar_url": args.calendar_url,
            "confirmed": 0,
            "skips": skip_counts,
            "error": "zero_confirmed",
            "attempts": EMPTY_ATTEMPTS,
        }
        if args.report:
            write_json(args.report, report)
            log(f"report → {args.report}")
        return 1

    records = iter_film_records()
    index = index_films(records)
    id_index, extra_catalogs = iter_all_film_ids(records)

    won_path = DATA / "won-streaming-catalog.json"
    # Reuse the object records already holds. A second json.loads is a
    # different dict; writing that copy drops poster edits made via the index.
    won: dict[str, Any] | None = None
    for name, catalog, _film in records:
        if name == "won-streaming-catalog.json" and isinstance(catalog, dict):
            won = catalog
            break
    if won is None:
        won = load_catalog(won_path) if won_path.exists() else {"films": [], "ceremonies": []}
    if not isinstance(won, dict):
        won = {"films": [], "ceremonies": []}
    if not isinstance(won.get("films"), list):
        won["films"] = []
    if "ceremonies" not in won:
        won["ceremonies"] = []

    dirty: set[str] = set()
    report: dict[str, Any] = {
        "fetched_at": time.strftime("%Y-%m-%dT%H:%M:%S%z"),
        "calendar_url": args.calendar_url,
        "confirmed": len(confirmed),
        "skips": skip_counts,
        "added_new": [],
        "updated_existing": [],
        "labeled_existing": [],
        "skipped_dup": [],
        "date_conflicts": [],
        "slug_collisions": [],
        "copy_pending_marked": [],
        "actions": {},
        "localize_posters": localize,
        "dry_run": bool(args.dry_run),
        "poster_no_image": [],
        "poster_download_failed": [],
        "poster_localized": [],
        "poster_remote": [],
        "poster_would_download": [],
    }
    poster_seen: set[str] = set()
    repaired: set[str] = set()

    def maybe_repair(fname: str, film: dict[str, Any], description: str) -> None:
        if fname != "won-streaming-catalog.json":
            return
        fid = str(film["id"])
        if fid in repaired:
            return
        if not repair_placeholder_film(film, description):
            return
        repaired.add(fid)
        dirty.add(fname)
        report["copy_pending_marked"].append(
            {
                "id": fid,
                "title": film.get("title"),
                "genres": film.get("genres"),
                "copyPending": film.get("copyPending"),
            }
        )

    for row in confirmed:
        title_en = row["titleEn"]
        day = row["date"]
        fid = slugify(title_en)
        source_url = args.calendar_url
        release = make_release(day, source_url)
        description = str(row.get("description") or "")

        hit = index.get(f"en:{title_en.lower()}") or index.get(f"t:{title_en.lower()}")
        if hit is None:
            id_same = same_title_id_hit(fid, title_en, id_index)
            if id_same is not None:
                fname, film = id_same
                catalog_obj: Any = extra_catalogs.get(fname)
                if catalog_obj is None:
                    for name, catalog, candidate in records:
                        if name == fname and candidate is film:
                            catalog_obj = catalog
                            break
                if catalog_obj is None and fname == "won-streaming-catalog.json":
                    catalog_obj = won
                hit = (fname, catalog_obj, film)

        if hit:
            fname, _catalog, film = hit
            if apply_row_poster(
                film,
                row.get("image"),
                localize=localize,
                dry_run=bool(args.dry_run),
                report=report,
                seen=poster_seen,
                title=title_en,
                last=last,
            ):
                dirty.add(fname)
            maybe_repair(fname, film, description)
            action = upsert_release(film, release)
            note_streaming_action(report, dirty, fname, film, day, action)
            continue

        conflicts = slug_conflict_rows(fid, title_en, id_index)
        if conflicts:
            report["slug_collisions"].extend(conflicts)
            report["actions"][fid] = "slug_collision"
            log(f"slug collision, not inserted: {fid} ({title_en})")
            continue

        film = build_new_film(title_en, day, source_url, row.get("year"), description)
        won["films"].append(film)
        dirty.add("won-streaming-catalog.json")
        remember_film(index, id_index, "won-streaming-catalog.json", won, film)
        records.append(("won-streaming-catalog.json", won, film))
        if apply_row_poster(
            film,
            row.get("image"),
            localize=localize,
            dry_run=bool(args.dry_run),
            report=report,
            seen=poster_seen,
            title=title_en,
            last=last,
        ):
            dirty.add("won-streaming-catalog.json")
        report["added_new"].append(film["id"])
        report["actions"][film["id"]] = "added_new"
        if film.get("copyPending"):
            report["copy_pending_marked"].append(
                {
                    "id": film["id"],
                    "title": film.get("title"),
                    "genres": film.get("genres"),
                    "copyPending": film.get("copyPending"),
                    "new": True,
                }
            )

    # Placeholder rows that have rolled off the calendar still carry the
    # fabricated synopsis. Clear those too. No description, so genres stay [].
    for film in won["films"]:
        if not isinstance(film, dict) or not film.get("id"):
            continue
        fid = str(film["id"])
        if fid in repaired:
            continue
        if not repair_placeholder_film(film, ""):
            continue
        repaired.add(fid)
        dirty.add("won-streaming-catalog.json")
        report["copy_pending_marked"].append(
            {
                "id": fid,
                "title": film.get("title"),
                "genres": film.get("genres"),
                "copyPending": film.get("copyPending"),
                "off_calendar": True,
            }
        )

    if not args.dry_run:
        write_json(won_path, won)
        catalog_objs: dict[str, Any] = dict(extra_catalogs)
        for name, catalog, _film in records:
            catalog_objs[name] = catalog
        catalog_objs["won-streaming-catalog.json"] = won
        for fname in sorted(dirty):
            if fname == "won-streaming-catalog.json":
                continue
            cat_obj = catalog_objs.get(fname)
            if cat_obj is None:
                log(f"warn: missing catalog object for {fname}")
                continue
            write_json(DATA / fname, cat_obj)
        log(f"wrote won catalog ({len(won['films'])} films); dirty={sorted(dirty)}")
    else:
        log(f"dry-run; would dirty={sorted(dirty)}; new={len(report['added_new'])}")

    report["won_catalog_size"] = len(won["films"])
    report["dirty_files"] = sorted(dirty)
    log(
        "posters "
        f"localized={len(report['poster_localized'])} "
        f"remote={len(report['poster_remote'])} "
        f"no_image={len(report['poster_no_image'])} "
        f"download_failed={len(report['poster_download_failed'])} "
        f"would_download={len(report['poster_would_download'])}"
    )
    log(
        "review "
        f"date_conflicts={len(report['date_conflicts'])} "
        f"slug_collisions={len(report['slug_collisions'])} "
        f"copy_pending={len(report['copy_pending_marked'])}"
    )

    if args.report:
        write_json(args.report, report)
        log(f"report → {args.report}")
    else:
        summary = {
            k: report[k]
            for k in (
                "confirmed",
                "skips",
                "added_new",
                "updated_existing",
                "skipped_dup",
                "date_conflicts",
                "slug_collisions",
                "copy_pending_marked",
                "won_catalog_size",
                "dirty_files",
                "poster_no_image",
                "poster_download_failed",
                "poster_localized",
                "poster_remote",
                "poster_would_download",
            )
        }
        summary["skipped_dup"] = len(report["skipped_dup"])
        summary["date_conflicts"] = report["date_conflicts"]
        summary["slug_collisions"] = report["slug_collisions"]
        summary["copy_pending_marked"] = len(report["copy_pending_marked"])
        print(json.dumps(summary, ensure_ascii=False, indent=2))

    return 0


if __name__ == "__main__":
    sys.exit(main())

#!/usr/bin/env python3
"""Fetch Movie of the Night / Streaming Availability upcoming US movies and ingest.

API: GET https://api.movieofthenight.com/v4/changes
Docs: https://docs.movieofthenight.com/resource/changes

Auth: env MOTN_API_KEY (required). Optional MOTN_KEY_FILE or --key-file as fallback
(local box only; never commit the key).

Usage (from repo root):
  MOTN_API_KEY=... python3 scripts/fetch_motn_upcoming.py
  MOTN_API_KEY=... python3 scripts/fetch_motn_upcoming.py --dry-run
  MOTN_API_KEY=... python3 scripts/fetch_motn_upcoming.py --report /tmp/motn-report.json

Posters are downloaded into public/posters/ by default and stored as
/posters/{id}.jpg (or .png / .webp when that is the real format).
--no-localize-posters keeps the remote MotN URL and skips the download.
MOTN_LOCALIZE_POSTERS=0 also turns localization off. The CLI flag wins.

Writes/updates:
  src/data/motn-streaming-catalog.json
  may patch streaming[] on existing catalog films (same id / titleEn)
  public/posters/{id}.{jpg|png|webp} when poster localization is on
Does NOT wipe WTS/WON rows; same platform+date+announced is skipped.
"""
from __future__ import annotations

import argparse
import json
import os
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import date, datetime, timezone
from pathlib import Path
from typing import Any, NamedTuple
from zoneinfo import ZoneInfo

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "src" / "data"
API_BASE = "https://api.movieofthenight.com/v4"
UA = "ReadCineBot/1.0 (+https://news.readcine.com; contact=tonyecter@gmail.com)"
SOURCE_LABEL = "片夜定档"
# Upcoming pages are 25 rows. A stuck nextCursor must not loop forever.
MAX_CHANGE_PAGES = 40
POSTER_EXTS = ("jpg", "png", "webp")
# Magic decides the format. 2000 bytes alone is not proof of an image.
MIN_IMAGE_BYTES = 32

# 已知通译 / 意译；入库时 title 优先中文，titleEn 保留英文原名。
KNOWN_TITLE_ZH: dict[str, str] = {
    "another-round": "酒精计划",
    "man-of-iron": "铁人",
    "man-of-marble": "大理石人",
    "peppermint-candy": "薄荷糖",
    "poetry": "诗",
    "oasis": "绿洲",
    "green-fish": "绿鱼",
    "female-perversions": "女性倒错",
    "innocent-sorcerers": "无辜的魔术师",
    "the-promised-land": "应许之地",
    "the-wedding": "婚礼",
    "without-anesthesia": "无麻醉",
    "fear-x": "恐惧X",
    "thirst-street": "欲望街",
    "being-heumann": "成为休曼",
    "barrio-triste": "悲伤街区",
    "taxi-moto": "摩的",
    "in-a-holidaze": "节日迷雾",
    "la-bola-negra": "黑球",
    "the-man-with-the-bag": "提袋人",
    "hot-line": "热线",
    "a-wisconsin-christmas-pie": "威斯康星圣诞派",
    "gianmarco-soresi-thief-of-joy": "詹马尔科·索雷西：快乐窃贼",
    "my-crazy-feminist-girlfriend": "我的疯狂女权女友",
    "tyler-perrys-the-gospel-of-christmas": "泰勒·佩里之圣诞福音",
    "a-prince-in-paradise": "天堂王子",
    "stranger-things-fireplace": "怪奇物语：壁炉",
    "madden": "麦登",
    "perfect-liars": "完美骗子",
    "way-of-the-warrior-kid": "战士小子之道",
    # 开眼电影网译名《艾茲拉》（film-copy 简介同源）；大陆亦见《埃兹拉》。
    "ezra": "艾兹拉",
}


def title_zh_for(title_en: str) -> str:
    """有中文译名用中文；否则暂留英文。

    表外译名不要在这里编造。编辑补进 src/data/film-copy.json（id → title），
    入库时 apply_film_copy 会盖过本表，页面读取时 applyCopy 也会盖过。
    """
    fid = slugify(title_en)
    return KNOWN_TITLE_ZH.get(fid, title_en)


_FILM_COPY: dict[str, Any] | None = None


def film_copy_index() -> dict[str, Any]:
    """Curated overlay. Missing file is an empty map, not an error."""
    global _FILM_COPY
    if _FILM_COPY is None:
        path = DATA / "film-copy.json"
        if path.is_file():
            raw = json.loads(path.read_text(encoding="utf-8"))
            _FILM_COPY = raw if isinstance(raw, dict) else {}
        else:
            _FILM_COPY = {}
    return _FILM_COPY


def apply_film_copy(film: dict[str, Any]) -> None:
    """Fill gaps from film-copy.json. Empty copy values do not wipe API data."""
    extra = film_copy_index().get(str(film.get("id") or ""))
    if not isinstance(extra, dict):
        return
    for key in (
        "title",
        "titleEn",
        "synopsis",
        "background",
        "directors",
        "cast",
        "genres",
        "country",
        "runtime",
    ):
        val = extra.get(key)
        if val in (None, "", [], {}):
            continue
        film[key] = val


def copy_pending_for(film: dict[str, Any]) -> list[str]:
    """title when the stored title has no Han characters; synopsis when it has none.

    English overview is kept for translators and flagged, not replaced with a
    made-up Chinese plot. A Chinese film-copy synopsis clears the synopsis flag.
    """
    pending: list[str] = []
    title = str(film.get("title") or "")
    if not re.search(r"[\u4e00-\u9fff]", title):
        pending.append("title")
    synopsis = str(film.get("synopsis") or "").strip()
    if not re.search(r"[\u4e00-\u9fff]", synopsis):
        pending.append("synopsis")
    return pending


def set_copy_pending(film: dict[str, Any]) -> list[str]:
    pending = copy_pending_for(film)
    if pending:
        film["copyPending"] = pending
    else:
        film.pop("copyPending", None)
    return pending


def string_list(value: Any) -> list[str]:
    """Flatten a string, a list of strings, or a list of {name} objects."""
    raw: list[str] = []
    if isinstance(value, str) and value.strip():
        raw.append(value.strip())
    elif isinstance(value, list):
        for item in value:
            if isinstance(item, str) and item.strip():
                raw.append(item.strip())
            elif isinstance(item, dict):
                name = item.get("name") or item.get("country") or item.get("label")
                if isinstance(name, str) and name.strip():
                    raw.append(name.strip())
    out: list[str] = []
    seen: set[str] = set()
    for item in raw:
        if item in seen:
            continue
        seen.add(item)
        out.append(item)
    return out


def countries_from_show(show: dict[str, Any]) -> list[str]:
    """Production countries from the show payload. Empty when the API omits them.

    The US catalog country (streaming region) is not the film's country.
    Do not substitute ["美国"] when the field is missing.
    """
    for key in (
        "countries",
        "country",
        "originCountries",
        "productionCountries",
        "originCountry",
    ):
        if key in show and show.get(key) not in (None, "", []):
            return string_list(show.get(key))[:6]
    return []

REGION = "美国"
# MotN US catalog ids → site StreamingPlatform
SERVICE_TO_PLATFORM = {
    "netflix": "netflix",
    "disney": "disney-plus",
    "prime": "prime",
    "apple": "apple-tv",
    "hbo": "max",
    "mubi": "mubi",
}
DEFAULT_CATALOGS = ",".join(SERVICE_TO_PLATFORM.keys())
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


def log(msg: str) -> None:
    print(msg, flush=True)


def slugify(title: str) -> str:
    s = title.lower().strip()
    s = re.sub(r"['’]", "", s)
    s = re.sub(r"[^a-z0-9]+", "-", s)
    return s.strip("-") or "untitled"


def resolve_api_key(cli_file: str | None) -> str:
    env = (os.environ.get("MOTN_API_KEY") or "").strip()
    if env:
        return env
    path_s = cli_file or os.environ.get("MOTN_KEY_FILE") or ""
    if path_s:
        p = Path(path_s).expanduser()
        if p.is_file():
            return p.read_text(encoding="utf-8").strip()
    # local box convenience (never commit this path into docs as the only option)
    box = Path("/workspace/motn-api-key.txt")
    if box.is_file():
        return box.read_text(encoding="utf-8").strip()
    raise SystemExit(
        "error: set MOTN_API_KEY (or MOTN_KEY_FILE / --key-file); key not found"
    )


def http_get_json(url: str, api_key: str, *, retries: int = 5) -> dict[str, Any]:
    """GET JSON. 429 sleeps and retries with exponential backoff (honors Retry-After)."""
    delay = 1.0
    attempt = 0
    while True:
        attempt += 1
        req = urllib.request.Request(
            url,
            headers={
                "X-API-Key": api_key,
                "User-Agent": UA,
                "Accept": "application/json",
            },
        )
        try:
            with urllib.request.urlopen(req, timeout=90) as resp:
                return json.loads(resp.read().decode("utf-8", errors="replace"))
        except urllib.error.HTTPError as e:
            if e.code != 429 or attempt >= retries:
                raise
            retry_after = e.headers.get("Retry-After") if e.headers else None
            wait = delay
            if retry_after:
                try:
                    wait = max(float(retry_after), 0.5)
                except ValueError:
                    wait = delay
            wait = min(wait, 60.0)
            try:
                e.read()
            except Exception:
                pass
            log(
                f"HTTP 429 on /changes; backoff {wait:.1f}s "
                f"(attempt {attempt}/{retries})"
            )
            time.sleep(wait)
            delay = min(delay * 2, 30.0)


def ts_to_date(ts: int | float | None) -> str | None:
    if ts is None:
        return None
    try:
        dt = datetime.fromtimestamp(int(ts), tz=timezone.utc)
    except (TypeError, ValueError, OSError, OverflowError):
        return None
    return dt.date().isoformat()


def is_real_date(s: str) -> bool:
    if not DATE_RE.match(s):
        return False
    try:
        date.fromisoformat(s)
        return True
    except ValueError:
        return False


def genre_blob(show: dict[str, Any]) -> str:
    parts: list[str] = []
    for g in show.get("genres") or []:
        if isinstance(g, dict):
            parts.append(str(g.get("id") or ""))
            parts.append(str(g.get("name") or ""))
        else:
            parts.append(str(g))
    parts.append(str(show.get("title") or ""))
    parts.append(str(show.get("overview") or ""))
    return " ".join(parts)


def min_new_film_year(ref_year: int | None = None) -> int:
    """Align with news timeline / peek: keep releaseYear >= calendar_year - 2."""
    y = ref_year if ref_year is not None else datetime.now().year
    return y - 2


def should_skip(change: dict[str, Any], show: dict[str, Any] | None) -> str | None:
    if change.get("changeType") != "upcoming":
        return "not_upcoming"
    if change.get("showType") and change.get("showType") != "movie":
        return "not_movie"
    if change.get("itemType") in ("season", "episode"):
        return "series"
    if change.get("season") is not None or change.get("episode") is not None:
        return "series"
    svc = (change.get("service") or {}).get("id")
    if svc not in SERVICE_TO_PLATFORM:
        return "unsupported_service"
    day = ts_to_date(change.get("timestamp"))
    if not day or not is_real_date(day):
        return "no_confirmed_date"
    if not show:
        return "missing_show"
    if show.get("showType") and show.get("showType") != "movie":
        return "not_movie"
    blob = genre_blob(show)
    if DOC_RE.search(blob) or any(
        (isinstance(g, dict) and str(g.get("id") or "").lower() == "documentary")
        or (isinstance(g, dict) and "documentary" in str(g.get("name") or "").lower())
        for g in (show.get("genres") or [])
    ):
        return "documentary"
    if SERIES_RE.search(blob):
        return "series"
    title = (show.get("title") or show.get("originalTitle") or "").strip()
    if not title:
        return "empty_title"
    year_raw = show.get("releaseYear")
    try:
        year_i = int(year_raw) if year_raw is not None else None
    except (TypeError, ValueError):
        year_i = None
    if year_i is not None and year_i < min_new_film_year():
        return "old_film_catalog_add"
    return None


def load_catalog(path: Path) -> Any:
    if not path.exists():
        if path.name == "motn-streaming-catalog.json":
            return {"films": [], "ceremonies": []}
        raise FileNotFoundError(path)
    return json.loads(path.read_text(encoding="utf-8"))


def iter_film_records() -> list[tuple[str, dict[str, Any], dict[str, Any]]]:
    out: list[tuple[str, dict[str, Any], dict[str, Any]]] = []
    for name in CATALOG_FILES:
        path = DATA / name
        if not path.exists() and name == "motn-streaming-catalog.json":
            continue
        raw = load_catalog(path)
        if isinstance(raw, list) or not isinstance(raw, dict):
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


def platform_label(platform: str) -> str:
    return {
        "netflix": "Netflix",
        "disney-plus": "Disney+",
        "prime": "Prime Video",
        "max": "Max",
        "apple-tv": "Apple TV+",
        "mubi": "MUBI",
    }.get(platform, platform)


def make_release(
    platform: str, day: str, source_url: str, service_name: str
) -> dict[str, Any]:
    note = f"{service_name} {REGION}区定档，以平台官方为准"
    return {
        "publishedAt": datetime.now(ZoneInfo("Asia/Shanghai")).isoformat(timespec="seconds"),
        "platform": platform,
        "date": day,
        "status": "announced",
        "region": REGION,
        "note": note,
        "source": source_url,
        "sourceLabel": SOURCE_LABEL,
    }


def upsert_release(film: dict[str, Any], release: dict[str, Any]) -> str:
    """Merge MotN release. Returns added|labeled|skipped|skipped_existing_platform."""
    streaming = list(film.get("streaming") or [])
    platform = release["platform"]
    day = release["date"]

    same_day = [
        i
        for i, r in enumerate(streaming)
        if r.get("platform") == platform
        and r.get("status") == "announced"
        and r.get("date") == day
    ]
    if same_day:
        i = same_day[0]
        cur = dict(streaming[i])
        if not cur.get("sourceLabel"):
            cur["sourceLabel"] = SOURCE_LABEL
            if not cur.get("source"):
                cur["source"] = release["source"]
            streaming[i] = cur
            film["streaming"] = streaming
            return "labeled"
        return "skipped"

    other_announced = [
        i
        for i, r in enumerate(streaming)
        if r.get("platform") == platform and r.get("status") == "announced" and r.get("date")
    ]
    if other_announced:
        # Do not overwrite WON/WTS dated announced rows with MotN.
        return "skipped_existing_platform"

    streaming = [
        r
        for r in streaming
        if not (
            r.get("platform") == platform
            and r.get("status") in ("estimated", "tba")
            and not r.get("date")
        )
    ]
    streaming.append(release)
    film["streaming"] = streaming
    return "added"



class PosterOutcome(NamedTuple):
    """status is localized | remote | no_image | download_failed.

    stored is the value to write on film.poster (local path, or the remote URL
    when localization is off or the download failed). error is set only for
    download_failed.
    """

    status: str
    stored: str | None
    error: str | None = None


def _https_url(value: Any) -> str | None:
    if isinstance(value, str) and value.startswith("https://"):
        return value
    if isinstance(value, dict):
        for key in ("url", "link", "src"):
            found = _https_url(value.get(key))
            if found:
                return found
    return None


def _best_url_node(node: Any) -> str | None:
    """Largest usable https URL inside a MotN image node.

    The live changes API (checked 2026-11-08) still returns
    verticalPoster.{w240,w360,w480,w600,w720} as https strings. Also accept a
    bare URL, {url: ...} size entries, and width keys outside that set
    (w154/w185/w342/w500/w780 and horizontal w1080/w1440) so a size rename
    does not drop the poster.
    """
    direct = _https_url(node)
    if direct and not isinstance(node, dict):
        return direct
    if not isinstance(node, dict):
        return None
    preferred = (
        "w1440",
        "w1080",
        "w780",
        "w720",
        "w600",
        "w500",
        "w480",
        "w360",
        "w342",
        "w240",
        "w185",
        "w154",
    )
    for size in preferred:
        url = _https_url(node.get(size))
        if url:
            return url
    ranked: list[tuple[int, str]] = []
    for key, value in node.items():
        url = _https_url(value)
        if not url:
            continue
        match = re.fullmatch(r"w(\d+)", str(key))
        ranked.append((int(match.group(1)) if match else 0, url))
    if not ranked:
        return direct
    ranked.sort(reverse=True)
    return ranked[0][1]


def best_vertical_poster(image_set: Any) -> str | None:
    """Pick a poster URL. Prefer verticalPoster, then other imageSet slots.

    Returns None only when imageSet has no https image at all (report: 无图).
    An empty verticalPoster falls through to verticalBackdrop, then horizontal
    poster/backdrop, instead of being treated as "no artwork".
    """
    if not isinstance(image_set, dict):
        return None
    for key in (
        "verticalPoster",
        "verticalBackdrop",
        "horizontalPoster",
        "horizontalBackdrop",
    ):
        url = _best_url_node(image_set.get(key))
        if url:
            return url
    return None


def env_localize_posters() -> bool:
    """Download posters unless MOTN_LOCALIZE_POSTERS is an explicit off.

    Unset, empty, and 1/true/yes/on stay on. 0/false/no/off turns downloads off.
    --localize-posters / --no-localize-posters override this.
    """
    raw = (os.environ.get("MOTN_LOCALIZE_POSTERS") or "").strip().lower()
    return raw not in {"0", "false", "no", "off"}


def sniff_image(data: bytes, content_type: str | None) -> str | None:
    """Return jpeg|png|webp when the file header matches Content-Type.

    A missing or generic Content-Type trusts the magic bytes. image/* that
    names a different format, and any non-image type, is rejected. Size alone
    is not enough.
    """
    if len(data) < MIN_IMAGE_BYTES:
        return None
    if data.startswith(b"\xff\xd8\xff"):
        magic = "jpeg"
    elif data.startswith(b"\x89PNG\r\n\x1a\n"):
        magic = "png"
    elif len(data) >= 12 and data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        magic = "webp"
    else:
        return None
    ct = (content_type or "").split(";")[0].strip().lower()
    if ct in {"", "application/octet-stream", "binary/octet-stream", "application/binary"}:
        return magic
    allowed = {
        "jpeg": {"image/jpeg", "image/jpg", "image/pjpeg"},
        "png": {"image/png"},
        "webp": {"image/webp"},
    }
    if ct not in allowed[magic]:
        return None
    return magic


def _poster_path(film_id: str, ext: str) -> Path:
    return ROOT / "public" / "posters" / f"{film_id}.{ext}"


def _valid_poster_file(path: Path) -> bool:
    ext = path.suffix.lower().lstrip(".")
    expected = {"jpg": "jpeg", "jpeg": "jpeg", "png": "png", "webp": "webp"}.get(ext)
    if not expected:
        return False
    try:
        data = path.read_bytes()
    except OSError:
        return False
    return sniff_image(data, None) == expected


def local_poster_public_path(film_id: str) -> str | None:
    """Public path of an existing valid poster, if one is already on disk."""
    for ext in POSTER_EXTS:
        dest = _poster_path(film_id, ext)
        if dest.is_file() and _valid_poster_file(dest):
            return f"/posters/{dest.name}"
    return None


def discard_corrupt_posters(film_id: str) -> None:
    """Delete on-disk posters whose header does not match the extension."""
    for ext in POSTER_EXTS:
        dest = _poster_path(film_id, ext)
        if not dest.is_file() or _valid_poster_file(dest):
            continue
        log(f"poster corrupt, re-download {dest.name}")
        dest.unlink()


def localize_remote_poster(film_id: str, url: str | None, *, localize: bool) -> PosterOutcome:
    """Download one https poster into public/posters/{id}.{ext}.

    Shared by MotN imageSet URLs and WON JSON-LD image URLs.
    no_image: url missing. remote: localize is off.
    localized: header matches Content-Type; extension follows the real format.
    download_failed: request or bytes failed; stored stays the remote URL.
    A corrupt on-disk file is deleted and fetched again.
    """
    if not url:
        return PosterOutcome("no_image", None, None)
    if not localize:
        return PosterOutcome("remote", url, None)
    out_dir = ROOT / "public" / "posters"
    out_dir.mkdir(parents=True, exist_ok=True)
    discard_corrupt_posters(film_id)
    existing = local_poster_public_path(film_id)
    if existing:
        return PosterOutcome("localized", existing, None)
    try:
        req = urllib.request.Request(
            url,
            headers={"User-Agent": UA, "Accept": "image/jpeg,image/png,image/webp,image/*"},
        )
        with urllib.request.urlopen(req, timeout=60) as resp:
            content_type = resp.headers.get("Content-Type")
            data = resp.read()
    except Exception as e:  # noqa: BLE001 - editorial ingest must continue
        log(f"poster download failed for {film_id}: {e}")
        return PosterOutcome("download_failed", url, str(e))
    kind = sniff_image(data, content_type)
    if kind is None:
        message = f"invalid image bytes={len(data)} content-type={content_type!r}"
        log(f"poster download failed for {film_id}: {message}")
        return PosterOutcome("download_failed", url, message)
    ext = {"jpeg": "jpg", "png": "png", "webp": "webp"}[kind]
    dest = _poster_path(film_id, ext)
    dest.write_bytes(data)
    return PosterOutcome("localized", f"/posters/{film_id}.{ext}", None)


def poster_for(film_id: str, image_set: Any, *, localize: bool) -> PosterOutcome:
    """Poster to store. Download failures fall back to the remote URL.

    localize=False: remote MotN URL, no download.
    localize=True: public/posters/{id}.{ext} from the real image format.
    no_image means the API imageSet had no usable URL.
    """
    return localize_remote_poster(
        film_id, best_vertical_poster(image_set), localize=localize
    )


def record_poster(
    report: dict[str, Any],
    seen: set[str],
    film_id: str,
    title: str,
    outcome: PosterOutcome,
) -> None:
    """Record each film once. no_image and download_failed stay separate lists."""
    if film_id in seen:
        return
    seen.add(film_id)
    if outcome.status == "no_image":
        report["poster_no_image"].append({"id": film_id, "title": title})
    elif outcome.status == "download_failed":
        report["poster_download_failed"].append(
            {
                "id": film_id,
                "title": title,
                "error": outcome.error,
                "fallback": outcome.stored,
            }
        )
    elif outcome.status == "localized":
        report["poster_localized"].append({"id": film_id, "poster": outcome.stored})
    else:
        report["poster_remote"].append({"id": film_id, "poster": outcome.stored})


def apply_missing_poster(
    film: dict[str, Any],
    image_set: Any,
    *,
    localize: bool,
    report: dict[str, Any],
    seen: set[str],
    title: str,
) -> bool:
    """Set film['poster'] when it is missing. True when the film dict changed."""
    if film.get("poster"):
        return False
    outcome = poster_for(str(film["id"]), image_set, localize=localize)
    record_poster(report, seen, str(film["id"]), title, outcome)
    if not outcome.stored:
        return False
    film["poster"] = outcome.stored
    return True


def build_new_film(
    title_en: str,
    day: str,
    platform: str,
    source_url: str,
    year: int | None,
    service_name: str,
    overview: str,
    directors: list[str],
    cast: list[str],
    genres: list[str],
    countries: list[str] | None = None,
) -> dict[str, Any]:
    """New MotN film. Genres and country are API values only.

    Missing genres stay []. Missing production country omits country.
    Do not invent ["剧情"] or ["美国"]. An English overview is stored and
    flagged copyPending synopsis; film-copy.json can replace it.
    """
    fid = slugify(title_en)
    title_zh = title_zh_for(title_en)
    y = year or int(day[:4])
    syn = overview.strip()
    if len(syn) > 400:
        syn = syn[:397].rstrip() + "…"
    genre_names = [g.strip() for g in genres if isinstance(g, str) and g.strip()][:6]
    film: dict[str, Any] = {
        "id": fid,
        "title": title_zh,
        "titleEn": title_en,
        "year": y,
        "synopsis": syn,
        "directors": directors[:8],
        "cast": cast[:12],
        "genres": genre_names,
        "posterColors": ["#0f172a", "#1e3a5f"],
        "streaming": [make_release(platform, day, source_url, service_name)],
    }
    country_names = [c for c in (countries or []) if isinstance(c, str) and c.strip()]
    if country_names:
        film["country"] = country_names[:6]
    apply_film_copy(film)
    set_copy_pending(film)
    return film


def write_json(path: Path, data: Any) -> None:
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def fetch_all_changes(
    api_key: str,
    country: str,
    catalogs: str,
    *,
    max_pages: int = MAX_CHANGE_PAGES,
) -> tuple[list[dict[str, Any]], dict[str, dict[str, Any]], int, bool]:
    """Page /changes. Stops on a repeated cursor or after max_pages.

    Returns (changes, shows, pages, truncated). truncated is true when the
    cap or a repeated cursor cut the walk short.
    """
    if max_pages < 1:
        raise SystemExit(f"error: max_pages must be >= 1, got {max_pages}")
    changes: list[dict[str, Any]] = []
    shows: dict[str, dict[str, Any]] = {}
    pages = 0
    cursor: str | None = None
    seen_cursors: set[str] = set()
    truncated = False
    while True:
        q: dict[str, str] = {
            "country": country,
            "change_type": "upcoming",
            "item_type": "show",
            "show_type": "movie",
            "catalogs": catalogs,
            "include_unknown_dates": "false",
            "order_direction": "asc",
        }
        if cursor:
            q["cursor"] = cursor
        url = f"{API_BASE}/changes?{urllib.parse.urlencode(q)}"
        pages += 1
        try:
            payload = http_get_json(url, api_key)
        except urllib.error.HTTPError as e:
            body = e.read().decode("utf-8", errors="replace")[:500]
            log(f"GET /changes page={pages} cursor={'yes' if cursor else 'no'} -> HTTP {e.code}")
            raise SystemExit(f"error: HTTP {e.code}: {body}") from e
        except urllib.error.URLError as e:
            log(f"GET /changes page={pages} cursor={'yes' if cursor else 'no'} -> failed")
            raise SystemExit(f"error: fetch failed: {e}") from e

        batch = payload.get("changes") or []
        if not isinstance(batch, list):
            batch = []
        show_map = payload.get("shows") or {}
        if isinstance(show_map, dict):
            for sid, show in show_map.items():
                if isinstance(show, dict):
                    shows[str(sid)] = show
                    shows[str(show.get("id") or sid)] = show
        changes.extend(x for x in batch if isinstance(x, dict))
        has_more = bool(payload.get("hasMore"))
        log(
            f"GET /changes page={pages} cursor={'yes' if cursor else 'no'} "
            f"-> 200 changes={len(batch)} hasMore={'yes' if has_more else 'no'}"
        )
        if not has_more:
            break
        if pages >= max_pages:
            log(f"error: /changes reached max_pages={max_pages}; stopping")
            truncated = True
            break
        nxt = payload.get("nextCursor")
        if not isinstance(nxt, str) or not nxt:
            break
        if nxt in seen_cursors or nxt == cursor:
            log("error: /changes nextCursor repeated; stopping")
            truncated = True
            break
        seen_cursors.add(nxt)
        cursor = nxt
        time.sleep(0.35)
    return changes, shows, pages, truncated


def build_parser() -> argparse.ArgumentParser:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--report", type=Path, default=None)
    ap.add_argument("--country", default="us")
    ap.add_argument("--catalogs", default=DEFAULT_CATALOGS)
    ap.add_argument("--key-file", default=None, help="Fallback path if MOTN_API_KEY unset")
    ap.add_argument(
        "--localize-posters",
        action=argparse.BooleanOptionalAction,
        default=env_localize_posters(),
        help=(
            "Download posters into public/posters/ and store /posters/{id}.{ext}. "
            "Default is on. MOTN_LOCALIZE_POSTERS=0 turns this off. "
            "--no-localize-posters forces remote URLs (overrides the env var)."
        ),
    )
    return ap


def main() -> int:
    args = build_parser().parse_args()
    log(
        "posters: "
        + (
            "localize to public/posters/"
            if args.localize_posters
            else "remote URLs (no download)"
        )
    )

    api_key = resolve_api_key(args.key_file)
    changes, shows, pages, changes_truncated = fetch_all_changes(
        api_key, args.country, args.catalogs
    )
    log(
        f"fetched changes={len(changes)} shows={len(shows)} pages={pages}"
        + (" truncated=yes" if changes_truncated else "")
    )

    confirmed: list[dict[str, Any]] = []
    skip_counts: dict[str, int] = {}
    for ch in changes:
        sid = str(ch.get("showId") or "")
        show = shows.get(sid)
        reason = should_skip(ch, show)
        if reason:
            skip_counts[reason] = skip_counts.get(reason, 0) + 1
            continue
        # should_skip already rejected these. A miss here is a script bug.
        if show is None:
            raise SystemExit(
                f"error: change showId={sid} passed filters but show payload is missing"
            )
        svc = ch.get("service")
        if not isinstance(svc, dict) or not svc.get("id"):
            raise SystemExit(
                f"error: change showId={sid} passed filters but service is missing"
            )
        svc_id = svc["id"]
        if svc_id not in SERVICE_TO_PLATFORM:
            raise SystemExit(
                f"error: change showId={sid} service {svc_id} is not supported"
            )
        platform = SERVICE_TO_PLATFORM[svc_id]
        day = ts_to_date(ch.get("timestamp"))
        if not day:
            raise SystemExit(
                f"error: change showId={sid} passed filters but timestamp is missing"
            )
        title = (show.get("title") or show.get("originalTitle") or "").strip()
        year = show.get("releaseYear")
        try:
            year_i = int(year) if year is not None else int(day[:4])
        except (TypeError, ValueError):
            year_i = int(day[:4])
        directors = [str(x) for x in (show.get("directors") or []) if x]
        cast = [str(x) for x in (show.get("cast") or []) if x]
        genres = []
        for g in show.get("genres") or []:
            if isinstance(g, dict) and g.get("name"):
                genres.append(str(g["name"]))
            elif isinstance(g, str):
                genres.append(g)
        link = (ch.get("link") or "").strip()
        source_url = link or "https://www.movieofthenight.com/"
        confirmed.append(
            {
                "titleEn": title,
                "date": day,
                "year": year_i,
                "platform": platform,
                "serviceId": svc_id,
                "serviceName": svc.get("name") or platform_label(platform),
                "sourceUrl": source_url,
                "overview": str(show.get("overview") or ""),
                "directors": directors,
                "cast": cast,
                "genres": genres,
                "countries": countries_from_show(show),
                "showId": sid,
                "imageSet": show.get("imageSet"),
            }
        )

    # dedupe by titleEn|platform|date
    uniq: dict[str, dict[str, Any]] = {}
    for row in confirmed:
        key = f"{row['titleEn'].lower()}|{row['platform']}|{row['date']}"
        uniq[key] = row
    confirmed = sorted(
        uniq.values(), key=lambda r: (r["date"], r["platform"], r["titleEn"].lower())
    )
    log(f"confirmed movies: {len(confirmed)}; skips={skip_counts}")

    records = iter_film_records()
    index = index_films(records)

    motn_path = DATA / "motn-streaming-catalog.json"
    # Reuse the object `records` already holds. A second json.loads is a
    # different dict; writing that copy drops poster edits made via the index.
    motn: dict[str, Any] | None = None
    for name, catalog, _film in records:
        if name == "motn-streaming-catalog.json" and isinstance(catalog, dict):
            motn = catalog
            break
    if motn is None:
        motn = load_catalog(motn_path) if motn_path.exists() else {"films": [], "ceremonies": []}
    if not isinstance(motn, dict):
        motn = {"films": [], "ceremonies": []}
    if not isinstance(motn.get("films"), list):
        motn["films"] = []
    if "ceremonies" not in motn:
        motn["ceremonies"] = []

    # Snapshot announced keys before mutating (WTS/WON/other catalogs).
    existing_keys: set[str] = set()
    for _name, _cat, film in records:
        for r in film.get("streaming") or []:
            if r.get("status") == "announced" and r.get("date") and r.get("platform"):
                te = (film.get("titleEn") or film.get("title") or "").strip().lower()
                existing_keys.add(f"{r['platform']}|{r['date']}|{te}")

    dirty: set[str] = set()
    report: dict[str, Any] = {
        "fetched_at": time.strftime("%Y-%m-%dT%H:%M:%S%z"),
        "country": args.country,
        "catalogs": args.catalogs,
        "pages": pages,
        "raw_changes": len(changes),
        "confirmed": len(confirmed),
        "skips": skip_counts,
        "added_new": [],
        "updated_existing": [],
        "labeled_existing": [],
        "skipped_dup": [],
        "skipped_existing_platform": [],
        "actions": {},
        "by_platform": {},
        "localize_posters": bool(args.localize_posters),
        "changes_truncated": changes_truncated,
        "poster_no_image": [],
        "poster_download_failed": [],
        "poster_localized": [],
        "poster_remote": [],
    }
    poster_seen: set[str] = set()
    localize = bool(args.localize_posters)

    for row in confirmed:
        title_en = row["titleEn"]
        day = row["date"]
        platform = row["platform"]
        fid = slugify(title_en)
        release = make_release(
            platform, day, row["sourceUrl"], row["serviceName"]
        )
        report["by_platform"][platform] = report["by_platform"].get(platform, 0) + 1

        hit = (
            index.get(fid)
            or index.get(f"en:{title_en.lower()}")
            or index.get(f"t:{title_en.lower()}")
        )
        if hit:
            fname, _catalog, film = hit
            if apply_missing_poster(
                film,
                row.get("imageSet"),
                localize=localize,
                report=report,
                seen=poster_seen,
                title=title_en,
            ):
                dirty.add(fname)
            action = upsert_release(film, release)
            report["actions"][f"{film['id']}|{platform}|{day}"] = action
            if action == "skipped":
                report["skipped_dup"].append(
                    {"id": film["id"], "platform": platform, "date": day, "file": fname}
                )
            elif action == "skipped_existing_platform":
                report["skipped_existing_platform"].append(
                    {"id": film["id"], "platform": platform, "date": day, "file": fname}
                )
            elif action == "labeled":
                dirty.add(fname)
                report["labeled_existing"].append(
                    {"id": film["id"], "platform": platform, "date": day, "file": fname}
                )
            else:
                dirty.add(fname)
                report["updated_existing"].append(
                    {
                        "id": film["id"],
                        "platform": platform,
                        "date": day,
                        "file": fname,
                        "action": action,
                    }
                )
            continue

        film = build_new_film(
            title_en,
            day,
            platform,
            row["sourceUrl"],
            row.get("year"),
            row["serviceName"],
            row.get("overview") or "",
            row.get("directors") or [],
            row.get("cast") or [],
            row.get("genres") or [],
            row.get("countries") or [],
        )
        existing = next((f for f in motn["films"] if f.get("id") == film["id"]), None)
        target = existing if existing else film
        if apply_missing_poster(
            target,
            row.get("imageSet"),
            localize=localize,
            report=report,
            seen=poster_seen,
            title=title_en,
        ):
            dirty.add("motn-streaming-catalog.json")
        if existing:
            action = upsert_release(existing, release)
            report["actions"][f"{film['id']}|{platform}|{day}"] = action
            dirty.add("motn-streaming-catalog.json")
            if action == "added":
                report["updated_existing"].append(
                    {
                        "id": film["id"],
                        "platform": platform,
                        "date": day,
                        "file": "motn-streaming-catalog.json",
                        "action": action,
                    }
                )
            elif action == "labeled":
                report["labeled_existing"].append(
                    {
                        "id": film["id"],
                        "platform": platform,
                        "date": day,
                        "file": "motn-streaming-catalog.json",
                    }
                )
            elif action == "skipped_existing_platform":
                report["skipped_existing_platform"].append(
                    {
                        "id": film["id"],
                        "platform": platform,
                        "date": day,
                        "file": "motn-streaming-catalog.json",
                    }
                )
            else:
                report["skipped_dup"].append(
                    {
                        "id": film["id"],
                        "platform": platform,
                        "date": day,
                        "file": "motn-streaming-catalog.json",
                    }
                )
        else:
            motn["films"].append(film)
            dirty.add("motn-streaming-catalog.json")
            index[film["id"]] = ("motn-streaming-catalog.json", motn, film)
            index[f"en:{title_en.lower()}"] = ("motn-streaming-catalog.json", motn, film)
            report["added_new"].append({"id": film["id"], "platform": platform, "date": day})
            report["actions"][f"{film['id']}|{platform}|{day}"] = "added_new"

    # Title drift (API renamed a show) skips the match above. If a valid local
    # file is already under public/posters/{id}, attach it instead of leaving
    # the catalog film with no poster.
    if localize:
        for film in motn["films"]:
            if not isinstance(film, dict) or not film.get("id") or film.get("poster"):
                continue
            rel = local_poster_public_path(str(film["id"]))
            if not rel:
                continue
            film["poster"] = rel
            dirty.add("motn-streaming-catalog.json")
            record_poster(
                report,
                poster_seen,
                str(film["id"]),
                str(film.get("titleEn") or film.get("title") or film["id"]),
                PosterOutcome("localized", rel, None),
            )

    if not args.dry_run:
        write_json(motn_path, motn)
        catalog_objs: dict[str, dict[str, Any]] = {}
        for name, catalog, _film in records:
            catalog_objs[name] = catalog
        catalog_objs["motn-streaming-catalog.json"] = motn
        for fname in sorted(dirty):
            if fname == "motn-streaming-catalog.json":
                continue
            cat_obj = catalog_objs.get(fname)
            if cat_obj is None:
                log(f"warn: missing catalog object for {fname}")
                continue
            write_json(DATA / fname, cat_obj)
        log(f"wrote motn catalog ({len(motn['films'])} films); dirty={sorted(dirty)}")
    else:
        log(f"dry-run; would dirty={sorted(dirty)}; new={len(report['added_new'])}")

    new_coverage = []
    overlap = []
    for row in confirmed:
        k = f"{row['platform']}|{row['date']}|{row['titleEn'].lower()}"
        if k in existing_keys:
            overlap.append(k)
        else:
            new_coverage.append(
                {"titleEn": row["titleEn"], "platform": row["platform"], "date": row["date"]}
            )

    report["motn_catalog_size"] = len(motn["films"])
    report["dirty_files"] = sorted(dirty)
    report["coverage_new_vs_wts_won"] = len(new_coverage)
    report["coverage_overlap_wts_won"] = len(overlap)
    report["coverage_new_samples"] = new_coverage[:40]
    report["added_new_count"] = len(report["added_new"])
    report["updated_existing_count"] = len(report["updated_existing"])
    log(
        "posters "
        f"localized={len(report['poster_localized'])} "
        f"remote={len(report['poster_remote'])} "
        f"no_image={len(report['poster_no_image'])} "
        f"download_failed={len(report['poster_download_failed'])}"
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
                "added_new_count",
                "updated_existing_count",
                "skipped_dup",
                "skipped_existing_platform",
                "by_platform",
                "coverage_new_vs_wts_won",
                "coverage_overlap_wts_won",
                "motn_catalog_size",
                "dirty_files",
                "localize_posters",
                "changes_truncated",
                "poster_no_image",
                "poster_download_failed",
                "poster_localized",
                "poster_remote",
            )
        }
        # trim long lists in stdout
        summary["skipped_dup"] = len(report["skipped_dup"])
        summary["skipped_existing_platform"] = len(report["skipped_existing_platform"])
        summary["added_new"] = report["added_new"][:20]
        print(json.dumps(summary, ensure_ascii=False, indent=2))

    return 0


if __name__ == "__main__":
    sys.exit(main())

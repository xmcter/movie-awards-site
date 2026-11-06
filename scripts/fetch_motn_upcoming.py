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

Writes/updates:
  src/data/motn-streaming-catalog.json
  may patch streaming[] on existing catalog films (same id / titleEn)
Does NOT wipe WTS/WON rows; same platform+date+announced is skipped.
"""
from __future__ import annotations

import argparse
import json
import os
import re
import sys
import time
from datetime import datetime
import urllib.error
import urllib.parse
import urllib.request
from datetime import date, datetime, timezone
from zoneinfo import ZoneInfo
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "src" / "data"
API_BASE = "https://api.movieofthenight.com/v4"
UA = "ReadCineBot/1.0 (+https://news.readcine.com; contact=tonyecter@gmail.com)"
SOURCE_LABEL = "片夜定档"

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
}


def title_zh_for(title_en: str) -> str:
    """有中文译名用中文；否则暂留英文（后续可人工补 film-copy）。"""
    fid = slugify(title_en)
    return KNOWN_TITLE_ZH.get(fid, title_en)

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


def http_get_json(url: str, api_key: str) -> dict[str, Any]:
    req = urllib.request.Request(
        url,
        headers={
            "X-API-Key": api_key,
            "User-Agent": UA,
            "Accept": "application/json",
        },
    )
    with urllib.request.urlopen(req, timeout=90) as resp:
        return json.loads(resp.read().decode("utf-8", errors="replace"))


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



def best_vertical_poster(image_set: Any) -> str | None:
    """Pick a MotN vertical poster URL (prefer larger)."""
    if not isinstance(image_set, dict):
        return None
    node = image_set.get("verticalPoster")
    if not isinstance(node, dict):
        return None
    for size in ("w720", "w600", "w480", "w360", "w240"):
        url = node.get(size)
        if isinstance(url, str) and url.startswith("https://"):
            return url
    return None


def localize_poster(film_id: str, image_set: Any) -> str | None:
    """Download MotN poster into public/posters/{id}.jpg; return site path or None."""
    url = best_vertical_poster(image_set)
    if not url:
        return None
    out_dir = ROOT / "public" / "posters"
    out_dir.mkdir(parents=True, exist_ok=True)
    dest = out_dir / f"{film_id}.jpg"
    if dest.exists() and dest.stat().st_size > 2000:
        return f"/posters/{film_id}.jpg"
    try:
        req = urllib.request.Request(
            url,
            headers={"User-Agent": UA, "Accept": "image/*"},
        )
        with urllib.request.urlopen(req, timeout=60) as resp:
            data = resp.read()
        if len(data) < 2000:
            log(f"poster too small for {film_id}: {len(data)}")
            return None
        dest.write_bytes(data)
        return f"/posters/{film_id}.jpg"
    except Exception as e:  # noqa: BLE001 - editorial ingest must continue
        log(f"poster download failed for {film_id}: {e}")
        return None


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
) -> dict[str, Any]:
    fid = slugify(title_en)
    title_zh = title_zh_for(title_en)
    y = year or int(day[:4])
    syn = overview.strip() if overview.strip() else (
        f"《{title_zh}》流媒体定档（美国区，片夜数据；以平台官方为准）。"
    )
    if len(syn) > 400:
        syn = syn[:397].rstrip() + "…"
    return {
        "id": fid,
        "title": title_zh,
        "titleEn": title_en,
        "year": y,
        "synopsis": syn,
        "directors": directors[:8],
        "cast": cast[:12],
        "genres": genres[:6] or ["剧情"],
        "country": ["美国"],
        "posterColors": ["#0f172a", "#1e3a5f"],
        "streaming": [make_release(platform, day, source_url, service_name)],
    }


def write_json(path: Path, data: Any) -> None:
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def fetch_all_changes(
    api_key: str, country: str, catalogs: str
) -> tuple[list[dict[str, Any]], dict[str, dict[str, Any]], int]:
    changes: list[dict[str, Any]] = []
    shows: dict[str, dict[str, Any]] = {}
    pages = 0
    cursor: str | None = None
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
        log(f"GET /changes page={pages} cursor={'yes' if cursor else 'no'}")
        try:
            payload = http_get_json(url, api_key)
        except urllib.error.HTTPError as e:
            body = e.read().decode("utf-8", errors="replace")[:500]
            raise SystemExit(f"error: HTTP {e.code}: {body}") from e
        except urllib.error.URLError as e:
            raise SystemExit(f"error: fetch failed: {e}") from e

        batch = payload.get("changes") or []
        show_map = payload.get("shows") or {}
        if isinstance(show_map, dict):
            for sid, show in show_map.items():
                if isinstance(show, dict):
                    shows[str(sid)] = show
                    shows[str(show.get("id") or sid)] = show
        changes.extend(batch)
        if not payload.get("hasMore"):
            break
        cursor = payload.get("nextCursor")
        if not cursor:
            break
        time.sleep(0.35)
    return changes, shows, pages


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--report", type=Path, default=None)
    ap.add_argument("--country", default="us")
    ap.add_argument("--catalogs", default=DEFAULT_CATALOGS)
    ap.add_argument("--key-file", default=None, help="Fallback path if MOTN_API_KEY unset")
    args = ap.parse_args()

    api_key = resolve_api_key(args.key_file)
    changes, shows, pages = fetch_all_changes(api_key, args.country, args.catalogs)
    log(f"fetched changes={len(changes)} shows={len(shows)} pages={pages}")

    confirmed: list[dict[str, Any]] = []
    skip_counts: dict[str, int] = {}
    for ch in changes:
        sid = str(ch.get("showId") or "")
        show = shows.get(sid)
        reason = should_skip(ch, show)
        if reason:
            skip_counts[reason] = skip_counts.get(reason, 0) + 1
            continue
        assert show is not None
        svc = ch["service"]
        svc_id = svc["id"]
        platform = SERVICE_TO_PLATFORM[svc_id]
        day = ts_to_date(ch.get("timestamp"))
        assert day
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
    motn = load_catalog(motn_path) if motn_path.exists() else {"films": [], "ceremonies": []}
    if "films" not in motn:
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
    }

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
            if not film.get("poster"):
                local_poster = localize_poster(str(film["id"]), row.get("imageSet"))
                if local_poster:
                    film["poster"] = local_poster
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
        )
        local_poster = localize_poster(film["id"], row.get("imageSet"))
        if local_poster:
            film["poster"] = local_poster
        existing = next((f for f in motn["films"] if f.get("id") == film["id"]), None)
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

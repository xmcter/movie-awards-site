#!/usr/bin/env python3
"""Import new movie-library resource notices without persisting download secrets.

SSH reaches an on-host HTTP API because the public API requires OAuth. The
script never opens the key file itself; OpenSSH does. --dry-run fetches and
reports but changes no files. Dates are Asia/Shanghai.

Connection settings have no live defaults in this file. Export them, point
PEEK_CONFIG at a KEY=VALUE file, or pass flags. These examples are
placeholders for the docs, not a deployment:

    PEEK_SSH_HOST=user@203.0.113.10
    PEEK_SSH_IDENTITY=~/.ssh/id_ed25519
    PEEK_API_BASE=http://127.0.0.1:8080

--ssh-host, --identity, and --api-base override the environment and
PEEK_CONFIG. PEEK_CONFIG fills a variable only when that variable is unset.
Unknown/mismatched metadata, old titles, series, docs and English-only
releases are held for editorial review rather than inventing a film/year/subtitle claim.
"""
from __future__ import annotations

import argparse
from concurrent.futures import ThreadPoolExecutor
from datetime import date, datetime, timedelta
import json
import os
from pathlib import Path
import re
import shlex
import subprocess
import time
from urllib.parse import urlencode, urlsplit
from zoneinfo import ZoneInfo

ROOT = Path(__file__).resolve().parents[1]
CATALOGS = [
    "films.json", "major-awards.json", "more-catalog.json", "extra-catalog.json",
    "density-pack.json", "wts-streaming-catalog.json", "won-streaming-catalog.json",
    "motn-streaming-catalog.json", "movie-peek-catalog.json",
]
# Existing curated catalog calls this film 可能的爱情; preserve its canonical ID.
KNOWN_FILM_IDS = {"36847425": "possible-love"}
RESOURCE = re.compile(r"出资源|已出源|熟肉|网盘|可下|WEB-DL|BDRip|压制|数字版流出", re.I)
EXCLUDED = re.compile(r"纪录|documentary|docuseries|剧集|电视剧|连续剧|迷你剧|限定剧|TV\s*series|miniseries", re.I)
ENGLISH_ONLY = re.compile(r"英字|英文字幕|无中字|无字幕|生肉", re.I)
CHINESE_SUBS = re.compile(r"中字|中文字幕|官中|中英字幕|简繁|内封简|内嵌中", re.I)
PROVIDERS = {"quark": "夸克", "baidu": "百度", "xunlei": "迅雷", "aliyun": "阿里云盘"}
# Hosts film_from_meta may store, and the localization loop may download.
REMOTE_POSTER_HOSTS = frozenset({
    "img1.doubanio.com", "img2.doubanio.com", "img3.doubanio.com",
    "img9.doubanio.com", "image.tmdb.org",
})
ENV_SSH_HOST = "PEEK_SSH_HOST"
ENV_SSH_IDENTITY = "PEEK_SSH_IDENTITY"
ENV_API_BASE = "PEEK_API_BASE"
CONFIG_ENV = "PEEK_CONFIG"
CONFIG_KEYS = frozenset({ENV_SSH_HOST, ENV_SSH_IDENTITY, ENV_API_BASE})
# Extra attempts after the first SSH/curl failure. One film then stops;
# the rest of the batch continues.
FETCH_RETRIES = 2


class FetchFailed(Exception):
    """SSH/curl or JSON parse failed after the retry budget."""

    def __init__(self, message: str, attempts: int):
        super().__init__(message)
        self.message = message
        self.attempts = attempts


def read_json(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def weibo_url(value):
    if not isinstance(value, str):
        return None
    try:
        url = urlsplit(value.strip())
        if (url.scheme == "https" and url.hostname in {"m.weibo.cn", "weibo.com", "www.weibo.com"}
                and not url.username and not url.password and not url.port and url.path.strip("/")):
            # Tracking query strings/fragments are not needed to reach a post.
            return f"https://{url.hostname}{url.path}"
    except ValueError:
        pass
    return None


def clean_title(value):
    value = str(value or "").strip(" 《》")
    value = re.sub(r"^[🔥✨🎬\s]+", "", value)
    return re.split(r"\s+(?:英字|内嵌|内封|外挂|手慢无|HDR|4K|1080[pP])", value, maxsplit=1)[0].strip()


def normalized(value):
    return re.sub(r"[\W_]", "", value).casefold()


def strings(value):
    return [safe_text(x) for x in value if safe_text(x)] if isinstance(value, list) else []


def safe_text(value):
    """Do not import source blobs containing download links or passcodes."""
    if not isinstance(value, str):
        return ""
    if re.search(r"https?://|提取码|提取密码|passcode", value, re.I):
        return ""
    return value.strip()


def is_local_poster_path(value):
    return isinstance(value, str) and value.startswith("/posters/")


def is_http_url(value):
    if not isinstance(value, str):
        return False
    try:
        url = urlsplit(value.strip())
    except ValueError:
        return False
    return url.scheme in {"http", "https"} and bool(url.hostname)


def is_allowed_remote_poster(value):
    """Douban image hosts and image.tmdb.org only."""
    if not isinstance(value, str):
        return False
    try:
        url = urlsplit(value.strip())
    except ValueError:
        return False
    return url.scheme == "https" and url.hostname in REMOTE_POSTER_HOSTS


def localize_poster_plan(films):
    """Films whose poster is still a Douban or TMDB URL, plus the local target."""
    plan = []
    for film in films:
        remote = film.get("poster")
        film_id = film.get("id")
        if not isinstance(film_id, str) or not film_id or not is_allowed_remote_poster(remote):
            continue
        title = film.get("title")
        plan.append({
            "filmId": film_id,
            "title": title if isinstance(title, str) else "",
            "remote": remote,
            "local": f"/posters/{film_id}.jpg",
        })
    return plan


def merge_film(imported, new_film):
    """Overlay non-empty incoming fields. A remote poster must not replace /posters/."""
    updates = {k: v for k, v in new_film.items() if v and k != "streaming"}
    if is_local_poster_path(imported.get("poster")) and is_http_url(updates.get("poster")):
        updates.pop("poster", None)
    return {**imported, **updates}


def localize_douban_poster(film_id: str, poster_url: str, identity: str, ssh_host: str) -> str | None:
    """Download a Douban or TMDB poster via SSH (this box often gets 418)."""
    if not is_allowed_remote_poster(poster_url):
        return None
    out = ROOT / "public" / "posters" / f"{film_id}.jpg"
    if out.exists() and out.stat().st_size > 2000:
        return f"/posters/{film_id}.jpg"
    remote = f"/tmp/news-poster-{film_id}.jpg"
    referer = (
        "https://www.themoviedb.org/"
        if urlsplit(poster_url).hostname == "image.tmdb.org"
        else "https://movie.douban.com/"
    )
    cmd = [
        "ssh", "-i", str(Path(identity).expanduser()), "-o", "BatchMode=yes",
        "-o", "ConnectTimeout=15", "-o", "StrictHostKeyChecking=yes", ssh_host,
        (
            "curl -fsS --max-time 30 -A "
            + shlex.quote("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36")
            + " -H "
            + shlex.quote(f"Referer: {referer}")
            + " -o "
            + shlex.quote(remote)
            + " "
            + shlex.quote(poster_url)
        ),
    ]
    try:
        subprocess.run(cmd, check=True, capture_output=True, text=True, timeout=60)
        out.parent.mkdir(parents=True, exist_ok=True)
        pull = [
            "scp", "-i", str(Path(identity).expanduser()), "-o", "BatchMode=yes",
            "-o", "StrictHostKeyChecking=yes", f"{ssh_host}:{remote}", str(out),
        ]
        subprocess.run(pull, check=True, capture_output=True, text=True, timeout=60)
        if out.exists() and out.stat().st_size > 2000:
            return f"/posters/{film_id}.jpg"
    except (subprocess.CalledProcessError, subprocess.TimeoutExpired, OSError):
        return None
    return None


def film_from_meta(meta, film_id, title, year):
    film = {
        "id": film_id, "title": title, "year": year,
        "synopsis": safe_text(meta.get("intro")),
        "directors": strings(meta.get("directors")),
        "cast": strings(meta.get("actors")), "genres": strings(meta.get("genres")),
        "country": strings(meta.get("countries")), "streaming": [],
    }
    original = safe_text(meta.get("original_title"))
    if original and original != title:
        film["titleEn"] = original
    poster = meta.get("poster", "")
    if is_allowed_remote_poster(poster):
        film["poster"] = poster
    runtime = re.search(r"\d+", " ".join(strings(meta.get("durations"))))
    if runtime:
        film["runtime"] = int(runtime.group())
    return film


def plan_ingest(peek, details, data_dir, day, min_year, *, failed_detail_titles=None):
    failed_detail_titles = set(failed_detail_titles or ())
    catalog_path = data_dir / "movie-peek-catalog.json"
    catalog = read_json(catalog_path) if catalog_path.exists() else {"films": [], "ceremonies": []}
    news = read_json(data_dir / "auteur-news.json")
    all_films = []
    for name in CATALOGS:
        path = data_dir / name
        if path.exists():
            data = read_json(path)
            all_films.extend(data if isinstance(data, list) else data.get("films", []))
    by_id = {f["id"]: f for f in reversed(all_films)}
    first_resource = {}
    for item in news:
        if RESOURCE.search(f'{item.get("summary", "")} {item.get("detail", "")}'):
            first_resource.setdefault(item["filmId"], item)
    report = {"date": day, "timezone": "Asia/Shanghai", "peek_count": len(peek),
              "films_added": 0, "films_updated": 0, "news_added": 0,
              "weibo_backfilled": 0, "added": [], "skipped": []}
    for row in peek:
        raw_title = row.get("title", "")
        def skip(reason):
            report["skipped"].append({"title": raw_title, "reason": reason})
        posted = str(row.get("posted_at", ""))
        # 时效窗：接受最近 7 天内（含当天）出源的片子，不要因只差一天就漏掉。
        # 2026-11-12 用户定：下载站抓取的时效性放宽；年份门槛（min_year）不变。
        try:
            posted_day = date.fromisoformat(posted[:10])
            run_day = date.fromisoformat(day)
        except ValueError:
            skip("not in requested posting date")
            continue
        if not 0 <= (run_day - posted_day).days < 7:
            skip("not in requested posting date")
            continue
        if raw_title in failed_detail_titles:
            skip("detail fetch failed")
            continue
        detail = details.get(raw_title) or {}
        meta = detail.get("meta") or {}
        if detail.get("success") is not True:
            skip("detail lookup unsuccessful")
            continue
        title = clean_title(safe_text(meta.get("title")))
        douban = str(meta.get("douban_id") or "")
        year_string = str(meta.get("year") or "")
        if not title or not douban.isdigit() or not re.fullmatch(r"\d{4}", year_string) or not meta.get("genres"):
            skip("unverified film identity/year/type; needs editorial review")
            continue
        year = int(year_string)
        if not min_year <= year <= int(day[:4]):
            skip("outside new-film year window; no verified restoration/upgrade")
            continue
        if EXCLUDED.search(" ".join(strings(meta.get("genres")))):
            skip("documentary/series excluded by editorial policy")
            continue
        links = [link for link in detail.get("links", []) if link.get("status") == "valid"]
        # Do not promise Chinese subtitles where the source explicitly says otherwise.
        if ENGLISH_ONLY.search(raw_title):
            links = [link for link in links if CHINESE_SUBS.search(link.get("title") or "")]
        if not links:
            skip("no valid eligible resource (English-only/unavailable)")
            continue
        candidates = [link for link in links if weibo_url(link.get("weibo_url"))]
        if not candidates:
            skip("no verified Weibo original post")
            continue
        source = candidates[0]
        film_id = KNOWN_FILM_IDS.get(douban)
        if film_id not in by_id:
            match = next((f for f in by_id.values() if f.get("year") == year and
                          normalized(f.get("title", "")) == normalized(title)), None)
            film_id = match["id"] if match else f"movie-douban-{douban}"
        new_film = film_from_meta(meta, film_id, title, year)
        imported = next((f for f in catalog["films"] if f["id"] == film_id), None)
        if imported is not None:
            merged = merge_film(imported, new_film)
            if merged != imported:
                imported.update(merged)
                report["films_updated"] += 1
        elif film_id not in by_id:
            catalog["films"].append(new_film)
            by_id[film_id] = new_film
            report["films_added"] += 1
        existing_news = first_resource.get(film_id)
        if existing_news is not None:
            touched = False
            if not existing_news.get("weiboUrl"):
                existing_news["weiboUrl"] = weibo_url(source["weibo_url"])
                existing_news["weiboLabel"] = safe_text(source.get("source")) or "微博原帖"
                touched = True
            if not existing_news.get("sourceLabel"):
                existing_news["sourceLabel"] = "片库·微博"
                touched = True
            if not existing_news.get("source") and existing_news.get("weiboUrl"):
                existing_news["source"] = existing_news["weiboUrl"]
                touched = True
            # Prefer library posted_at as original publish time
            if posted and not existing_news.get("sourcePublishedAt"):
                iso = posted.replace(" ", "T", 1)
                if "+" not in iso and "Z" not in iso:
                    iso = iso + "+08:00"
                existing_news["sourcePublishedAt"] = iso
                existing_news["publishedAt"] = iso
                touched = True
            if touched:
                report["weibo_backfilled"] += 1
            skip("first-resource notice already exists for filmId")
            continue
        film_title = by_id[film_id]["title"]
        providers = list(dict.fromkeys(PROVIDERS[link["provider"]] for link in links if link.get("provider") in PROVIDERS))
        shape = "、".join(providers) + "网盘资源" if providers else "网盘资源"
        # Use library posted_at as source publish time (not ingest clock).
        src_iso = posted.replace(" ", "T", 1) if posted else ""
        if src_iso and "+" not in src_iso and "Z" not in src_iso:
            src_iso = src_iso + "+08:00"
        if not src_iso:
            src_iso = datetime.now(ZoneInfo("Asia/Shanghai")).isoformat(timespec="seconds")
        notice = {
            "id": f"movie-peek-{film_id}-first-resource", "filmId": film_id,
            "publishedAt": src_iso,
            "sourcePublishedAt": src_iso,
            "date": day, "kind": "release", "summary": f"《{film_title}》已出源",
            "detail": "",  # 不生成网盘类型、入口指南或可用性免责声明
            "sourceLabel": "片库·微博",
            "source": weibo_url(source["weibo_url"]),
            "weiboUrl": weibo_url(source["weibo_url"]),
            "weiboLabel": safe_text(source.get("source")) or "微博原帖",
        }
        news.append(notice)
        first_resource[film_id] = notice
        report["news_added"] += 1
        report["added"].append({"filmId": film_id, "title": film_title, "weiboUrl": notice["weiboUrl"]})
    return catalog, news, report


def short_fetch_error(exc: Exception) -> str:
    """Operator-facing fetch error without the SSH command or key path."""
    if isinstance(exc, subprocess.TimeoutExpired):
        return "ssh/curl timed out"
    if isinstance(exc, json.JSONDecodeError):
        return "response was not JSON"
    if isinstance(exc, subprocess.CalledProcessError):
        text = (exc.stderr or exc.stdout or "").strip()
        lines = text.splitlines()
        tail = lines[-1] if lines else f"exit {exc.returncode}"
        return f"ssh/curl failed: {tail}"[:300]
    text = str(exc).strip() or type(exc).__name__
    return text[:300]


def call_with_retries(fn, retries=FETCH_RETRIES, pause_seconds=0):
    """Call fn. After `retries` extra attempts, raise FetchFailed."""
    attempts = retries + 1
    last_message = "fetch failed"
    for attempt in range(1, attempts + 1):
        try:
            return fn()
        except (subprocess.CalledProcessError, subprocess.TimeoutExpired, OSError, json.JSONDecodeError) as exc:
            last_message = short_fetch_error(exc)
            if attempt >= attempts:
                raise FetchFailed(last_message, attempts) from exc
            if pause_seconds:
                time.sleep(pause_seconds)
    raise FetchFailed(last_message, attempts)


def fetch_api(path, args):
    url = args.api_base.rstrip("/") + path
    cmd = ["ssh", "-i", str(Path(args.identity).expanduser()), "-o", "BatchMode=yes",
           "-o", "ConnectTimeout=15", "-o", "StrictHostKeyChecking=yes", args.ssh_host,
           "curl -fsS --max-time 30 " + shlex.quote(url)]

    def once():
        result = subprocess.run(cmd, check=True, capture_output=True, text=True, timeout=50)
        return json.loads(result.stdout)

    return call_with_retries(once, retries=FETCH_RETRIES, pause_seconds=1)


def load_details(titles, fetch_one, max_workers=3):
    """Fetch each title. A failed title is reported and does not cancel the others."""

    def wrapped(title):
        try:
            return title, fetch_one(title), None
        except FetchFailed as exc:
            return title, None, {"title": title, "error": exc.message, "attempts": exc.attempts}
        except Exception as exc:
            return title, None, {"title": title, "error": short_fetch_error(exc), "attempts": 1}

    details = {}
    failures = []
    with ThreadPoolExecutor(max_workers=max_workers) as pool:
        for title, payload, error in pool.map(wrapped, titles):
            if error:
                failures.append(error)
            else:
                details[title] = payload
    return details, failures


def apply_config_file():
    """Fill unset PEEK_* variables from PEEK_CONFIG. Does not override the environment."""
    path = (os.environ.get(CONFIG_ENV) or "").strip()
    if not path:
        return
    file_path = Path(path).expanduser()
    if not file_path.is_file():
        raise SystemExit(f"{CONFIG_ENV} is not a file: {path}")
    for raw in file_path.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip().strip('"').strip("'")
        if key in CONFIG_KEYS and value and key not in os.environ:
            os.environ[key] = value


def require_setting(cli_value, env_name):
    value = (cli_value or os.environ.get(env_name) or "").strip()
    if not value:
        raise SystemExit(
            f"missing {env_name}. Export it, pass the matching flag, or set {CONFIG_ENV} "
            "to a KEY=VALUE file. Names and examples are in the module docstring and README."
        )
    return value


def normalize_api_base(value):
    base = value.strip().rstrip("/")
    parts = urlsplit(base)
    if parts.scheme not in {"http", "https"} or not parts.hostname or parts.path not in {"", "/"}:
        raise SystemExit(
            f"{ENV_API_BASE} must be an origin with no path. "
            "See the module docstring for an example."
        )
    return base


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--date", default=datetime.now(ZoneInfo("Asia/Shanghai")).date().isoformat())
    parser.add_argument("--min-year", type=int, help="default: posting year minus one")
    parser.add_argument("--ssh-host", default=None, help=f"Overrides {ENV_SSH_HOST}.")
    parser.add_argument("--identity", default=None, help=f"Overrides {ENV_SSH_IDENTITY}.")
    parser.add_argument("--api-base", default=None, help=f"Overrides {ENV_API_BASE}.")
    args = parser.parse_args()
    date.fromisoformat(args.date)
    apply_config_file()
    args.ssh_host = require_setting(args.ssh_host, ENV_SSH_HOST)
    args.identity = require_setting(args.identity, ENV_SSH_IDENTITY)
    args.api_base = normalize_api_base(require_setting(args.api_base, ENV_API_BASE))
    try:
        peek = fetch_api("/api/peek", args)
    except FetchFailed as exc:
        raise SystemExit(f"peek fetch failed after {exc.attempts} attempts: {exc.message}") from exc
    if peek.get("success") is not True or not isinstance(peek.get("data"), list):
        raise RuntimeError("peek returned an unsuccessful response")
    rows = peek["data"]
    # Detail fetch must cover the same 7-day timeliness window as plan_ingest,
    # otherwise films posted a few days ago pass the window check but fail the
    # detail lookup and are skipped. (2026-11-12 fix.)
    run_day = date.fromisoformat(args.date)
    window_start = run_day - timedelta(days=6)

    def _in_window(value):
        try:
            day = date.fromisoformat(str(value)[:10])
        except ValueError:
            return False
        return window_start <= day <= run_day

    titles = list(dict.fromkeys(
        row["title"] for row in rows if _in_window(row.get("posted_at", ""))
    ))

    def fetch_detail(title):
        return fetch_api("/api/movie_detail?" + urlencode({"title": title}), args)

    details, detail_failures = load_details(titles, fetch_detail)
    data_dir = ROOT / "src" / "data"
    catalog, news, report = plan_ingest(
        rows, details, data_dir, args.date, args.min_year or int(args.date[:4]) - 1,
        failed_detail_titles={item["title"] for item in detail_failures},
    )
    report["detail_failures"] = detail_failures
    # Douban and TMDB hotlinks are both downloaded. Dry-run only lists them.
    pending = localize_poster_plan(catalog.get("films", []))
    report["posters_localized"] = 0
    if args.dry_run:
        report["posters_to_localize"] = pending
    else:
        by_id = {item["filmId"]: item["remote"] for item in pending}
        for film in catalog.get("films", []):
            remote = by_id.get(film.get("id"))
            if not remote:
                continue
            local = localize_douban_poster(film["id"], remote, args.identity, args.ssh_host)
            if local:
                film["poster"] = local
                report["posters_localized"] += 1
    if not args.dry_run:
        # Only explicit allowlisted metadata and Weibo URLs reach these files.
        for filename, data in [("movie-peek-catalog.json", catalog), ("auteur-news.json", news)]:
            path = data_dir / filename
            text = json.dumps(data, ensure_ascii=False, indent=2) + "\n"
            if not path.exists() or path.read_text(encoding="utf-8") != text:
                path.write_text(text, encoding="utf-8")
    print(json.dumps({"dry_run": args.dry_run, **report}, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()

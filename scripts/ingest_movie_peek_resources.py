#!/usr/bin/env python3
"""Import new movie-library resource notices without persisting download secrets.

Uses the existing SSH identity (never reads it) because the public API requires
OAuth. --dry-run fetches and reports but changes no files. Dates are Asia/Shanghai.
Unknown/mismatched metadata, old titles, series, docs and English-only releases
are held for editorial review rather than inventing a film/year/subtitle claim.
"""
from __future__ import annotations

import argparse
from concurrent.futures import ThreadPoolExecutor
from datetime import date, datetime
import json
from pathlib import Path
import re
import shlex
import subprocess
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
RESOURCE = re.compile(r"出资源|熟肉|网盘|可下|WEB-DL|BDRip|压制|数字版流出", re.I)
EXCLUDED = re.compile(r"纪录|documentary|docuseries|剧集|电视剧|连续剧|迷你剧|限定剧|TV\s*series|miniseries", re.I)
ENGLISH_ONLY = re.compile(r"英字|英文字幕|无中字|无字幕|生肉", re.I)
CHINESE_SUBS = re.compile(r"中字|中文字幕|官中|中英字幕|简繁|内封简|内嵌中", re.I)
PROVIDERS = {"quark": "夸克", "baidu": "百度", "xunlei": "迅雷", "aliyun": "阿里云盘"}


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
    url = urlsplit(poster) if isinstance(poster, str) else None
    if url and url.scheme == "https" and url.hostname in {
        "img1.doubanio.com", "img2.doubanio.com", "img3.doubanio.com",
        "img9.doubanio.com", "image.tmdb.org",
    }:
        film["poster"] = poster
    runtime = re.search(r"\d+", " ".join(strings(meta.get("durations"))))
    if runtime:
        film["runtime"] = int(runtime.group())
    return film


def plan_ingest(peek, details, data_dir, day, min_year):
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
        if posted[:10] != day:
            skip("not in requested posting date")
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
            merged = {**imported, **{k: v for k, v in new_film.items() if v and k != "streaming"}}
            if merged != imported:
                imported.update(merged)
                report["films_updated"] += 1
        elif film_id not in by_id:
            catalog["films"].append(new_film)
            by_id[film_id] = new_film
            report["films_added"] += 1
        existing_news = first_resource.get(film_id)
        if existing_news is not None:
            if not existing_news.get("weiboUrl"):
                existing_news["weiboUrl"] = weibo_url(source["weibo_url"])
                existing_news["weiboLabel"] = safe_text(source.get("source")) or "微博原帖"
                report["weibo_backfilled"] += 1
            skip("first-resource notice already exists for filmId")
            continue
        film_title = by_id[film_id]["title"]
        providers = list(dict.fromkeys(PROVIDERS[link["provider"]] for link in links if link.get("provider") in PROVIDERS))
        shape = "、".join(providers) + "网盘资源" if providers else "网盘资源"
        notice = {
            "id": f"movie-peek-{film_id}-first-resource", "filmId": film_id,
            "publishedAt": datetime.now(ZoneInfo("Asia/Shanghai")).isoformat(timespec="seconds"),
            "date": day, "kind": "release", "summary": f"《{film_title}》出资源 · 片库已收录",
            "detail": f"片库新增{shape}。可通过「微博」入口查看原帖；资源可用性以原帖最新说明为准。",
            "weiboUrl": weibo_url(source["weibo_url"]),
            "weiboLabel": safe_text(source.get("source")) or "微博原帖",
        }
        news.append(notice)
        first_resource[film_id] = notice
        report["news_added"] += 1
        report["added"].append({"filmId": film_id, "title": film_title, "weiboUrl": notice["weiboUrl"]})
    return catalog, news, report


def fetch_api(path, args):
    cmd = ["ssh", "-i", str(Path(args.identity).expanduser()), "-o", "BatchMode=yes",
           "-o", "ConnectTimeout=15", "-o", "StrictHostKeyChecking=yes", args.ssh_host,
           "curl -fsS --max-time 30 " + shlex.quote("http://127.0.0.1:8080" + path)]
    result = subprocess.run(cmd, check=True, capture_output=True, text=True, timeout=50)
    return json.loads(result.stdout)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--date", default=datetime.now(ZoneInfo("Asia/Shanghai")).date().isoformat())
    parser.add_argument("--min-year", type=int, help="default: posting year minus one")
    parser.add_argument("--ssh-host", default="root@8.134.173.91")
    parser.add_argument("--identity", default="~/.ssh/aliyun_movieupdate")
    args = parser.parse_args()
    date.fromisoformat(args.date)
    peek = fetch_api("/api/peek", args)
    if peek.get("success") is not True or not isinstance(peek.get("data"), list):
        raise RuntimeError("peek returned an unsuccessful response")
    rows = peek["data"]
    titles = list(dict.fromkeys(row["title"] for row in rows if str(row.get("posted_at", ""))[:10] == args.date))
    def fetch_detail(title):
        return title, fetch_api("/api/movie_detail?" + urlencode({"title": title}), args)
    with ThreadPoolExecutor(max_workers=3) as pool:
        details = dict(pool.map(fetch_detail, titles))
    data_dir = ROOT / "src" / "data"
    catalog, news, report = plan_ingest(rows, details, data_dir, args.date, args.min_year or int(args.date[:4]) - 1)
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

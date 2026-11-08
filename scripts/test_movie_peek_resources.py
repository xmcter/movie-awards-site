#!/usr/bin/env python3
"""Offline importer regression tests: python3 scripts/test_movie_peek_resources.py"""
import copy
import json
from pathlib import Path
from tempfile import TemporaryDirectory
import unittest

from ingest_movie_peek_resources import (
    FETCH_RETRIES,
    FetchFailed,
    call_with_retries,
    load_details,
    localize_poster_plan,
    plan_ingest,
    weibo_url,
)

DAY = "2026-11-06"
ROW = {"title": "测试电影", "posted_at": DAY + " 18:00:00"}
DETAIL = {
    "success": True,
    "meta": {"title": "测试电影", "douban_id": "123456", "year": "2026",
             "genres": ["剧情"], "directors": ["测试导演"], "actors": ["演员"],
             "intro": "剧情简介", "durations": ["110分钟"]},
    "links": [{"status": "valid", "provider": "quark", "title": "测试电影 官中",
               "weibo_url": "https://m.weibo.cn/detail/ABC123?from=feed",
               "url": "https://pan.quark.cn/s/SHOULD_NOT_EXPORT", "passcode": "SECRET-CODE-ZXY9"}],
}


class ImporterTests(unittest.TestCase):
    def setUp(self):
        self.temp = TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.data = Path(self.temp.name)
        (self.data / "auteur-news.json").write_text("[]")
        (self.data / "films.json").write_text("[]")
        self.detail = copy.deepcopy(DETAIL)

    def plan(self, rows=None, details=None):
        return plan_ingest(rows or [ROW], details or {ROW["title"]: self.detail}, self.data, DAY, 2025)

    def persist(self, catalog, news):
        (self.data / "movie-peek-catalog.json").write_text(json.dumps(catalog))
        (self.data / "auteur-news.json").write_text(json.dumps(news))

    def test_import_and_no_resource_secrets(self):
        catalog, news, report = self.plan()
        self.assertEqual((report["films_added"], report["news_added"]), (1, 1))
        self.assertEqual(catalog["films"][0]["runtime"], 110)
        self.assertEqual(news[0]["date"], DAY)
        self.assertEqual(news[0]["weiboUrl"], "https://m.weibo.cn/detail/ABC123")
        self.assertEqual(news[0]["sourceLabel"], "片库·微博")
        self.assertEqual(news[0]["source"], "https://m.weibo.cn/detail/ABC123")
        self.assertEqual(news[0]["sourcePublishedAt"], DAY + "T18:00:00+08:00")
        self.assertEqual(news[0]["publishedAt"], DAY + "T18:00:00+08:00")
        self.assertEqual(news[0]["detail"], "")
        self.assertEqual(news[0]["summary"], "《测试电影》已出源")
        self.assertNotIn("片库已收录", news[0]["summary"])
        self.assertNotIn("片库已收录", news[0]["detail"])
        self.assertNotIn("片库新增", news[0]["detail"])
        for hidden in ["找资源", "movie.readcine.com", "登录", "片库已收录"]:
            self.assertNotIn(hidden, news[0]["detail"])
        exported = json.dumps([catalog, news], ensure_ascii=False)
        for secret in ["pan.quark", "SHOULD_NOT_EXPORT", "passcode", "SECRET-CODE-ZXY9"]:
            self.assertNotIn(secret, exported)

    def test_idempotent_across_runs_and_source_aliases(self):
        catalog, news, _ = self.plan()
        self.persist(catalog, news)
        row = {**ROW, "title": "不同资源帖名称"}
        again_catalog, again_news, report = self.plan([row], {row["title"]: self.detail})
        self.assertEqual(report["news_added"], 0)
        self.assertEqual((again_catalog, again_news), (catalog, news))

    def test_preserves_existing_catalog_film(self):
        (self.data / "films.json").write_text(json.dumps([{"id": "canonical", "title": "测试电影", "year": 2026}]))
        catalog, news, report = self.plan()
        self.assertEqual(report["films_added"], 0)
        self.assertEqual(catalog["films"], [])
        self.assertEqual(news[0]["filmId"], "canonical")

    def test_backfills_existing_resource_notice(self):
        (self.data / "auteur-news.json").write_text(json.dumps([{"id": "old", "filmId": "movie-douban-123456", "summary": "出资源", "date": DAY}]))
        _, news, report = self.plan()
        self.assertEqual(report["news_added"], 0)
        self.assertEqual(report["weibo_backfilled"], 1)
        self.assertIn("weiboUrl", news[0])

    def test_skip_unknown_metadata_old_doc_series_invalid_links(self):
        cases = [
            ("douban_id", ""), ("year", ""), ("year", "1999"),
            ("genres", ["纪录片"]), ("genres", ["TV series"]),
        ]
        for key, value in cases:
            with self.subTest(key=key, value=value):
                self.detail = copy.deepcopy(DETAIL)
                self.detail["meta"][key] = value
                catalog, news, report = self.plan()
                self.assertEqual((catalog["films"], news), ([], []))
                self.assertEqual(len(report["skipped"]), 1)
        self.detail = copy.deepcopy(DETAIL)
        self.detail["links"][0]["status"] = "invalid"
        self.assertEqual(self.plan()[2]["news_added"], 0)

    def test_skip_english_only_but_allow_verified_chinese(self):
        row = {**ROW, "title": "测试电影 英字"}
        detail = copy.deepcopy(DETAIL)
        detail["links"][0]["title"] = "测试电影 英字"
        self.assertEqual(self.plan([row], {row["title"]: detail})[2]["news_added"], 0)
        detail["links"][0]["title"] = "测试电影 内封简繁"
        self.assertEqual(self.plan([row], {row["title"]: detail})[2]["news_added"], 1)

    def test_skip_other_posting_date(self):
        row = {**ROW, "posted_at": "2026-11-05 18:00:00"}
        self.assertEqual(self.plan([row])[2]["news_added"], 0)

    def test_weibo_allowlist(self):
        for url in [None, "javascript:alert(1)", "https://evil.com/", "https://weibo.com.evil.com/x", "https://a:b@m.weibo.cn/detail/x", "https://m.weibo.cn:444/x", "https://m.weibo.cn/"]:
            with self.subTest(url=url):
                self.assertIsNone(weibo_url(url))
        self.assertEqual(weibo_url("https://weibo.com/123/abc"), "https://weibo.com/123/abc")

    def _stored_film(self, poster):
        meta = self.detail["meta"]
        return {
            "id": "movie-douban-123456",
            "title": "测试电影",
            "year": 2026,
            "synopsis": meta["intro"],
            "directors": list(meta["directors"]),
            "cast": list(meta["actors"]),
            "genres": list(meta["genres"]),
            "country": [],
            "streaming": ["keep-me"],
            "poster": poster,
            "runtime": 110,
        }

    def test_local_poster_survives_remote_merge(self):
        for remote in (
            "https://image.tmdb.org/t/p/w500/abc.jpg",
            "https://img9.doubanio.com/view/photo/m_ratio_poster/public/p1.jpg",
        ):
            with self.subTest(remote=remote):
                self.detail = copy.deepcopy(DETAIL)
                existing = self._stored_film("/posters/movie-douban-123456.jpg")
                self.persist({"films": [existing], "ceremonies": []}, [])
                self.detail["meta"]["poster"] = remote
                catalog, _, report = self.plan()
                self.assertEqual(catalog["films"][0]["poster"], "/posters/movie-douban-123456.jpg")
                self.assertEqual(catalog["films"][0]["streaming"], ["keep-me"])
                self.assertEqual(report["films_updated"], 0)

    def test_remote_poster_can_replace_remote_poster(self):
        existing = self._stored_film("https://img1.doubanio.com/view/photo/old.jpg")
        self.persist({"films": [existing], "ceremonies": []}, [])
        self.detail["meta"]["poster"] = "https://image.tmdb.org/t/p/w500/abc.jpg"
        catalog, _, report = self.plan()
        self.assertEqual(catalog["films"][0]["poster"], "https://image.tmdb.org/t/p/w500/abc.jpg")
        self.assertEqual(report["films_updated"], 1)

    def test_poster_plan_lists_douban_and_tmdb(self):
        films = [
            {"id": "a", "title": "甲", "poster": "https://img9.doubanio.com/view/photo/a.jpg"},
            {"id": "b", "title": "乙", "poster": "https://image.tmdb.org/t/p/w500/b.jpg"},
            {"id": "c", "title": "丙", "poster": "/posters/c.jpg"},
            {"id": "d", "title": "丁", "poster": "https://evil.example/x.jpg"},
        ]
        targets = localize_poster_plan(films)
        self.assertEqual([item["filmId"] for item in targets], ["a", "b"])
        self.assertEqual(targets[0]["remote"], films[0]["poster"])
        self.assertEqual(targets[0]["local"], "/posters/a.jpg")
        self.assertEqual(targets[1]["title"], "乙")
        self.assertEqual(targets[1]["local"], "/posters/b.jpg")

    def test_detail_fetch_failure_is_skipped_without_import(self):
        catalog, news, report = plan_ingest(
            [ROW], {}, self.data, DAY, 2025, failed_detail_titles={ROW["title"]},
        )
        self.assertEqual(catalog["films"], [])
        self.assertEqual(news, [])
        self.assertEqual(report["skipped"], [{"title": ROW["title"], "reason": "detail fetch failed"}])

    def test_retries_twice_then_raises(self):
        calls = {"n": 0}

        def boom():
            calls["n"] += 1
            raise OSError("ssh down")

        with self.assertRaises(FetchFailed) as caught:
            call_with_retries(boom, retries=FETCH_RETRIES)
        self.assertEqual(calls["n"], FETCH_RETRIES + 1)
        self.assertEqual(caught.exception.attempts, FETCH_RETRIES + 1)
        self.assertIn("ssh down", caught.exception.message)

    def test_retry_returns_after_a_later_success(self):
        calls = {"n": 0}

        def flaky():
            calls["n"] += 1
            if calls["n"] < 2:
                raise OSError("temporary")
            return {"ok": True}

        self.assertEqual(call_with_retries(flaky, retries=FETCH_RETRIES), {"ok": True})
        self.assertEqual(calls["n"], 2)

    def test_one_film_failure_does_not_drop_the_batch(self):
        def fetch(title):
            if title == "坏":
                raise FetchFailed("ssh/curl timed out", FETCH_RETRIES + 1)
            return {"success": True, "title": title}

        details, failures = load_details(["好", "坏", "也好"], fetch)
        self.assertEqual(set(details), {"好", "也好"})
        self.assertEqual(failures, [{"title": "坏", "error": "ssh/curl timed out", "attempts": FETCH_RETRIES + 1}])


if __name__ == "__main__":
    unittest.main()

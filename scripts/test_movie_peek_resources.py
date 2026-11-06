#!/usr/bin/env python3
"""Offline importer regression tests: python3 scripts/test_movie_peek_resources.py"""
import copy
import json
from pathlib import Path
from tempfile import TemporaryDirectory
import unittest

from ingest_movie_peek_resources import plan_ingest, weibo_url

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
        self.assertIn("「微博」入口", news[0]["detail"])
        self.assertEqual(news[0]["summary"], "《测试电影》出资源")
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


if __name__ == "__main__":
    unittest.main()

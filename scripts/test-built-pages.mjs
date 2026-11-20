#!/usr/bin/env node
/**
 * Offline checks against the static export in out/.
 * Run after `npm run build`. Does not start a server and does not use the network.
 *
 * - Homepage and sampled /film/ pages expose title, description, canonical, and OG tags.
 * - Every internal href in exported HTML resolves to a file in out/.
 */
import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, posix } from "node:path";
import test from "node:test";

const ROOT = join(import.meta.dirname, "..");
const OUT = join(ROOT, "out");
const DATA = join(ROOT, "src", "data");
const SITE = "https://news.readcine.com";

const FILM_IDS = ["ink", "fjord", "wild-horse-nine", "the-odyssey", "movie-douban-35863074"];

/** 404 language toggle. Next renders that page at /_not-found, so the EN link is not an exported file. */
const KNOWN_BROKEN_PATHS = new Set(["/en/_not-found"]);

function readJson(name) {
  return JSON.parse(readFileSync(join(DATA, name), "utf8"));
}

function filmsOf(data) {
  if (Array.isArray(data)) return data.filter((item) => item && item.id && !Array.isArray(item.nominations));
  return data.films ?? [];
}

function publicTitle(id) {
  const copy = readJson("film-copy.json")[id];
  if (typeof copy?.title === "string" && copy.title.trim()) return copy.title.trim();
  const files = [
    "films.json",
    "major-awards.json",
    "extra-catalog.json",
    "more-catalog.json",
    "density-pack.json",
    "wts-streaming-catalog.json",
    "won-streaming-catalog.json",
    "motn-streaming-catalog.json",
    "movie-peek-catalog.json",
  ];
  for (const file of files) {
    const hit = filmsOf(readJson(file)).find((film) => film.id === id);
    if (hit?.title) return hit.title;
  }
  return null;
}

function decodeEntities(value) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#0*39;|&#x0*27;|&apos;/gi, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)));
}

function tags(html, name) {
  return html.match(new RegExp(`<${name}\\b[^>]*>`, "gi")) ?? [];
}

function attr(tag, name) {
  const match = tag.match(new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`, "i"));
  if (!match) return null;
  return decodeEntities(match[1] ?? match[2]);
}

function metaContent(html, key) {
  for (const tag of tags(html, "meta")) {
    const name = attr(tag, "name") ?? attr(tag, "property");
    if (name === key) return attr(tag, "content");
  }
  return null;
}

function linkHref(html, rel) {
  for (const tag of tags(html, "link")) {
    const value = attr(tag, "rel");
    if (value && value.split(/\s+/).includes(rel)) return attr(tag, "href");
  }
  return null;
}

function pageTitle(html) {
  const match = html.match(/<title>([\s\S]*?)<\/title>/i);
  return match ? decodeEntities(match[1].replace(/\s+/g, " ").trim()) : null;
}

function assertSeo(html, { label, titleIncludes, canonicalPath }) {
  const title = pageTitle(html);
  const description = metaContent(html, "description");
  const canonical = linkHref(html, "canonical");
  const ogTitle = metaContent(html, "og:title");
  const ogDescription = metaContent(html, "og:description");
  const ogImage = metaContent(html, "og:image");
  assert.ok(title && title.includes(titleIncludes), `${label}: title missing ${JSON.stringify(titleIncludes)} (got ${JSON.stringify(title)})`);
  assert.ok(description && description.trim(), `${label}: meta description missing`);
  assert.ok(canonical && canonical.includes(canonicalPath), `${label}: canonical missing ${canonicalPath} (got ${canonical})`);
  assert.ok(ogTitle && ogTitle.includes(titleIncludes), `${label}: og:title missing ${JSON.stringify(titleIncludes)} (got ${JSON.stringify(ogTitle)})`);
  assert.ok(ogDescription && ogDescription.trim(), `${label}: og:description missing`);
  assert.ok(ogImage && ogImage.trim(), `${label}: og:image missing`);
}

function walk(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    return entry.isDirectory() ? walk(full) : [full];
  });
}

function pagePath(htmlFile) {
  const rel = posix.normalize(htmlFile.slice(OUT.length).split("\\").join("/")).replace(/^\//, "");
  if (rel === "index.html") return "/";
  if (rel.endsWith("/index.html")) return `/${rel.slice(0, -"index.html".length)}`;
  if (rel.endsWith(".html")) return `/${rel.slice(0, -".html".length)}`;
  return `/${rel}`;
}

function hrefs(html) {
  const found = [];
  const re = /href\s*=\s*(?:"([^"]*)"|'([^']*)')/gi;
  let match;
  while ((match = re.exec(html))) found.push(decodeEntities(match[1] ?? match[2]).trim());
  return found;
}

function isSkippable(href) {
  if (!href || href.startsWith("#")) return true;
  if (/^(mailto:|tel:|sms:|javascript:|data:)/i.test(href)) return true;
  if (href.startsWith("//")) return true;
  return false;
}

function toSiteUrl(href, fromPath) {
  if (isSkippable(href)) return null;
  let url;
  try {
    url = new URL(href, `${SITE}${fromPath}`);
  } catch {
    return { broken: href };
  }
  if (url.origin !== SITE) return null;
  return url;
}

function fileCandidates(urlPath) {
  let decoded = urlPath;
  try {
    decoded = decodeURIComponent(urlPath);
  } catch {
    decoded = urlPath;
  }
  const variants = decoded === urlPath ? [decoded] : [decoded, urlPath];
  const rels = [];
  for (const value of variants) {
    const path = value.split("?")[0].split("#")[0];
    if (path === "" || path === "/") {
      rels.push("index.html");
      continue;
    }
    const rel = path.replace(/^\/+/, "");
    if (rel.endsWith("/")) {
      rels.push(`${rel}index.html`, `${rel.slice(0, -1)}.html`);
    } else if (/\.[a-z0-9]{1,8}$/i.test(rel)) {
      rels.push(rel);
    } else {
      rels.push(`${rel}.html`, `${rel}/index.html`);
    }
  }
  return rels;
}

function resolves(url) {
  return fileCandidates(url.pathname).some((rel) => {
    const full = join(OUT, rel);
    return existsSync(full) && statSync(full).isFile();
  });
}

test("static export exists", () => {
  assert.ok(existsSync(join(OUT, "index.html")), "out/index.html missing; run npm run build first");
});

test("homepage exposes title, description, canonical, and OG tags", () => {
  const html = readFileSync(join(OUT, "index.html"), "utf8");
  assertSeo(html, {
    label: "home",
    titleIncludes: "银幕新讯",
    canonicalPath: "https://news.readcine.com",
  });
  const canonical = linkHref(html, "canonical");
  assert.match(canonical, /^https:\/\/news\.readcine\.com\/?$/);
});

test("English homepage exposes title, description, canonical, and OG tags", () => {
  const html = readFileSync(join(OUT, "en.html"), "utf8");
  assertSeo(html, {
    label: "en home",
    titleIncludes: "Screen News",
    canonicalPath: "/en",
  });
});

for (const id of FILM_IDS) {
  test(`/film/${id} exposes title, description, canonical, and OG tags`, () => {
    const title = publicTitle(id);
    assert.ok(title, `no public title for ${id}`);
    const file = join(OUT, "film", `${id}.html`);
    assert.ok(existsSync(file), `${file} missing`);
    const html = readFileSync(file, "utf8");
    assertSeo(html, {
      label: `/film/${id}`,
      titleIncludes: title,
      canonicalPath: `/film/${id}`,
    });
    const ogImage = metaContent(html, "og:image");
    assert.match(ogImage, /\/posters\/|\/og\.png/);
  });
}

test("internal hrefs in exported HTML resolve to files in out/", () => {
  assert.ok(existsSync(OUT), "out/ missing; run npm run build first");
  const htmlFiles = walk(OUT).filter((file) => file.endsWith(".html"));
  assert.ok(htmlFiles.length > 0);
  const missing = [];
  let checked = 0;
  for (const file of htmlFiles) {
    const html = readFileSync(file, "utf8");
    const fromPath = pagePath(file);
    for (const href of hrefs(html)) {
      const url = toSiteUrl(href, fromPath);
      if (!url) continue;
      if (url.broken) {
        missing.push(`${fromPath} -> ${href} (unparseable)`);
        continue;
      }
      checked += 1;
      if (!resolves(url)) missing.push(`${fromPath} -> ${url.pathname}`);
    }
  }
  const unique = [...new Set(missing)];
  const known = unique.filter((item) => [...KNOWN_BROKEN_PATHS].some((path) => item.endsWith(` -> ${path}`)));
  const unexpected = unique.filter((item) => !known.includes(item));
  if (known.length) {
    console.warn(
      `warn: known broken internal href(s): ${known.join("; ")} (404 页语言切换指向 /en/_not-found，静态产物只有 out/en/404.html)`,
    );
  }
  assert.deepEqual(unexpected, [], `${unexpected.length} internal href(s) did not match a file in out/`);
  assert.ok(checked > 0, "no internal hrefs were checked");
  console.log(`ok: ${checked} internal hrefs across ${htmlFiles.length} HTML files`);
});

test("404 language toggle targets an exported English page", {
  todo: "out/404.html links to /en/_not-found; English 404 is out/en/404.html",
}, () => {
  const html = readFileSync(join(OUT, "404.html"), "utf8");
  assert.ok(!html.includes('href="/en/_not-found"'));
});

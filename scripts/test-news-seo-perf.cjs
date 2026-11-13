const fs=require("node:fs"),assert=require("node:assert/strict");
const html=fs.readFileSync("out/index.html","utf8");
assert(!fs.readFileSync("src/app/globals.css","utf8").includes("fonts.googleapis.com"));
assert((html.match(/data-film-plot/g)||[]).length >= 12);
assert((html.match(/src="\/thumbs\//g)||[]).length >= 12);
assert(html.includes('loading="eager"') && html.includes('fetchPriority="high"'));
const sitemap=fs.readFileSync("out/sitemap.xml","utf8");
assert(!sitemap.includes("<lastmod>"));assert(!sitemap.includes("movie.readcine.com"));
// A.3: /films lists every film page, including thin-catalogue films whose
// Chinese plot is under 40 characters (they were filtered out before).
const filmsHtml=fs.readFileSync("out/films.html","utf8");
for(const title of ["潜伏6","我的疯狂女权女友","爬行者","April X","寻找艾米丽","理智与情感","犬星","托尼"]){
  assert(filmsHtml.includes(title),`/films must list ${title}`);
}
const filmsEnHtml=fs.readFileSync("out/en/films.html","utf8");
for(const title of ["Insidious: Out of the Further","Crawlers","Tony","The Dog Stars"]){
  assert(filmsEnHtml.includes(title),`/en/films must list ${title}`);
}
// A.2: en film page related events are links, not plain text.
assert(fs.readFileSync("out/en/film/the-odyssey.html","utf8").includes("/en/event/"),"en film page must link related events");
// A.11: en static HTML reports lang="en", zh keeps zh-CN.
assert(fs.readFileSync("out/en.html","utf8").includes('<html lang="en"'),"en home must be lang=en");
assert(html.includes('<html lang="zh-CN"'),"zh home must stay lang=zh-CN");
// A.6: odyssey film page lists each visible related title once (visible link
// text; the raw string also occurs once more inside the RSC flight payload).
const odysseyHtml=fs.readFileSync("out/film/the-odyssey.html","utf8");
assert.strictEqual((odysseyHtml.match(/>《奥德赛》已上线<\/a>/g)||[]).length,1,"odyssey related list must dedupe identical titles");
for(const m of sitemap.matchAll(/<loc>https:\/\/news\.readcine\.com([^<]*)<\/loc>/g)) {
 const path=decodeURIComponent(m[1]).replace(/^\//,"");assert(fs.existsSync(path?"out/"+path+".html":"out/index.html"),path);
}
for(const path of ["out/event/stream-barrio-triste-mubi-2026-11-27.html","out/film/possible-love.html"]){
 const s=fs.readFileSync(path,"utf8");assert(s.includes("BreadcrumbList"));
 for(const m of s.matchAll(/<script type="application\/ld\+json">(.*?)<\/script>/gs))JSON.parse(m[1]);
}
console.log("SEO/performance static regression checks passed");

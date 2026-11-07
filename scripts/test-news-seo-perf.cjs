const fs=require("node:fs"),assert=require("node:assert/strict");
const html=fs.readFileSync("out/index.html","utf8");
assert(!fs.readFileSync("src/app/globals.css","utf8").includes("fonts.googleapis.com"));
assert.equal((html.match(/data-film-plot/g)||[]).length,12);
assert.equal((html.match(/src="\/thumbs\//g)||[]).length,12);
assert(html.includes('loading="eager"') && html.includes('fetchPriority="high"'));
const sitemap=fs.readFileSync("out/sitemap.xml","utf8");
assert(!sitemap.includes("<lastmod>"));assert(!sitemap.includes("movie.readcine.com"));
for(const m of sitemap.matchAll(/<loc>https:\/\/news\.readcine\.com([^<]*)<\/loc>/g)) {
 const path=decodeURIComponent(m[1]).replace(/^\//,"");assert(fs.existsSync(path?"out/"+path+".html":"out/index.html"),path);
}
for(const path of ["out/event/stream-barrio-triste-mubi-2026-11-27.html","out/film/possible-love.html"]){
 const s=fs.readFileSync(path,"utf8");assert(s.includes("BreadcrumbList"));
 for(const m of s.matchAll(/<script type="application\/ld\+json">(.*?)<\/script>/gs))JSON.parse(m[1]);
}
console.log("SEO/performance static regression checks passed");

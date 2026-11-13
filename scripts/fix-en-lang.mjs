// Static export renders every page from the single root layout, so /en pages
// ship with <html lang="zh-CN">. Rewrite the English output to lang="en"
// after build (LangSync already fixes it client-side on hydration; this fixes
// the static HTML that crawlers and screen readers see first).
// Runs automatically as `postbuild` after `npm run build`.
import fs from "node:fs";
import path from "node:path";

const outDir = path.join(process.cwd(), process.argv[2] || "out");

function walk(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)],
  );
}

// /en home is out/en.html; the rest lives under out/en/.
const files = [...walk(path.join(outDir, "en")), path.join(outDir, "en.html")].filter(
  (f) => f.endsWith(".html"),
);

let changed = 0;
for (const file of files) {
  if (!fs.existsSync(file)) continue;
  const html = fs.readFileSync(file, "utf8");
  if (!html.includes('<html lang="zh-CN"')) continue;
  fs.writeFileSync(file, html.replace('<html lang="zh-CN"', '<html lang="en"'));
  changed++;
}
console.log(`fix-en-lang: ${changed} file(s) rewritten to lang="en"`);

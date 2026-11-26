import fs from "node:fs";
import path from "node:path";

const src = "src/data/auteur-news.json";
const dest = "public/auteur-news.json";
const text = fs.readFileSync(src, "utf8");
const blocked = /quark|夸克|magnet:|ed2k:|thunder:|pan\.baidu|aliyundrive|alipan|115\.com\/s\/|网盘|迅雷/i;
if (blocked.test(text)) {
  console.error("refusing to publish auteur-news.json: blocked download/netdisk pattern detected");
  process.exit(1);
}
JSON.parse(text);
fs.mkdirSync(path.dirname(dest), { recursive: true });
fs.copyFileSync(src, dest);
console.log(`Published ${dest} (${fs.statSync(dest).size} bytes)`);

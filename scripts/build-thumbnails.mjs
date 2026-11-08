import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const input = 'public/posters';
const output = 'public/thumbs';
const manifestPath = path.join('scripts', 'cache', 'thumbnail-hashes.json');

await fs.mkdir(output, { recursive: true });
await fs.mkdir(path.dirname(manifestPath), { recursive: true });

let previous = {};
try {
  previous = JSON.parse(await fs.readFile(manifestPath, 'utf8'));
} catch (error) {
  if (error?.code !== 'ENOENT') throw error;
}

const next = {};
let built = 0;
let skipped = 0;

// 同主文件名的 jpg/png/webp 会写成同一张 public/thumbs/<name>.webp。
// 旧脚本按 readdir 顺序逐张覆盖，最后一张才是产物。只对这张做 mtime/hash。
const winnerByDest = new Map();
for (const file of await fs.readdir(input)) {
  if (!/\.(jpe?g|png|webp)$/i.test(file)) continue;
  winnerByDest.set(`${path.parse(file).name}.webp`, file);
}

for (const [destName, file] of winnerByDest) {
  const srcPath = path.join(input, file);
  const destPath = path.join(output, destName);
  const srcBuf = await fs.readFile(srcPath);
  const hash = createHash('sha256').update(srcBuf).digest('hex');
  const srcStat = await fs.stat(srcPath);
  let destStat = null;
  try {
    destStat = await fs.stat(destPath);
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
  }
  const destReady = Boolean(destStat && destStat.size > 0);
  const stored = previous[destName];
  const storedHash = typeof stored === 'string' ? stored : stored?.hash;
  const hashHit = destReady && storedHash === hash;
  // 没有记录过的旧缩略图：胜出源图的 mtime 不比产物新，就当作没变，只补 hash。
  const mtimeHit = destReady && storedHash == null && destStat.mtimeMs >= srcStat.mtimeMs;
  if (hashHit || mtimeHit) {
    next[destName] = hash;
    skipped += 1;
    continue;
  }
  await sharp(srcBuf)
    .rotate()
    .resize({ width: 168, height: 252, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 75 })
    .toFile(destPath);
  next[destName] = hash;
  built += 1;
}

const ordered = Object.fromEntries(Object.keys(next).sort().map((key) => [key, next[key]]));
await fs.writeFile(manifestPath, `${JSON.stringify(ordered, null, 2)}\n`);
console.log(
  `Local poster thumbnails ready (168×252 max, WebP): built ${built}, skipped ${skipped} unchanged (mtime/hash)`,
);

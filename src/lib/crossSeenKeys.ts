/**
 * 跨站「已看」匹配 token（纯函数，服务端 / 客户端通用）。
 * 与 movie 端 /opt/movieupdate/web/js/cross-seen.js 算法一致，改一边要同步另一边。
 */

export interface SeenFilm {
  id?: string;
  title?: string;
  titleEn?: string;
  year?: number | string;
  doubanId?: string;
}

export interface SeenRecord {
  site: string;
  item_id: string;
  title?: string;
  title_en?: string;
  year?: string;
  douban_id?: string;
}

const CJK = /[\u3040-\u30ff\u3400-\u9fff\uf900-\ufaff\uac00-\ud7af]/;

function norm(s: string): string {
  let v = String(s || "");
  try {
    v = v.normalize("NFKC");
  } catch {
    /* ignore */
  }
  return v.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");
}

function titleKeys(title?: string): string[] {
  const out: string[] = [];
  const raw = String(title || "").replace(/[\u200B-\u200D\u2060\uFEFF]/g, "").trim();
  if (!raw) return out;
  const words = raw.split(/\s+/);
  const cjk = words.filter((w) => CJK.test(w)).join("");
  const rest = words.filter((w) => !CJK.test(w)).join("");
  for (const p of [raw, cjk, rest]) {
    const n = norm(p);
    if (n.length >= 2 && !out.includes(n)) out.push(n);
  }
  return out;
}

function yearOf(y: unknown): number {
  const m = String(y ?? "").match(/\d{4}/);
  return m ? Number(m[0]) : 0;
}

export function doubanIdFromFilmId(id?: string): string {
  const m = String(id || "").match(/^movie-douban-(\d+)$/);
  return m ? m[1]! : "";
}

/** 列表项 token（精确年份），写到 data-rc-fk。服务端渲染也可调用（纯函数）。 */
export function seenTokens(f: SeenFilm): string[] {
  const out: string[] = [];
  const y = yearOf(f.year);
  const d = f.doubanId || doubanIdFromFilmId(f.id);
  if (d && /^\d+$/.test(d)) out.push(`d${d}`);
  for (const k of [...titleKeys(f.title), ...titleKeys(f.titleEn)]) {
    const t = `t${k}_${y || ""}`;
    if (!out.includes(t)) out.push(t);
  }
  return out;
}

/** 已看记录展开成可命中的 token（年份 ±1）。 */
export function matchTokens(r: SeenRecord): string[] {
  const out: string[] = [];
  const y = yearOf(r.year);
  if (r.douban_id && /^\d+$/.test(r.douban_id)) out.push(`d${r.douban_id}`);
  const years: Array<number | ""> = y ? [y - 1, y, y + 1] : [""];
  for (const k of [...titleKeys(r.title), ...titleKeys(r.title_en)]) {
    for (const yy of years) out.push(`t${k}_${yy}`);
  }
  return out;
}


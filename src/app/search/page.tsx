import Link from "next/link";
import type { Metadata } from "next";
import { searchAll } from "@/lib/data";
import SearchForm from "./SearchForm";

export const metadata: Metadata = {
  title: "搜索",
};

interface Props {
  searchParams: Promise<{ q?: string }>;
}

const TYPE_LABELS = {
  film: "影片",
  person: "人物",
  award: "奖项",
};

export default async function SearchPage({ searchParams }: Props) {
  const { q = "" } = await searchParams;
  const results = q ? searchAll(q) : [];

  return (
    <div>
      <h1 className="font-display text-3xl text-cinema-text">搜索</h1>
      <p className="mt-2 text-cinema-muted">
        可搜索影片、人物与奖项 / 典礼名称
      </p>

      <div className="mt-6">
        <SearchForm initialQuery={q} />
      </div>

      {q && (
        <p className="mt-6 text-sm text-cinema-muted">
          「{q}」共 {results.length} 条结果
        </p>
      )}

      <ul className="mt-4 space-y-2">
        {results.map((r) => (
          <li key={`${r.type}-${r.id}`}>
            <Link
              href={r.href}
              className="flex items-start gap-3 rounded-xl border border-cinema-border bg-cinema-card px-4 py-3 transition hover:border-cinema-gold/40"
            >
              <span className="mt-0.5 shrink-0 rounded-full bg-cinema-elevated px-2 py-0.5 text-xs text-cinema-muted">
                {TYPE_LABELS[r.type]}
              </span>
              <div>
                <p className="font-medium text-cinema-text">{r.title}</p>
                {r.subtitle && (
                  <p className="text-sm text-cinema-muted">{r.subtitle}</p>
                )}
              </div>
            </Link>
          </li>
        ))}
      </ul>

      {q && results.length === 0 && (
        <p className="mt-8 text-center text-cinema-muted">
          未找到匹配结果，试试「奥斯卡」「彭于晏」「阿诺拉」
        </p>
      )}

      {!q && (
        <div className="mt-10 rounded-xl border border-dashed border-cinema-border p-8 text-center">
          <p className="text-cinema-muted">输入关键词开始搜索</p>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            {["奥斯卡", "金马", "阿诺拉", "彭于晏", "Netflix"].map((hint) => (
              <Link
                key={hint}
                href={`/search?q=${encodeURIComponent(hint)}`}
                className="rounded-full border border-cinema-border px-3 py-1 text-sm text-cinema-muted hover:text-cinema-gold"
              >
                {hint}
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

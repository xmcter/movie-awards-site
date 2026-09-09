import Link from "next/link";
import type { Metadata } from "next";
import { orgs, getCeremoniesByOrg } from "@/lib/data";
import { formatDate } from "@/lib/labels";

export const metadata: Metadata = {
  title: "奖项一览",
};

export default function AwardsPage() {
  return (
    <div>
      <h1 className="font-display text-3xl text-cinema-text">奖项一览</h1>
      <p className="mt-2 text-cinema-muted">
        奥斯卡、金球、三大电影节与华语三大奖：金马、金像、华表
      </p>

      <div className="mt-8 grid gap-5 sm:grid-cols-2">
        {orgs.map((org) => {
          const list = getCeremoniesByOrg(org.id);
          const latest = list[0];
          return (
            <Link
              key={org.id}
              href={`/awards/${org.id}`}
              className="group rounded-2xl border border-cinema-border bg-cinema-card p-6 transition hover:border-cinema-gold/40"
            >
              <div
                className="mb-4 h-1.5 w-12 rounded-full"
                style={{ backgroundColor: org.accentColor }}
              />
              <h2 className="font-display text-xl text-cinema-text group-hover:text-cinema-gold-light">
                {org.name}
              </h2>
              <p className="mt-1 text-sm text-cinema-muted">{org.nameEn}</p>
              <p className="mt-3 line-clamp-2 text-sm text-cinema-muted">
                {org.description}
              </p>
              {latest && (
                <p className="mt-4 text-xs text-cinema-gold">
                  最新：{latest.name}
                  {latest.date ? ` · ${formatDate(latest.date)}` : ""}
                </p>
              )}
            </Link>
          );
        })}
      </div>
    </div>
  );
}

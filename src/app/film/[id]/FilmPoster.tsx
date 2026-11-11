"use client";

import { useState } from "react";

function initials(title: string): string {
  const trimmed = title.trim();
  if (!trimmed) return "?";
  const latin = trimmed.match(/[A-Za-z]+/g);
  if (latin && latin.length > 0) {
    return latin
      .slice(0, 2)
      .map((word) => word[0]!.toUpperCase())
      .join("");
  }
  return trimmed.slice(0, 2);
}

/** 影片档海报。src 优先 thumb；加载失败先试 fallbackSrc（原图），再失败显示首字母。 */
export default function FilmPoster({
  src,
  fallbackSrc,
  title,
  titleEn,
  colors,
}: {
  src?: string;
  fallbackSrc?: string;
  title: string;
  titleEn?: string;
  colors: readonly string[];
}) {
  const [stage, setStage] = useState<"primary" | "fallback" | "initials">(
    src ? "primary" : "initials",
  );
  const shown = stage === "primary" ? src : stage === "fallback" ? fallbackSrc : undefined;

  return (
    <div
      className="m-4 mr-0 h-[144px] w-[96px] shrink-0 overflow-hidden rounded-md sm:m-5 sm:h-[210px] sm:w-[140px]"
      style={{
        background: colors[0],
        aspectRatio: "2 / 3",
      }}
    >
      {shown ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={shown}
          alt={title}
          width={168}
          height={252}
          decoding="async"
          loading="eager"
          fetchPriority="high"
          className="h-full w-full object-cover object-center"
          onError={() => {
            if (stage === "primary" && fallbackSrc) {
              setStage("fallback");
              return;
            }
            setStage("initials");
          }}
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center font-display text-2xl text-white/80">
          {initials(titleEn || title)}
        </div>
      )}
    </div>
  );
}

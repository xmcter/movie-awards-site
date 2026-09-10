import type { NextConfig } from "next";

const isGhPages = process.env.GITHUB_PAGES === "1";
const basePath = isGhPages ? "/movie-awards-site" : "";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  output: "export",
  basePath,
  assetPrefix: basePath || undefined,
  images: {
    unoptimized: true,
  },
  env: {
    NEXT_PUBLIC_BASE_PATH: basePath,
  },
};

export default nextConfig;

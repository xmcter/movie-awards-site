import type { Metadata } from "next";
import SearchClient from "./SearchClient";

export const metadata: Metadata = {
  title: "搜索",
};

export default function SearchPage() {
  return <SearchClient />;
}

import type { Metadata } from "next";
import EnNotFound from "@/components/EnNotFound";

export const metadata: Metadata = {
  title: "Page not found",
  robots: { index: false, follow: false },
};

export default function NotFoundEn() {
  return <EnNotFound />;
}

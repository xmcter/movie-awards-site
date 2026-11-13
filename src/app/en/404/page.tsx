import type { Metadata } from "next";
import EnNotFound from "@/components/EnNotFound";

/** Static export writes this to out/en/404.html. nginx can serve it as the
 *  /en error page once that file is deployed. See deploy/nginx.conf.example. */
export const metadata: Metadata = {
  title: "Page not found",
  robots: { index: false, follow: false },
};

export default function En404Page() {
  return <EnNotFound />;
}

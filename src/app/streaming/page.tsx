import type { Metadata } from "next";
import StreamingClient from "./StreamingClient";

export const metadata: Metadata = {
  title: "流媒体上线",
};

export default function StreamingPage() {
  return <StreamingClient />;
}

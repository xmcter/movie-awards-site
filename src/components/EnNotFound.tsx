import Link from "next/link";

/** English 404 body. The root not-found stays Chinese. */
export default function EnNotFound() {
  return (
    <div className="py-20 text-center">
      <h1 className="font-display text-3xl text-cinema-text">Page not found</h1>
      <p className="mt-2 text-cinema-muted">Head back to the timeline for the latest streaming dates.</p>
      <Link
        href="/en"
        className="mt-6 inline-block text-cinema-gold hover:text-cinema-gold-light"
      >
        Back to the timeline
      </Link>
    </div>
  );
}

import Link from "next/link";

export default function NotFound() {
  return (
    <div className="py-20 text-center">
      <h1 className="font-display text-3xl text-cinema-text">页面未找到</h1>
      <p className="mt-2 text-cinema-muted">回到时间线看看最新奖讯</p>
      <Link
        href="/"
        className="mt-6 inline-block text-cinema-gold hover:text-cinema-gold-light"
      >
        返回时间线
      </Link>
    </div>
  );
}

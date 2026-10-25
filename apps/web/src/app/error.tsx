"use client";

import Link from "next/link";

export default function ErrorPage({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="auth-page">
      <section className="panel auth-card">
        <p className="eyebrow">Nexus</p>
        <h1>Something went wrong</h1>
        <p>
          We couldn’t load this page. Try again, or return to your workspaces.
        </p>
        <button className="button button-primary" onClick={reset}>
          Try again
        </button>
        <Link href="/workspaces">Your workspaces</Link>
      </section>
    </main>
  );
}

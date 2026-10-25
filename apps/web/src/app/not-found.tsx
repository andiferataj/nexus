import Link from "next/link";

export default function NotFound() {
  return (
    <main className="auth-page">
      <section className="panel auth-card">
        <p className="eyebrow">Nexus</p>
        <h1>Page unavailable</h1>
        <p>This page may have moved, or you may not have access to it.</p>
        <Link className="button button-primary" href="/workspaces">
          Your workspaces
        </Link>
      </section>
    </main>
  );
}

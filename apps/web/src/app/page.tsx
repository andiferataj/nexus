import Link from "next/link";

export default function HomePage() {
  return (
    <main className="landing-shell">
      <header className="landing-header">
        <Link href="/" className="brand">
          <span className="brand-mark">n</span>
          <strong>nexus</strong>
        </Link>
        <nav aria-label="Main navigation">
          <Link href="/demo">Explore demo</Link>
          <Link href="/sign-in">Sign in</Link>
          <Link href="/sign-up" className="button button-primary">
            Create account
          </Link>
        </nav>
      </header>
      <section className="landing-hero">
        <p className="eyebrow">A little clarity. A lot of possibility.</p>
        <h1>
          Good work starts
          <br />
          with a clear workspace.
        </h1>
        <p>
          Bring your clients, projects, tasks, and people together. Give every
          agency its own space, and every person a clear next step.
        </p>
        <div className="landing-actions">
          <Link href="/sign-up" className="button button-primary">
            Start your workspace
          </Link>
          <Link href="/demo" className="button button-secondary">
            Take a look around
          </Link>
        </div>
        <p className="landing-note">
          Already part of a team?{" "}
          <Link href="/sign-in">Sign in to your agency</Link>
        </p>
      </section>
      <section className="landing-features" aria-label="Inside your workspace">
        <article>
          <span>01 / Organize</span>
          <h2>See the whole picture.</h2>
          <p>
            Keep client contacts, project budgets, deadlines, and task progress
            in one place.
          </p>
        </article>
        <article>
          <span>02 / Collaborate</span>
          <h2>Make room for your team.</h2>
          <p>
            Invite colleagues, assign work, and choose the access each person
            needs.
          </p>
        </article>
        <article>
          <span>03 / Stay in the loop</span>
          <h2>Know what’s moving.</h2>
          <p>
            Follow recent activity and receive notifications when work is
            assigned to you.
          </p>
        </article>
      </section>
      <footer className="landing-footer">
        Nexus / One workspace. Clearer work.
      </footer>
    </main>
  );
}

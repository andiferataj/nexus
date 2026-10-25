import { redirect } from "next/navigation";
import { auth } from "../../auth";
import { ActionForm } from "../../components/action-form";
import { safeReturnPath } from "../../lib/form-state";
import { signInAction } from "../actions";

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const returnTo = safeReturnPath((await searchParams).next);
  if ((await auth())?.user?.id) redirect(returnTo);
  return (
    <main className="auth-page">
      <a className="brand" href="/">
        <span className="brand-mark">N</span>
        <span>nexus.</span>
      </a>
      <section className="panel auth-card">
        <p className="eyebrow">YOUR NEXT CHAPTER STARTS HERE</p>
        <h1>Welcome back.</h1>
        <p className="page-description">Sign in to your agency workspace.</p>
        <ActionForm
          action={signInAction}
          label="Sign in"
          pendingLabel="Signing in…"
        >
          <input type="hidden" name="returnTo" value={returnTo} />
          <label>
            Email address
            <input
              name="email"
              type="email"
              autoComplete="email"
              required
              maxLength={254}
            />
          </label>
          <label>
            Password
            <input
              name="password"
              type="password"
              autoComplete="current-password"
              required
              maxLength={128}
            />
          </label>
        </ActionForm>
        <p className="auth-alternative">
          <a href="/forgot-password">Forgot your password?</a>
        </p>
        <p className="auth-alternative">
          New to Nexus?{" "}
          <a href={`/sign-up?next=${encodeURIComponent(returnTo)}`}>
            Create an account
          </a>
        </p>
      </section>
      <a className="auth-demo-link" href="/demo">
        Explore the demo workspace
      </a>
    </main>
  );
}

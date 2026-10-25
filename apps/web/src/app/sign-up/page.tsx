import { redirect } from "next/navigation";
import { auth } from "../../auth";
import { ActionForm } from "../../components/action-form";
import { safeReturnPath } from "../../lib/form-state";
import { registerAction } from "../actions";

export default async function SignUpPage({
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
        <p className="eyebrow">GOOD WORK, TOGETHER</p>
        <h1>Make room for great work.</h1>
        <p className="page-description">
          Create your account, then bring your agency together.
        </p>
        <ActionForm
          action={registerAction}
          label="Create account"
          pendingLabel="Creating your account…"
        >
          <input type="hidden" name="returnTo" value={returnTo} />
          <label>
            Your name
            <input
              name="name"
              autoComplete="name"
              required
              minLength={2}
              maxLength={80}
            />
          </label>
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
              autoComplete="new-password"
              required
              minLength={12}
              maxLength={128}
              aria-describedby="password-hint"
            />
          </label>
          <p className="field-hint" id="password-hint">
            Use 12–128 characters. A long passphrase works well.
          </p>
        </ActionForm>
        <p className="auth-alternative">
          Already have an account?{" "}
          <a href={`/sign-in?next=${encodeURIComponent(returnTo)}`}>Sign in</a>
        </p>
      </section>
    </main>
  );
}

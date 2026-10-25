import Link from "next/link";
import { ActionForm } from "../../components/action-form";
import { requestResetAction } from "../actions";

export default function ForgotPasswordPage() {
  return (
    <main className="auth-page">
      <Link className="brand" href="/">
        <span className="brand-mark">N</span>
        <span>nexus.</span>
      </Link>
      <section className="panel auth-card">
        <p className="eyebrow">A FRESH START</p>
        <h1>Reset your password.</h1>
        <p className="page-description">
          We'll email you a link to choose a new password.
        </p>
        <ActionForm action={requestResetAction} label="Send reset link">
          <label>
            Email address
            <input
              type="email"
              name="email"
              autoComplete="email"
              required
              maxLength={254}
            />
          </label>
        </ActionForm>
        <p className="auth-alternative">
          <Link href="/sign-in">Back to sign in</Link>
        </p>
      </section>
    </main>
  );
}

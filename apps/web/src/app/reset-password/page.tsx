import Link from "next/link";
import { ActionForm } from "../../components/action-form";
import { resetPasswordAction } from "../actions";

export const metadata = {
  title: "Reset your password — Nexus",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const token = (await searchParams).token ?? "";
  return (
    <main className="auth-page">
      <Link className="brand" href="/">
        <span className="brand-mark">N</span>
        <span>nexus.</span>
      </Link>
      <section className="panel auth-card">
        <p className="eyebrow">BACK TO GOOD WORK</p>
        <h1>Choose a new password.</h1>
        <ActionForm action={resetPasswordAction} label="Update password">
          <input type="hidden" name="token" value={token} />
          <label>
            New password
            <input
              name="password"
              type="password"
              autoComplete="new-password"
              minLength={12}
              maxLength={128}
              required
            />
          </label>
        </ActionForm>
        <p className="auth-alternative">
          <Link href="/sign-in">Sign in</Link>
        </p>
      </section>
    </main>
  );
}

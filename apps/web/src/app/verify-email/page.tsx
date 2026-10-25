import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "../../auth";
import { repository } from "@nexus/database";
import { ActionForm } from "../../components/action-form";
import {
  sendVerificationAction,
  verifyEmailAction,
  signOutAction,
} from "../actions";

export const metadata = {
  title: "Verify your email — Nexus",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};
export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const token = (await searchParams).token;
  const session = await auth();
  if (!token && !session?.user?.id) redirect("/sign-in");
  if (
    !token &&
    session?.user?.id &&
    (await repository.transaction((tx) => tx.findUserById(session.user.id)))
      ?.emailVerified
  )
    redirect("/workspaces");
  return (
    <main className="auth-page">
      <Link href="/" className="brand">
        <span className="brand-mark">N</span>nexus.
      </Link>
      <section className="panel auth-card">
        <p className="eyebrow">ONE MORE STEP</p>
        <h1>Verify your email.</h1>
        <p className="page-description">
          Confirm your email address to open your agency workspace.
        </p>
        {token ? (
          <ActionForm action={verifyEmailAction} label="Confirm email address">
            <input type="hidden" name="token" value={token} />
          </ActionForm>
        ) : (
          <ActionForm
            action={sendVerificationAction}
            label="Send verification email"
          >
            <p className="field-hint">
              The link expires in 24 hours. Sending again replaces the previous
              link.
            </p>
          </ActionForm>
        )}
        {session?.user?.id && (
          <form action={signOutAction}>
            <button className="text-button">Sign out</button>
          </form>
        )}
        <p className="auth-alternative">
          <Link href="/sign-in">Sign in</Link>
        </p>
      </section>
    </main>
  );
}

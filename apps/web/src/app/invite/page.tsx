import { AccountHeader } from "../../components/account-header";
import { ActionForm } from "../../components/action-form";
import { requireSession } from "../../lib/server";
import { acceptInvitationAction } from "../actions";

export const runtime = "nodejs";

export default async function InvitePage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const token = (await searchParams).token ?? "";
  const session = await requireSession(`/invite?token=${token}`);
  return (
    <>
      <AccountHeader name={session.user.name} />
      <main className="auth-page invite-page">
        <section className="panel auth-card">
          <p className="eyebrow">THERE’S A PLACE FOR YOU HERE</p>
          <h1>Join your team.</h1>
          <p className="page-description">
            You’re signed in as {session.user.email}. Accept using the email
            address the invitation was sent to.
          </p>
          <ActionForm action={acceptInvitationAction} label="Accept invitation">
            <input type="hidden" name="token" value={token} />
          </ActionForm>
          <p className="auth-alternative">
            <a href="/workspaces">Back to your workspaces</a>
          </p>
        </section>
      </main>
    </>
  );
}

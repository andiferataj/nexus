import { database } from "@nexus/database";
import { billingConfigured } from "../lib/billing";
import { ActionForm } from "./action-form";
import { billingAction } from "../app/actions";

export async function BillingPanel({
  organizationId,
  isOwner,
}: {
  organizationId: string;
  isOwner: boolean;
}) {
  if (!isOwner)
    return (
      <section className="panel account-panel">
        <h2>Billing</h2>
        <p className="page-description">
          Only agency owners can manage billing.
        </p>
      </section>
    );
  if (!billingConfigured())
    return (
      <section className="panel account-panel">
        <h2>Billing is not enabled.</h2>
        <p className="page-description">
          Your workspace is available without a subscription. No payment is
          required on this deployment.
        </p>
      </section>
    );
  const subscription = await database.subscription.findUnique({
    where: { organizationId },
  });
  return (
    <section className="panel account-panel settings-panel">
      <h2>Agency subscription</h2>
      <p className="page-description">
        Status: {subscription?.status ?? "No subscription"}
      </p>
      {subscription?.currentPeriodEnd && (
        <p className="page-description">
          Current period ends{" "}
          {subscription.currentPeriodEnd.toISOString().slice(0, 10)}.
        </p>
      )}
      <p className="page-description">
        Pricing and renewal terms are shown securely by Stripe before you
        confirm a subscription.
      </p>
      <ActionForm
        action={billingAction}
        label={
          subscription &&
          !["canceled", "incomplete_expired"].includes(subscription.status)
            ? "Manage subscription"
            : "View subscription checkout"
        }
      >
        <input type="hidden" name="organizationId" value={organizationId} />
        <input
          type="hidden"
          name="mode"
          value={
            subscription &&
            !["canceled", "incomplete_expired"].includes(subscription.status)
              ? "portal"
              : "checkout"
          }
        />
      </ActionForm>
    </section>
  );
}

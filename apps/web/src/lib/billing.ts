import "server-only";
import { database, repository } from "@nexus/database";
import { requireMembership } from "@nexus/core";
import { DomainError, parseObject } from "@nexus/contracts";

export function billingConfigured(): boolean {
  return Boolean(
    process.env.STRIPE_SECRET_KEY &&
    process.env.STRIPE_PRICE_ID &&
    process.env.STRIPE_WEBHOOK_SECRET,
  );
}

export async function subscriptionRequired(
  organizationId: string,
): Promise<boolean> {
  if (process.env.BILLING_REQUIRED !== "true") return false;
  const subscription = await database.subscription.findUnique({
    where: { organizationId },
  });
  return !subscription || !["active", "trialing"].includes(subscription.status);
}

export async function requireWorkspaceWrite(
  actor: { userId: string },
  organizationId: string,
): Promise<void> {
  if (process.env.BILLING_REQUIRED !== "true") return;
  await repository.transaction((tx) =>
    requireMembership(tx, actor, organizationId),
  );
  if (await subscriptionRequired(organizationId))
    throw new DomainError(
      "FORBIDDEN",
      "An active agency subscription is required to add or change work. An agency owner can manage the subscription in Billing.",
    );
}

export async function stripeRequest(
  path: string,
  fields?: Record<string, string>,
  idempotencyKey?: string,
) {
  const secret = process.env.STRIPE_SECRET_KEY;
  if (!secret) throw new Error("Billing is not configured.");
  const headers: Record<string, string> = { Authorization: `Bearer ${secret}` };
  if (fields) headers["Content-Type"] = "application/x-www-form-urlencoded";
  if (idempotencyKey) headers["Idempotency-Key"] = idempotencyKey;
  const response = await fetch(`https://api.stripe.com/v1/${path}`, {
    method: fields ? "POST" : "GET",
    headers,
    ...(fields ? { body: new URLSearchParams(fields) } : {}),
    cache: "no-store",
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok)
    throw new Error("The billing provider could not complete this request.");
  const body: unknown = await response.json();
  return parseObject(body);
}

function stripeUrl(value: unknown): string {
  if (typeof value !== "string")
    throw new Error("Billing did not return a destination.");
  const url = new URL(value);
  if (
    url.protocol !== "https:" ||
    !["checkout.stripe.com", "billing.stripe.com"].includes(url.hostname)
  )
    throw new Error("Invalid billing destination.");
  return url.toString();
}

export async function billingDestination(
  userId: string,
  organizationId: string,
  mode: "checkout" | "portal",
): Promise<string> {
  if (!billingConfigured())
    throw new DomainError(
      "VALIDATION",
      "Billing is not enabled for this deployment.",
    );
  await repository.transaction((tx) =>
    requireMembership(tx, { userId }, organizationId, ["OWNER"]),
  );
  const organization = await database.organization.findUniqueOrThrow({
    where: { id: organizationId },
    include: { subscription: true },
  });
  const base = new URL(
    `/workspaces/${organizationId}?view=billing`,
    process.env.APP_URL ?? "http://127.0.0.1:3000",
  ).toString();
  let customer = organization.stripeCustomerId;
  if (!customer) {
    const result = await stripeRequest(
      "customers",
      { name: organization.name, "metadata[organizationId]": organizationId },
      `nexus-customer-${organizationId}`,
    );
    if (typeof result.id !== "string")
      throw new Error("Customer creation failed.");
    customer = result.id;
    await database.organization.update({
      where: { id: organizationId },
      data: { stripeCustomerId: customer },
    });
  }
  const subscriptions = await stripeRequest(
    `subscriptions?customer=${encodeURIComponent(customer)}&status=all&limit=100`,
  );
  const active =
    Array.isArray(subscriptions.data) &&
    subscriptions.data.some(
      (item) =>
        item &&
        typeof item === "object" &&
        !["canceled", "incomplete_expired"].includes(
          String((item as Record<string, unknown>).status),
        ),
    );
  if (mode === "portal" || active)
    return stripeUrl(
      (
        await stripeRequest("billing_portal/sessions", {
          customer,
          return_url: base,
        })
      ).url,
    );
  const result = await stripeRequest(
    "checkout/sessions",
    {
      customer,
      mode: "subscription",
      "line_items[0][price]": process.env.STRIPE_PRICE_ID!,
      "line_items[0][quantity]": "1",
      success_url: base,
      cancel_url: base,
      client_reference_id: organizationId,
      "subscription_data[metadata][organizationId]": organizationId,
    },
    `nexus-checkout-${organizationId}-${Math.floor(Date.now() / 1800000)}`,
  );
  return stripeUrl(result.url);
}

export async function processStripeEvent(
  event: Record<string, unknown>,
): Promise<void> {
  if (
    typeof event.id !== "string" ||
    typeof event.type !== "string" ||
    typeof event.created !== "number" ||
    !Number.isSafeInteger(event.created)
  )
    throw new Error("Invalid event.");
  const eventId = event.id,
    eventType = event.type,
    eventCreated = event.created;
  if (!eventType.startsWith("customer.subscription.")) return;
  if (await database.webhookEvent.findUnique({ where: { id: eventId } }))
    return;
  const payload = parseObject(parseObject(event.data).object);
  if (typeof payload.id !== "string" || !/^sub_[a-zA-Z0-9]+$/.test(payload.id))
    throw new Error("Invalid subscription.");
  const current = await stripeRequest(
    `subscriptions/${encodeURIComponent(payload.id)}`,
  );
  if (
    typeof current.customer !== "string" ||
    typeof current.status !== "string"
  )
    throw new Error("Invalid subscription response.");
  const customerId = current.customer,
    subscriptionId = payload.id,
    status = current.status;
  const items =
    current.items && typeof current.items === "object"
      ? (current.items as Record<string, unknown>).data
      : null;
  const first =
    Array.isArray(items) && items[0] && typeof items[0] === "object"
      ? (items[0] as Record<string, unknown>)
      : {};
  const period =
    typeof current.current_period_end === "number"
      ? current.current_period_end
      : first.current_period_end;
  const currentPeriodEnd =
    typeof period === "number" && Number.isFinite(period)
      ? new Date(period * 1000)
      : null;
  await database.$transaction(
    async (tx) => {
      if (await tx.webhookEvent.findUnique({ where: { id: eventId } })) return;
      const organization = await tx.organization.findUnique({
        where: { stripeCustomerId: customerId },
        include: { subscription: true },
      });
      if (
        organization &&
        (!organization.subscription ||
          eventCreated >= organization.subscription.lastEventCreated)
      )
        await tx.subscription.upsert({
          where: { organizationId: organization.id },
          create: {
            organizationId: organization.id,
            stripeSubscriptionId: subscriptionId,
            status,
            currentPeriodEnd,
            lastEventCreated: eventCreated,
          },
          update: {
            stripeSubscriptionId: subscriptionId,
            status,
            currentPeriodEnd,
            lastEventCreated: eventCreated,
          },
        });
      await tx.webhookEvent.create({ data: { id: eventId, type: eventType } });
    },
    { isolationLevel: "Serializable" },
  );
}

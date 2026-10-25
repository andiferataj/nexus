import { isAbsolute } from "node:path";

export function validateProductionEnvironment(env) {
  const failures = [];
  if (!env.UPLOAD_DIR || !isAbsolute(env.UPLOAD_DIR))
    failures.push(
      "UPLOAD_DIR must be an absolute path on persistent private storage.",
    );
  if (
    env.BILLING_REQUIRED === "true" &&
    !["STRIPE_SECRET_KEY", "STRIPE_PRICE_ID", "STRIPE_WEBHOOK_SECRET"].every(
      (field) => env[field]?.trim(),
    )
  )
    failures.push("BILLING_REQUIRED requires complete Stripe configuration.");
  let origin;
  try {
    const url = new URL(env.APP_URL);
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      url.pathname !== "/" ||
      url.search ||
      url.hash ||
      ["localhost", "127.0.0.1"].includes(url.hostname)
    )
      throw new Error();
    origin = url.origin;
  } catch {
    failures.push("APP_URL must be the public HTTPS origin.");
  }
  if (!origin || env.AUTH_URL !== origin)
    failures.push(
      "AUTH_URL must match APP_URL exactly, without a trailing slash.",
    );
  if (
    !env.AUTH_SECRET ||
    env.AUTH_SECRET.length < 48 ||
    /placeholder|change[-_ ]?me|build-only/i.test(env.AUTH_SECRET)
  )
    failures.push(
      "AUTH_SECRET must be a fresh random secret of at least 48 characters.",
    );
  try {
    const url = new URL(env.DATABASE_URL);
    if (
      !["postgres:", "postgresql:"].includes(url.protocol) ||
      !url.hostname ||
      !url.username ||
      !url.password ||
      url.pathname === "/"
    )
      throw new Error();
  } catch {
    failures.push(
      "DATABASE_URL must include PostgreSQL credentials and a database name.",
    );
  }
  for (const fields of [
    ["RESEND_API_KEY", "MAIL_FROM"],
    ["STRIPE_SECRET_KEY", "STRIPE_PRICE_ID", "STRIPE_WEBHOOK_SECRET"],
  ]) {
    const count = fields.filter((field) => env[field]?.trim()).length;
    if (count && count !== fields.length)
      failures.push(
        `Configure all of ${fields.join(", ")}, or leave the entire group empty.`,
      );
  }
  return failures;
}

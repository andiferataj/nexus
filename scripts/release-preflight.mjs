import { existsSync, readFileSync } from "node:fs";
import { parseEnv } from "node:util";
import { fileURLToPath } from "node:url";

export function releasePreflight(root, inherited = process.env) {
  const failures = [];
  function read(path) {
    const file = new URL(path, root);
    if (!existsSync(file)) {
      failures.push(`Missing ${path}; run pnpm setup:env first.`);
      return {};
    }
    return parseEnv(readFileSync(file, "utf8"));
  }
  const compose = { ...read(".env"), ...inherited };
  const migration = { ...read("packages/database/.env"), ...inherited };
  const app = { ...read("apps/web/.env.local"), ...inherited };
  const expected = {
    user: compose.POSTGRES_USER,
    password: compose.POSTGRES_PASSWORD,
    database: compose.POSTGRES_DB,
  };
  for (const [name, env] of [
    ["Migration", migration],
    ["Application", app],
  ]) {
    try {
      const url = new URL(env.DATABASE_URL);
      if (
        !["postgres:", "postgresql:"].includes(url.protocol) ||
        !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) ||
        (url.port && url.port !== "5432") ||
        !expected.user ||
        !expected.password ||
        !expected.database ||
        decodeURIComponent(url.username) !== expected.user ||
        decodeURIComponent(url.password) !== expected.password ||
        decodeURIComponent(url.pathname.slice(1)) !== expected.database ||
        (url.searchParams.get("schema") ?? "public") !== "public"
      )
        throw new Error();
    } catch {
      failures.push(
        `${name} database must match the local Compose database on port 5432. No credentials were printed.`,
      );
    }
  }
  for (const field of ["APP_URL", "AUTH_URL"])
    if (app[field] !== "http://127.0.0.1:3000")
      failures.push(
        `${field} must be http://127.0.0.1:3000 for local acceptance.`,
      );
  if (!app.AUTH_SECRET || app.AUTH_SECRET.length < 32)
    failures.push("Set a local AUTH_SECRET of at least 32 characters.");
  if (
    [
      "RESEND_API_KEY",
      "MAIL_FROM",
      "STRIPE_SECRET_KEY",
      "STRIPE_PRICE_ID",
      "STRIPE_WEBHOOK_SECRET",
    ].some((field) => app[field]?.trim()) ||
    app.BILLING_REQUIRED === "true"
  )
    failures.push(
      "Local acceptance requires email and billing providers disabled. Use a separate environment for provider lifecycle checks.",
    );
  if (inherited.NEXUS_TEST_BASE_URL)
    failures.push(
      "Unset NEXUS_TEST_BASE_URL: release acceptance must start its own local production server.",
    );
  return failures;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const failures = releasePreflight(new URL("../", import.meta.url));
  if (failures.length) {
    console.error(
      `Release configuration needs attention:\n${failures.map((value) => `- ${value}`).join("\n")}`,
    );
    process.exitCode = 1;
  } else
    console.log(
      "Local release configuration is consistent. Database connectivity and browser acceptance still need verification.",
    );
}

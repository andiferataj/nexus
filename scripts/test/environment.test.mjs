import { test } from "node:test";
import assert from "node:assert/strict";
import { validateProductionEnvironment } from "../validate-environment.mjs";

const valid = {
  UPLOAD_DIR: "/app/uploads",
  APP_URL: "https://nexus.test",
  AUTH_URL: "https://nexus.test",
  AUTH_SECRET: "a".repeat(96),
  DATABASE_URL: "postgresql://user:password@database:5432/nexus",
};
test("production refuses unsafe origins, placeholder secrets and incomplete provider configuration", () => {
  assert.deepEqual(validateProductionEnvironment(valid), []);
  for (const change of [
    { APP_URL: "http://nexus.test" },
    { AUTH_URL: "https://other.test" },
    { AUTH_SECRET: "build-only-placeholder" },
    { DATABASE_URL: "postgresql://database/nexus" },
    { RESEND_API_KEY: "configured" },
    { STRIPE_PRICE_ID: "price_configured" },
    { BILLING_REQUIRED: "true" },
  ])
    assert.ok(
      validateProductionEnvironment({ ...valid, ...change }).length > 0,
    );
  assert.deepEqual(
    validateProductionEnvironment({
      ...valid,
      RESEND_API_KEY: "configured",
      MAIL_FROM: "Nexus <hello@nexus.test>",
    }),
    [],
  );
});

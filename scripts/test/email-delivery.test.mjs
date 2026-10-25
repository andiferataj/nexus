import { test } from "node:test";
import assert from "node:assert/strict";
import { encryptEmailJob } from "../../packages/core/dist/index.js";
import { deliverEmailJob } from "../email-delivery.mjs";

test("email retries use the same provider idempotency key and do not acknowledge failures", async () => {
  const env = {
      AUTH_SECRET: "a".repeat(96),
      RESEND_API_KEY: "test-not-real",
      MAIL_FROM: "Nexus <sender@example.com>",
    },
    calls = [];
  const job = {
    id: "job-123",
    ciphertext: encryptEmailJob(
      {
        to: "owner@example.com",
        subject: "Verification",
        text: "Private verification link",
      },
      env.AUTH_SECRET,
    ),
  };
  const send = async (url, options) => {
    calls.push({ url, options });
    return { ok: calls.length > 1 };
  };
  await assert.rejects(deliverEmailJob(job, env, send));
  await deliverEmailJob(job, env, send);
  assert.equal(
    calls[0].options.headers["Idempotency-Key"],
    calls[1].options.headers["Idempotency-Key"],
  );
  assert.equal(
    JSON.parse(calls[1].options.body).text,
    "Private verification link",
  );
  await assert.rejects(deliverEmailJob(job, {}, send));
});

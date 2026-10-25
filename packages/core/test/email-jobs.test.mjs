import { test } from "node:test";
import assert from "node:assert/strict";
import { encryptEmailJob, decryptEmailJob } from "../dist/index.js";

test("email jobs encrypt bearer links and detect tampering, key changes and malformed payloads", () => {
  const secret = "a".repeat(96),
    message = {
      to: "owner@example.com",
      subject: "Reset your password",
      text: `https://nexus.test/reset-password?token=${"b".repeat(64)}`,
    };
  const first = encryptEmailJob(message, secret),
    second = encryptEmailJob(message, secret);
  assert.notEqual(first, second);
  assert.equal(first.includes(message.to), false);
  assert.equal(first.includes("b".repeat(64)), false);
  assert.deepEqual(decryptEmailJob(first, secret), message);
  assert.throws(() => decryptEmailJob(first, "c".repeat(96)));
  const parts = first.split(".");
  parts[2] = "a".repeat(parts[2].length);
  assert.throws(() => decryptEmailJob(parts.join("."), secret));
  assert.throws(() => encryptEmailJob({ ...message, to: "invalid" }, secret));
  assert.throws(() => encryptEmailJob(message, "short"));
});

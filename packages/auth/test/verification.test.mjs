import assert from "node:assert/strict";
import { test } from "node:test";
import {
  requestEmailVerification,
  verifyAccountEmail,
  requestPasswordReset,
} from "../dist/index.js";
import { fixture } from "../../core/test/memory-repository.mjs";

test("verification is one-use, expires and cannot consume a password-reset token", async () => {
  const repo = await fixture(),
    now = new Date("2026-10-23T12:00:00Z");
  let token = "",
    reset = "";
  await requestEmailVerification(
    repo,
    "owner",
    async (_email, value) => {
      token = value;
    },
    now,
  );
  await requestPasswordReset(
    repo,
    "owner@example.com",
    async (_email, value) => {
      reset = value;
    },
    now,
  );
  assert.notEqual(repo.state.resetTokens[0].token, token);
  await assert.rejects(verifyAccountEmail(repo, reset, now));
  await assert.rejects(
    verifyAccountEmail(repo, token, new Date(now.getTime() + 86400000)),
  );
  await verifyAccountEmail(repo, token, now);
  assert.equal(
    repo.state.users
      .find((user) => user.id === "owner")
      .emailVerified.getTime(),
    now.getTime(),
  );
  await assert.rejects(verifyAccountEmail(repo, token, now));
});

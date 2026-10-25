import assert from "node:assert/strict";
import { test } from "node:test";
import {
  registerAccount,
  authenticateAccount,
  requestPasswordReset,
  resetPassword,
} from "../dist/index.js";
import { MemoryRepository } from "../../core/test/memory-repository.mjs";

test("reset links are hashed, single use, and invalidate existing session versions", async () => {
  const repository = new MemoryRepository(),
    deliveries = [];
  await registerAccount(repository, {
    name: "Test User",
    email: "reset@example.com",
    password: "the old long password",
  });
  const now = new Date("2026-10-23T10:00:00Z");
  await requestPasswordReset(
    repository,
    "RESET@example.com",
    async (email, token) => deliveries.push({ email, token }),
    now,
  );
  assert.equal(deliveries.length, 1);
  assert.ok(!JSON.stringify(repository.state).includes(deliveries[0].token));
  await resetPassword(
    repository,
    deliveries[0].token,
    "the new long password",
    now,
  );
  assert.equal(repository.state.users[0].sessionVersion, 1);
  assert.equal(
    await authenticateAccount(
      repository,
      "reset@example.com",
      "the old long password",
      now,
    ),
    null,
  );
  assert.equal(
    (
      await authenticateAccount(
        repository,
        "reset@example.com",
        "the new long password",
        now,
      )
    ).sessionVersion,
    1,
  );
  await assert.rejects(
    resetPassword(
      repository,
      deliveries[0].token,
      "another long password",
      now,
    ),
  );
});

test("requesting again invalidates old tokens and expired/unknown tokens fail closed", async () => {
  const repository = new MemoryRepository(),
    tokens = [],
    now = new Date("2026-10-23T10:00:00Z");
  await registerAccount(repository, {
    name: "Test User",
    email: "reset@example.com",
    password: "a secure long password",
  });
  const deliver = async (_email, token) => {
    tokens.push(token);
  };
  await requestPasswordReset(repository, "unknown@example.com", deliver, now);
  assert.equal(tokens.length, 0);
  await requestPasswordReset(repository, "reset@example.com", deliver, now);
  await requestPasswordReset(repository, "reset@example.com", deliver, now);
  await assert.rejects(
    resetPassword(repository, tokens[0], "another long password", now),
  );
  await assert.rejects(
    resetPassword(
      repository,
      tokens[1],
      "another long password",
      new Date(now.getTime() + 60 * 60 * 1000),
    ),
  );
  assert.equal(repository.state.users[0].sessionVersion, 0);
});

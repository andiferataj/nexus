import assert from "node:assert/strict";
import { test } from "node:test";
import {
  authenticateAccount,
  hashPassword,
  registerAccount,
  verifyPassword,
} from "../dist/index.js";
import { MemoryRepository } from "../../core/test/memory-repository.mjs";

test("password hashes are salted and verify the exact original password", async () => {
  const password = "a sufficiently long password";
  const first = await hashPassword(password);
  const second = await hashPassword(password);
  assert.notEqual(first, second);
  assert.ok(!first.includes(password));
  assert.equal(await verifyPassword(password, first), true);
  assert.equal(await verifyPassword(`${password} `, first), false);
  assert.equal(await verifyPassword("incorrect password", first), false);
});

test("malformed hashes and oversized passwords fail closed", async () => {
  for (const stored of [
    "",
    "plaintext",
    "scrypt-v1$ff$ff",
    "scrypt-v1$" + "a".repeat(32) + "$" + "z".repeat(128),
  ])
    assert.equal(await verifyPassword("password", stored), false);
  await assert.rejects(hashPassword("short"));
  await assert.rejects(hashPassword("a".repeat(129)));
});

test("registration stores no plaintext password and returns only public identity", async () => {
  const repository = new MemoryRepository();
  const user = await registerAccount(repository, {
    name: "Andi Ferataj",
    email: "ANDI@example.com",
    password: "my secure password",
  });
  assert.deepEqual(Object.keys(user).sort(), ["email", "id", "name"]);
  assert.equal(user.email, "andi@example.com");
  assert.ok(!JSON.stringify(repository.state).includes("my secure password"));
  await assert.rejects(
    registerAccount(repository, {
      name: "Another Andi",
      email: "andi@example.com",
      password: "another long password",
    }),
    (error) => error.code === "CONFLICT",
  );
  assert.equal(repository.state.users.length, 1);
  assert.equal(
    (
      await authenticateAccount(
        repository,
        "  ANDI@EXAMPLE.COM ",
        "my secure password",
      )
    ).id,
    user.id,
  );
  assert.equal(
    await authenticateAccount(
      repository,
      "andi@example.com",
      "incorrect password",
    ),
    null,
  );
  assert.equal(
    await authenticateAccount(
      repository,
      "unknown@example.com",
      "my secure password",
    ),
    null,
  );
  assert.equal(
    await authenticateAccount(repository, "not-an-email", "my secure password"),
    null,
  );
});

test("failed sign-ins are limited per normalized email and recover after the window", async () => {
  const repository = new MemoryRepository();
  await registerAccount(repository, {
    name: "Andi Ferataj",
    email: "andi@example.com",
    password: "a good long password",
  });
  const now = new Date("2026-10-22T12:00:00Z");
  for (let attempt = 0; attempt < 10; attempt++)
    assert.equal(
      await authenticateAccount(
        repository,
        "ANDI@example.com",
        "wrong password",
        now,
      ),
      null,
    );
  assert.equal(
    await authenticateAccount(
      repository,
      "andi@example.com",
      "a good long password",
      now,
    ),
    null,
  );
  const later = new Date(now.getTime() + 15 * 60 * 1000);
  assert.equal(
    (
      await authenticateAccount(
        repository,
        "andi@example.com",
        "a good long password",
        later,
      )
    ).email,
    "andi@example.com",
  );
  assert.equal(repository.state.authAttempts.length, 0);
  assert.ok(
    !JSON.stringify(repository.state.authAttempts).includes("andi@example.com"),
  );
});

import assert from "node:assert/strict";
import { test } from "node:test";
import {
  DomainError,
  parseAgency,
  parseInvitation,
  parseRegistration,
} from "../dist/index.js";

test("registration normalizes identity but preserves the password exactly", () => {
  const result = parseRegistration({
    name: "  Andi Ferataj  ",
    email: "  ANDI@EXAMPLE.COM  ",
    password: "  a long password  ",
  });
  assert.equal(result.email, "andi@example.com");
  assert.equal(result.name, "Andi Ferataj");
  assert.equal(result.password, "  a long password  ");
});

test("malformed request shapes and short passwords fail runtime validation", () => {
  for (const input of [
    null,
    [],
    "data",
    {},
    { name: "Andi", email: "andi@example.com", password: "short" },
    { name: "Andi", email: "invalid", password: "a valid password" },
  ]) {
    assert.throws(
      () => parseRegistration(input),
      (error) => error instanceof DomainError && error.code === "VALIDATION",
    );
  }
});

test("agency URL names normalize accents and support a user-provided ASCII slug", () => {
  assert.deepEqual(parseAgency({ name: "Élan Studio" }), {
    name: "Élan Studio",
    slug: "elan-studio",
  });
  assert.equal(
    parseAgency({ name: "東京", slug: "tokyo-studio" }).slug,
    "tokyo-studio",
  );
  for (const slug of [
    "",
    "../other-agency",
    "OTHER",
    "two--hyphens",
    "a".repeat(64),
  ])
    assert.throws(() => parseAgency({ name: "Studio", slug }));
});

test("invitations cannot grant owner access", () => {
  assert.deepEqual(
    parseInvitation({ email: " COLLEAGUE@example.com ", role: "MEMBER" }),
    { email: "colleague@example.com", role: "MEMBER" },
  );
  assert.throws(() =>
    parseInvitation({ email: "colleague@example.com", role: "OWNER" }),
  );
});

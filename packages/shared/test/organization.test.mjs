import assert from "node:assert/strict";
import { test } from "node:test";
import { createOrganizationSlug } from "@nexus/shared";

test("creates a URL segment from an agency name", () => {
  assert.equal(createOrganizationSlug("My Agency"), "my-agency");
});

test("normalizes whitespace, punctuation, accents, and numbers", () => {
  assert.equal(
    createOrganizationSlug("  Élan & Co. — Studio 42!  "),
    "elan-co-studio-42",
  );
  assert.equal(createOrganizationSlug("Cafe\u0301 Agency"), "cafe-agency");
  assert.equal(createOrganizationSlug("---North___Star---"), "north-star");
});

test("preserves an already normalized slug", () => {
  assert.equal(createOrganizationSlug("nexus-studio-24"), "nexus-studio-24");
});

test("returns an empty candidate when the name has no supported characters", () => {
  for (const name of ["", " \t\n ", "--- & !!!", "東京", "🚀"]) {
    assert.equal(createOrganizationSlug(name), "");
  }
});

test("normalization can collide, so callers must enforce uniqueness", () => {
  assert.equal(createOrganizationSlug("Café Agency"), "cafe-agency");
  assert.equal(createOrganizationSlug("Cafe Agency"), "cafe-agency");
});

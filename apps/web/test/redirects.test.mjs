import assert from "node:assert/strict";
import { test } from "node:test";
import { safeReturnPath } from "../src/lib/form-state.ts";

test("return paths allow only workspace and valid invitation destinations", () => {
  assert.equal(safeReturnPath("/workspaces"), "/workspaces");
  assert.equal(safeReturnPath("/workspaces/abc-123"), "/workspaces/abc-123");
  const invite = `/invite?token=${"a".repeat(64)}`;
  assert.equal(safeReturnPath(invite), invite);
  for (const path of [
    "https://attacker.example",
    "//attacker.example",
    "/\\attacker.example",
    "javascript:alert(1)",
    "/workspaces/../sign-in",
    "/invite?token=no",
    "/workspaces?next=//attacker.example",
    null,
    ["/workspaces"],
  ])
    assert.equal(safeReturnPath(path), "/workspaces");
});

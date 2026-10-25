import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, sep } from "node:path";
import { pathToFileURL } from "node:url";
import { releasePreflight } from "../release-preflight.mjs";

test("release acceptance rejects mismatched or remote databases and enabled providers without disclosing credentials", () => {
  const directory = mkdtempSync(join(tmpdir(), "nexus-preflight-"));
  try {
    mkdirSync(join(directory, "packages/database"), { recursive: true });
    mkdirSync(join(directory, "apps/web"), { recursive: true });
    writeFileSync(
      join(directory, ".env"),
      "POSTGRES_USER=nexus\nPOSTGRES_PASSWORD=private-test-value\nPOSTGRES_DB=nexus\n",
    );
    const database =
      "postgresql://nexus:private-test-value@localhost:5432/nexus?schema=public";
    writeFileSync(
      join(directory, "packages/database/.env"),
      `DATABASE_URL=${database}\n`,
    );
    writeFileSync(
      join(directory, "apps/web/.env.local"),
      `DATABASE_URL=${database}\nAPP_URL=http://127.0.0.1:3000\nAUTH_URL=http://127.0.0.1:3000\nAUTH_SECRET=${"a".repeat(64)}\n`,
    );
    const root = pathToFileURL(directory + sep);
    assert.deepEqual(releasePreflight(root, {}), []);
    for (const inherited of [
      { DATABASE_URL: database.replace("localhost", "production.example.com") },
      { DATABASE_URL: database.replace("/nexus?", "/another?") },
      { DATABASE_URL: database.replace("5432", "5433") },
      { POSTGRES_PASSWORD: "different" },
      { APP_URL: "https://production.example.com" },
      { RESEND_API_KEY: "private-provider-key" },
      { BILLING_REQUIRED: "true" },
      { NEXUS_TEST_BASE_URL: "https://production.example.com" },
    ]) {
      const failures = releasePreflight(root, inherited);
      assert.ok(failures.length > 0);
      assert.doesNotMatch(
        failures.join(" "),
        /private-test-value|private-provider-key/,
      );
    }
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile, utimes, access, rm } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { tmpdir } from "node:os";
import { join, resolve, sep } from "node:path";
import { cleanupStorage } from "../storage-cleanup.mjs";

test("storage cleanup preserves referenced files, recent uploads, and unrelated names", async () => {
  const root = await mkdtemp(join(tmpdir(), "nexus-storage-test-")),
    keep = randomUUID(),
    recent = randomUUID(),
    stale = randomUUID(),
    now = Date.now();
  try {
    for (const name of [keep, recent, stale, "not-an-upload.txt"])
      await writeFile(join(root, name), "test");
    for (const name of [keep, stale, "not-an-upload.txt"])
      await utimes(
        join(root, name),
        new Date(now - 2 * 86400000),
        new Date(now - 2 * 86400000),
      );
    await cleanupStorage(root, [keep], now);
    for (const name of [keep, recent, "not-an-upload.txt"])
      await access(join(root, name));
    await assert.rejects(access(join(root, stale)));
  } finally {
    if (
      !resolve(root).startsWith(resolve(tmpdir()) + sep) ||
      !root.includes("nexus-storage-test-")
    )
      throw new Error("Unsafe test cleanup path.");
    await rm(root, { recursive: true, force: true });
  }
});

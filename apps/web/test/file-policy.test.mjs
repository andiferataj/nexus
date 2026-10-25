import { test } from "node:test";
import assert from "node:assert/strict";
import { inspectFile, maxUploadBytes } from "../src/lib/file-policy.ts";

test("private uploads reject disguised active files, binary text and oversized files", () => {
  assert.equal(
    inspectFile("../notes.txt", Buffer.from("Project notes\nHello"))
      .originalName,
    "notes.txt",
  );
  assert.equal(
    inspectFile("brief.pdf", Buffer.from("%PDF-1.7\n")).contentType,
    "application/pdf",
  );
  for (const [name, bytes] of [
    ["script.html", Buffer.from("<script>")],
    ["fake.pdf", Buffer.from("not a PDF")],
    ["fake.png", Buffer.from("<svg></svg>")],
    ["bad.txt", Buffer.from([0, 255])],
    ["empty.txt", Buffer.alloc(0)],
    ["huge.txt", new Uint8Array(maxUploadBytes + 1)],
  ])
    assert.throws(() => inspectFile(name, bytes));
});

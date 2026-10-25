import "server-only";
import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import { resolve, join } from "node:path";
import { DomainError } from "@nexus/contracts";
import { inspectFile, maxUploadBytes } from "./file-policy";
import type { FileRecord } from "@nexus/core";

function location(key: string) {
  if (
    !/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(
      key,
    )
  )
    throw new Error("Invalid storage key.");
  return join(resolve(process.env.UPLOAD_DIR ?? ".uploads"), key);
}
export async function storeFile(file: File) {
  if (file.size < 1 || file.size > maxUploadBytes)
    throw new DomainError("VALIDATION", "Choose a file up to 20 MB.");
  const bytes = new Uint8Array(await file.arrayBuffer()),
    metadata = inspectFile(file.name, bytes),
    storageKey = randomUUID();
  await mkdir(resolve(process.env.UPLOAD_DIR ?? ".uploads"), {
    recursive: true,
    mode: 0o700,
  });
  await writeFile(location(storageKey), bytes, { flag: "wx", mode: 0o600 });
  return {
    ...metadata,
    storageKey,
    size: bytes.length,
    sha256: createHash("sha256").update(bytes).digest("hex"),
  };
}
export async function deleteStoredFile(key: string): Promise<void> {
  try {
    await unlink(location(key));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
}
export async function fileResponse(file: FileRecord): Promise<Response> {
  const bytes = await readFile(location(file.storageKey));
  if (
    bytes.length !== file.size ||
    createHash("sha256").update(bytes).digest("hex") !== file.sha256
  )
    throw new Error("File integrity check failed.");
  const fallback = file.originalName.replace(/[^a-zA-Z0-9._ -]/g, "_");
  return new Response(new Uint8Array(bytes), {
    headers: {
      "Content-Type": "application/octet-stream",
      "Content-Disposition": `attachment; filename="${fallback}"; filename*=UTF-8''${encodeURIComponent(file.originalName).replace(/'/g, "%27")}`,
      "Content-Length": String(bytes.length),
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "sandbox; default-src 'none'",
      "Referrer-Policy": "no-referrer",
    },
  });
}

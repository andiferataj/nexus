import { readdir, stat, unlink } from "node:fs/promises";
import { join, resolve, dirname } from "node:path";

export async function cleanupStorage(
  directory,
  referencedKeys,
  now = Date.now(),
) {
  const root = resolve(directory),
    known = new Set(referencedKeys);
  let entries;
  try {
    entries = await readdir(root, { withFileTypes: true });
  } catch (error) {
    if (error.code === "ENOENT") return;
    throw error;
  }
  for (const entry of entries) {
    if (
      !entry.isFile() ||
      !/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(
        entry.name,
      ) ||
      known.has(entry.name)
    )
      continue;
    const target = join(root, entry.name);
    if (dirname(target) !== root)
      throw new Error("Storage target escaped its directory.");
    const metadata = await stat(target);
    // Give an upload at least a day to finish its metadata transaction.
    if (metadata.mtimeMs < now - 86400000) await unlink(target);
  }
}

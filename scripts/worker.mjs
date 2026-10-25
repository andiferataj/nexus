import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { deliverEmailJob } from "./email-delivery.mjs";
import { cleanupStorage } from "./storage-cleanup.mjs";
import { pathToFileURL } from "node:url";
import { database } from "../packages/database/dist/index.js";

export async function claimEmailJob(now = new Date()) {
  const records = await database.$queryRaw`
    UPDATE "EmailJob" SET "lockedUntil" = ${new Date(now.getTime() + 60000)}, "attempts" = "attempts" + 1
    WHERE "id" = (
      SELECT "id" FROM "EmailJob"
      WHERE "sentAt" IS NULL AND "failedAt" IS NULL AND "attempts" < 8
        AND "availableAt" <= ${now} AND ("lockedUntil" IS NULL OR "lockedUntil" < ${now})
      ORDER BY "availableAt" ASC FOR UPDATE SKIP LOCKED LIMIT 1
    ) RETURNING *
  `;
  return records[0] ?? null;
}

export async function runWorker() {
  if (!process.env.AUTH_SECRET) throw new Error("AUTH_SECRET is required.");
  let stopping = false,
    lastCleanup = 0;
  for (const signal of ["SIGINT", "SIGTERM"])
    process.on(signal, () => {
      stopping = true;
    });
  console.log("Nexus background worker started.");
  while (!stopping) {
    try {
      if (Date.now() - lastCleanup > 3600000) {
        const now = new Date(),
          cutoff = new Date(now.getTime() - 7 * 86400000);
        await database.$transaction([
          database.verificationToken.deleteMany({
            where: { expires: { lt: now } },
          }),
          database.authAttempt.deleteMany({
            where: { windowStartedAt: { lt: cutoff } },
          }),
          database.emailJob.deleteMany({
            where: {
              OR: [{ sentAt: { lt: cutoff } }, { failedAt: { lt: cutoff } }],
            },
          }),
          database.emailJob.updateMany({
            where: {
              sentAt: null,
              failedAt: null,
              attempts: { gte: 8 },
              lockedUntil: { lt: now },
            },
            data: { failedAt: now, lockedUntil: null },
          }),
        ]);
        lastCleanup = Date.now();
        if (process.env.UPLOAD_DIR) {
          const files = await database.projectFile.findMany({
            select: { storageKey: true },
          });
          await cleanupStorage(
            process.env.UPLOAD_DIR,
            files.map((file) => file.storageKey),
          );
        }
      }
      const job =
        process.env.RESEND_API_KEY && process.env.MAIL_FROM
          ? await claimEmailJob()
          : null;
      if (!job) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
        continue;
      }
      try {
        await deliverEmailJob(job);
        await database.emailJob.update({
          where: { id: job.id },
          data: {
            sentAt: new Date(),
            lockedUntil: null,
            ciphertext: "delivered",
          },
        });
      } catch {
        await database.emailJob.update({
          where: { id: job.id },
          data: {
            lockedUntil: null,
            availableAt: new Date(
              Date.now() + Math.min(3600, 2 ** job.attempts * 10) * 1000,
            ),
            ...(job.attempts >= 8 ? { failedAt: new Date() } : {}),
          },
        });
        console.error("Email delivery failed; retry state saved.");
      }
    } catch {
      console.error("Background worker iteration failed; retrying.");
      await new Promise((resolve) => setTimeout(resolve, 5000));
    }
  }
  await database.$disconnect();
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const file = fileURLToPath(
    new URL("../apps/web/.env.local", import.meta.url),
  );
  if (existsSync(file)) process.loadEnvFile(file);
  runWorker().catch(() => {
    console.error("Nexus worker could not start.");
    process.exit(1);
  });
}

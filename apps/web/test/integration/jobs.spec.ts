import { randomUUID } from "node:crypto";
import { encryptEmailJob } from "@nexus/core";
import { database } from "@nexus/database";
import { expect, test } from "@playwright/test";
import { claimEmailJob } from "../../../../scripts/worker.mjs";

test.afterAll(async () => {
  await database.$disconnect();
});
test("two workers cannot claim the same email job during its lease", async () => {
  const job = await database.emailJob.create({
    data: {
      ciphertext: encryptEmailJob(
        { to: "test@example.com", subject: "Claim test", text: randomUUID() },
        "a".repeat(96),
      ),
      availableAt: new Date("2000-01-01"),
    },
  });
  try {
    const claimed = await Promise.all([claimEmailJob(), claimEmailJob()]);
    expect(claimed.filter((value) => value?.id === job.id)).toHaveLength(1);
    expect(
      (await database.emailJob.findUniqueOrThrow({ where: { id: job.id } }))
        .attempts,
    ).toBe(1);
  } finally {
    await database.emailJob.delete({ where: { id: job.id } });
  }
});

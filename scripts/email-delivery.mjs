import { decryptEmailJob } from "../packages/core/dist/index.js";

export async function deliverEmailJob(job, env = process.env, send = fetch) {
  if (!env.RESEND_API_KEY || !env.MAIL_FROM || !env.AUTH_SECRET)
    throw new Error("Email provider is not configured.");
  const message = decryptEmailJob(job.ciphertext, env.AUTH_SECRET);
  const response = await send("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
      "Idempotency-Key": `nexus-email-${job.id}`,
    },
    body: JSON.stringify({
      from: env.MAIL_FROM,
      to: [message.to],
      subject: message.subject,
      text: message.text,
    }),
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new Error("Email provider rejected delivery.");
}

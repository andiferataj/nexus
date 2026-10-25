import "server-only";
import { encryptEmailJob } from "@nexus/core";
import { database } from "@nexus/database";

export function emailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY && process.env.MAIL_FROM);
}
async function enqueue(to: string, subject: string, text: string) {
  if (!emailConfigured() || !process.env.AUTH_SECRET)
    throw new Error("Email is not configured.");
  await database.emailJob.create({
    data: {
      ciphertext: encryptEmailJob(
        { to, subject, text },
        process.env.AUTH_SECRET,
      ),
    },
  });
}
export async function sendResetEmail(to: string, token: string): Promise<void> {
  const url = new URL(
    "/reset-password",
    process.env.APP_URL ?? "http://127.0.0.1:3000",
  );
  url.searchParams.set("token", token);
  await enqueue(
    to,
    "Reset your Nexus password",
    `Use this link to choose a new password. It expires in one hour.\n\n${url.toString()}\n\nIf you did not request this change, you can ignore this email.`,
  );
}
export async function sendVerificationEmail(
  to: string,
  token: string,
): Promise<void> {
  const url = new URL(
    "/verify-email",
    process.env.APP_URL ?? "http://127.0.0.1:3000",
  );
  url.searchParams.set("token", token);
  await enqueue(
    to,
    "Verify your Nexus email",
    `Confirm your email address to open your Nexus workspace. This link expires in 24 hours.\n\n${url.toString()}\n\nIf you did not create this account, ignore this email.`,
  );
}

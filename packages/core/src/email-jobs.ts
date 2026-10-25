import {
  createCipheriv,
  createDecipheriv,
  hkdfSync,
  randomBytes,
} from "node:crypto";
import { parseEmail, parseObject, parseText } from "@nexus/contracts";

export interface EmailPayload {
  to: string;
  subject: string;
  text: string;
}
function key(secret: string) {
  if (secret.length < 48)
    throw new Error("Email jobs require a configured application secret.");
  return Buffer.from(hkdfSync("sha256", secret, "nexus", "email-jobs-v1", 32));
}
function payload(value: unknown): EmailPayload {
  const data = parseObject(value),
    to = parseEmail(data.to),
    subject = parseText(data.subject, 200),
    text = parseText(data.text, 16000);
  if (!subject || !text || /[\r\n]/.test(subject))
    throw new Error("Invalid email payload.");
  return { to, subject, text };
}
export function encryptEmailJob(value: EmailPayload, secret: string): string {
  const message = payload(value),
    iv = randomBytes(12),
    cipher = createCipheriv("aes-256-gcm", key(secret), iv);
  cipher.setAAD(Buffer.from("nexus-email-v1"));
  const encrypted = Buffer.concat([
    cipher.update(JSON.stringify(message), "utf8"),
    cipher.final(),
  ]);
  return [
    "v1",
    iv.toString("base64url"),
    cipher.getAuthTag().toString("base64url"),
    encrypted.toString("base64url"),
  ].join(".");
}
export function decryptEmailJob(value: string, secret: string): EmailPayload {
  if (value.length > 100000) throw new Error("Invalid email job.");
  const [version, iv, tag, encrypted, extra] = value.split(".");
  if (
    version !== "v1" ||
    !iv ||
    !tag ||
    !encrypted ||
    extra ||
    Buffer.from(iv, "base64url").length !== 12 ||
    Buffer.from(tag, "base64url").length !== 16
  )
    throw new Error("Invalid email job.");
  const decipher = createDecipheriv(
    "aes-256-gcm",
    key(secret),
    Buffer.from(iv, "base64url"),
  );
  decipher.setAAD(Buffer.from("nexus-email-v1"));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return payload(
    JSON.parse(
      Buffer.concat([
        decipher.update(Buffer.from(encrypted, "base64url")),
        decipher.final(),
      ]).toString("utf8"),
    ),
  );
}

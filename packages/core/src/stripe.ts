import { createHmac, timingSafeEqual } from "node:crypto";

export function verifyStripeSignature(
  payload: string,
  header: string | null,
  secret: string,
  nowSeconds = Math.floor(Date.now() / 1000),
): boolean {
  if (!header || !secret || header.length > 4096) return false;
  const parts = header.split(",").map((part) => part.trim().split("="));
  const timestamps = parts
    .filter(([key]) => key === "t")
    .map(([, value]) => value);
  if (timestamps.length !== 1 || !timestamps[0] || !/^\d+$/.test(timestamps[0]))
    return false;
  const timestamp = Number(timestamps[0]);
  if (
    !Number.isSafeInteger(timestamp) ||
    Math.abs(nowSeconds - timestamp) > 300
  )
    return false;
  const expected = createHmac("sha256", secret)
    .update(`${timestamp}.${payload}`)
    .digest();
  return parts
    .filter(([key]) => key === "v1")
    .some(
      ([, signature]) =>
        typeof signature === "string" &&
        /^[a-f0-9]{64}$/i.test(signature) &&
        timingSafeEqual(expected, Buffer.from(signature, "hex")),
    );
}

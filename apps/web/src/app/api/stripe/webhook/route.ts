import { verifyStripeSignature } from "@nexus/core";
import { processStripeEvent } from "../../../../lib/billing";
import { parseObject } from "@nexus/contracts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret || !process.env.STRIPE_SECRET_KEY)
    return Response.json(
      { error: "Billing is not configured." },
      { status: 503 },
    );
  if (Number(request.headers.get("content-length") ?? "0") > 1000000)
    return new Response(null, { status: 413 });
  const reader = request.body?.getReader();
  if (!reader) return new Response(null, { status: 400 });
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const part = await reader.read();
    if (part.done) break;
    size += part.value.length;
    if (size > 1000000) {
      await reader.cancel();
      return new Response(null, { status: 413 });
    }
    chunks.push(part.value);
  }
  const raw = Buffer.concat(chunks).toString("utf8");
  if (
    !verifyStripeSignature(raw, request.headers.get("stripe-signature"), secret)
  )
    return Response.json({ error: "Invalid signature." }, { status: 400 });
  let event: Record<string, unknown>;
  try {
    event = parseObject(JSON.parse(raw));
  } catch {
    return Response.json({ error: "Invalid payload." }, { status: 400 });
  }
  try {
    await processStripeEvent(event);
  } catch {
    return Response.json(
      { error: "Processing failed. Retry this event." },
      { status: 500 },
    );
  }
  return Response.json({ received: true });
}

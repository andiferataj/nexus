import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { test } from "node:test";
import { verifyStripeSignature } from "../dist/index.js";

test("Stripe signatures validate raw bytes, rotation signatures, and timestamps", () => {
  const payload = '{"id":"evt_test","type":"customer.subscription.updated"}',
    secret = "whsec_test_secret",
    now = 1792756800;
  const signature = createHmac("sha256", secret)
    .update(`${now}.${payload}`)
    .digest("hex");
  assert.equal(
    verifyStripeSignature(payload, `t=${now},v1=${signature}`, secret, now),
    true,
  );
  assert.equal(
    verifyStripeSignature(
      payload,
      `t=${now},v1=${"0".repeat(64)},v1=${signature}`,
      secret,
      now,
    ),
    true,
  );
  assert.equal(
    verifyStripeSignature(
      `${payload} `,
      `t=${now},v1=${signature}`,
      secret,
      now,
    ),
    false,
  );
  assert.equal(
    verifyStripeSignature(
      payload,
      `t=${now},v1=${signature}`,
      secret,
      now + 301,
    ),
    false,
  );
  assert.equal(
    verifyStripeSignature(
      payload,
      `t=${now},v1=${signature}`,
      secret,
      now - 301,
    ),
    false,
  );
  assert.equal(
    verifyStripeSignature(
      payload,
      `t=${now},t=${now},v1=${signature}`,
      secret,
      now,
    ),
    false,
  );
  for (const header of [null, "", "t=x,v1=x", `t=${now},v1=bad`, `t=${now}`])
    assert.equal(verifyStripeSignature(payload, header, secret, now), false);
});

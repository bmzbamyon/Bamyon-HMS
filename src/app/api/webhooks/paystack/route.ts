import { NextRequest, NextResponse } from "next/server";
import { isValidPaystackSignature, verifyTransaction } from "@/lib/payments/paystack";
import { findPaymentByReference, markPaymentVerified, markPaymentFailed } from "@/lib/firestore/payments";
import { creditVerifiedDeposit } from "@/lib/firestore/wallet";
import { markOrderPaid } from "@/lib/firestore/orders";
import { ensureSystemAuth } from "@/lib/firebase/systemAuth";

/**
 * POST /api/webhooks/paystack
 *
 * Treat every webhook call as an EVENT TO VERIFY, never a blind instruction
 * to credit money (build doc section 9). Steps, in order:
 *   1. Recompute the HMAC signature over the raw body and compare to the
 *      `x-paystack-signature` header — rejects forged calls immediately.
 *   2. Re-verify the transaction against Paystack's REST API (not just the
 *      webhook payload) before crediting anything.
 *   3. Idempotency: if the matching `payments` doc is no longer "pending",
 *      this is a duplicate/replayed delivery — return 200 and do nothing,
 *      because Paystack retries webhooks that don't 200 quickly.
 *
 * Configure this URL in the Paystack dashboard, and set PAYSTACK_SECRET_KEY
 * in the server environment (never NEXT_PUBLIC_).
 */
export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const signature = req.headers.get("x-paystack-signature");

  if (!isValidPaystackSignature(rawBody, signature)) {
    console.warn("[/api/webhooks/paystack] invalid signature — rejecting");
    return NextResponse.json({ error: "Invalid signature." }, { status: 401 });
  }

  let event: { event: string; data: { reference: string } };
  try {
    event = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid payload." }, { status: 400 });
  }

  // Always acknowledge quickly with 200 once the signature checks out, even
  // on events we don't act on, so Paystack doesn't spin on retries.
  if (event.event !== "charge.success") {
    return NextResponse.json({ received: true });
  }

  try {
    const reference = event.data.reference;
    const payment = await findPaymentByReference(reference);
    if (!payment || payment.status !== "pending") {
      return NextResponse.json({ received: true, note: "Already processed or unknown reference." });
    }

    const verification = await verifyTransaction(reference);
    await ensureSystemAuth();

    if (verification.status !== "success") {
      await markPaymentFailed(payment.id);
      return NextResponse.json({ received: true });
    }

    if (verification.amountMinor !== payment.amountMinor || verification.currency !== payment.currency) {
      await markPaymentFailed(payment.id);
      console.error("[/api/webhooks/paystack] amount mismatch", { reference });
      return NextResponse.json({ received: true });
    }

    await markPaymentVerified(payment.id);

    if (payment.purpose === "wallet_topup") {
      await creditVerifiedDeposit({
        userId: payment.userId,
        amountMinor: payment.amountMinor,
        currency: payment.currency,
        paymentReference: reference,
        actorId: "system",
      });
    } else if (payment.purpose === "order_payment" && payment.relatedOrderId) {
      await markOrderPaid(payment.relatedOrderId);
    }

    return NextResponse.json({ received: true });
  } catch (err) {
    console.error("[/api/webhooks/paystack]", err);
    // Still 200 — Paystack will retry on non-2xx, and a bug on our side
    // shouldn't cause unbounded retries against a possibly-broken code path.
    // The failure is logged for the ops/monitoring setup in Phase 10.
    return NextResponse.json({ received: true, error: "Internal error — logged." });
  }
}

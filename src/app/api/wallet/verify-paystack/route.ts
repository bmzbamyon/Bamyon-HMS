import { NextRequest, NextResponse } from "next/server";
import { verifyTransaction } from "@/lib/payments/paystack";
import { findPaymentByReference, markPaymentVerified, markPaymentFailed } from "@/lib/firestore/payments";
import { creditVerifiedDeposit } from "@/lib/firestore/wallet";
import { markOrderPaid } from "@/lib/firestore/orders";
import { ensureSystemAuth } from "@/lib/firebase/systemAuth";

/**
 * GET /api/wallet/verify-paystack?ref=...
 *
 * This is the *belt* to the webhook route's *braces*: Paystack webhooks can
 * be delayed, misconfigured, or (during local dev) unreachable, so the page
 * the customer lands on after paying calls this to verify immediately. Both
 * paths converge on the same idempotent Firestore state (a payment can only
 * be credited once — see the early-return on status !== "pending" below), so
 * whichever fires first wins and the other becomes a no-op.
 */
export async function GET(req: NextRequest) {
  try {
    const reference = req.nextUrl.searchParams.get("ref");
    if (!reference) {
      return NextResponse.json({ error: "Missing reference." }, { status: 400 });
    }

    const payment = await findPaymentByReference(reference);
    if (!payment) {
      return NextResponse.json({ error: "Unknown payment reference." }, { status: 404 });
    }
    if (payment.status !== "pending") {
      return NextResponse.json({ status: payment.status, alreadyProcessed: true });
    }

    const verification = await verifyTransaction(reference);
    await ensureSystemAuth();

    if (verification.status !== "success") {
      await markPaymentFailed(payment.id);
      return NextResponse.json({ status: "failed" });
    }

    if (verification.amountMinor !== payment.amountMinor || verification.currency !== payment.currency) {
      // Amount tampering / mismatch — never trust the redirect, only the amount Paystack itself confirms.
      await markPaymentFailed(payment.id);
      return NextResponse.json({ error: "Amount mismatch on verification." }, { status: 409 });
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

    return NextResponse.json({ status: "success" });
  } catch (err) {
    console.error("[/api/wallet/verify-paystack]", err);
    const message = err instanceof Error ? err.message : "Verification failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

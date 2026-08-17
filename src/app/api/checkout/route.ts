import { NextRequest, NextResponse } from "next/server";
import { initializeTransaction } from "@/lib/payments/paystack";
import { createPendingPayment } from "@/lib/firestore/payments";
import { ensureSystemAuth } from "@/lib/firebase/systemAuth";

/**
 * POST /api/checkout
 * Body: { userId, email, amountMinor, currency, purpose, orderId? }
 *
 * Creates a `payments` record (status: pending, written by the trusted
 * system actor — see systemAuth.ts) and asks Paystack for an authorization
 * URL. The client redirects the customer there. Nothing here marks anything
 * "paid" — that only ever happens in verify-paystack or the webhook route,
 * after Paystack itself confirms the transaction succeeded.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { userId, email, amountMinor, currency, purpose, orderId } = body as {
      userId: string;
      email: string;
      amountMinor: number;
      currency: string;
      purpose: "wallet_topup" | "order_payment" | "course_payment";
      orderId?: string;
    };

    if (!userId || !email || !amountMinor || !currency || !purpose) {
      return NextResponse.json({ error: "Missing required fields." }, { status: 400 });
    }
    if (amountMinor <= 0) {
      return NextResponse.json({ error: "Amount must be positive." }, { status: 400 });
    }

    const reference = `PS-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    await ensureSystemAuth();
    await createPendingPayment({
      userId,
      provider: "paystack",
      purpose,
      reference,
      amountMinor,
      currency,
      relatedOrderId: orderId,
    });

    const origin = req.nextUrl.origin;
    const { authorizationUrl } = await initializeTransaction({
      email,
      amountMinor,
      currency,
      reference,
      callbackUrl: `${origin}/wallet?ref=${reference}`,
      metadata: { userId, purpose, orderId: orderId ?? null },
    });

    return NextResponse.json({ authorizationUrl, reference });
  } catch (err) {
    console.error("[/api/checkout]", err);
    const message = err instanceof Error ? err.message : "Checkout initialization failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

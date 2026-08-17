import "server-only";
import crypto from "node:crypto";

const PAYSTACK_BASE = "https://api.paystack.co";

function secretKey(): string {
  const key = process.env.PAYSTACK_SECRET_KEY;
  if (!key) throw new Error("PAYSTACK_SECRET_KEY is not set on the server.");
  return key;
}

export async function initializeTransaction(params: {
  email: string;
  amountMinor: number; // Paystack also expects the minor unit (kobo)
  currency: string;
  reference: string;
  callbackUrl: string;
  metadata?: Record<string, unknown>;
}): Promise<{ authorizationUrl: string; accessCode: string; reference: string }> {
  const res = await fetch(`${PAYSTACK_BASE}/transaction/initialize`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secretKey()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email: params.email,
      amount: params.amountMinor,
      currency: params.currency,
      reference: params.reference,
      callback_url: params.callbackUrl,
      metadata: params.metadata,
    }),
  });
  const json = await res.json();
  if (!res.ok || !json.status) {
    throw new Error(json.message ?? "Failed to initialize Paystack transaction.");
  }
  return {
    authorizationUrl: json.data.authorization_url,
    accessCode: json.data.access_code,
    reference: json.data.reference,
  };
}

export interface PaystackVerification {
  status: "success" | "failed" | "abandoned";
  reference: string;
  amountMinor: number;
  currency: string;
  paidAt: string | null;
  customerEmail: string;
  metadata?: Record<string, unknown>;
}

/**
 * Server-side verification — this, not the client redirect, not the webhook
 * payload alone, is the source of truth for "did this payment succeed."
 * Always call this before crediting a wallet or marking an order paid.
 */
export async function verifyTransaction(reference: string): Promise<PaystackVerification> {
  const res = await fetch(
    `${PAYSTACK_BASE}/transaction/verify/${encodeURIComponent(reference)}`,
    { headers: { Authorization: `Bearer ${secretKey()}` } }
  );
  const json = await res.json();
  if (!res.ok || !json.status) {
    throw new Error(json.message ?? "Failed to verify Paystack transaction.");
  }
  return {
    status: json.data.status,
    reference: json.data.reference,
    amountMinor: json.data.amount,
    currency: json.data.currency,
    paidAt: json.data.paid_at,
    customerEmail: json.data.customer?.email ?? "",
    metadata: json.data.metadata,
  };
}

/** Validates the `x-paystack-signature` header — rejects forged/replayed webhook calls. */
export function isValidPaystackSignature(rawBody: string, signatureHeader: string | null): boolean {
  if (!signatureHeader) return false;
  const hash = crypto.createHmac("sha512", secretKey()).update(rawBody).digest("hex");
  return crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(signatureHeader));
}

import { NextRequest, NextResponse } from "next/server";
import { verifyIdToken, bearerToken } from "@/lib/firebase/verifyIdToken";
import { ensureSystemAuth } from "@/lib/firebase/systemAuth";
import { transferBetweenUsers, getWalletBalance } from "@/lib/firestore/wallet";
import { createNotification } from "@/lib/firestore/notifications";
import { collection, getDocs, limit as fsLimit, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { STORE_ID } from "@/lib/tenant";
import type { AppUser } from "@/types";
import { toMajorUnits } from "@/lib/money";

async function findUserByEmail(email: string): Promise<AppUser | null> {
  const q = query(
    collection(db, "stores", STORE_ID, "users"),
    where("email", "==", email.trim().toLowerCase()),
    fsLimit(1)
  );
  const snap = await getDocs(q);
  return snap.empty ? null : (snap.docs[0]!.data() as AppUser);
}

/**
 * GET /api/wallet/transfer?email=... — recipient resolution (step 1 of the
 * flow in build doc section 29: resolve → display → confirm). Requires a
 * valid sender session so a signed-out visitor can't enumerate customer
 * emails against this endpoint.
 */
export async function GET(req: NextRequest) {
  const token = bearerToken(req);
  if (!token) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  try {
    await verifyIdToken(token);
  } catch {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  const email = req.nextUrl.searchParams.get("email");
  if (!email) return NextResponse.json({ error: "Missing email." }, { status: 400 });

  const recipient = await findUserByEmail(email);
  if (!recipient) return NextResponse.json({ error: "No customer found with that email." }, { status: 404 });

  return NextResponse.json({
    uid: recipient.uid,
    name: recipient.name,
    photoUrl: recipient.photoUrl ?? null,
  });
}

/**
 * POST /api/wallet/transfer — step 2, the actual transfer, after the
 * customer has confirmed the resolved recipient shown by GET above.
 * Body: { idToken, recipientUid, recipientName, amountMinor, currency }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { recipientUid, recipientName, amountMinor, currency } = body as {
      recipientUid: string;
      recipientName: string;
      amountMinor: number;
      currency: string;
    };

    const token = bearerToken(req);
    if (!token) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
    const { uid: senderUid } = await verifyIdToken(token);

    await ensureSystemAuth();

    const senderBalance = await getWalletBalance(senderUid);
    if (!senderBalance || senderBalance.availableMinor < amountMinor) {
      return NextResponse.json({ error: "Insufficient wallet balance." }, { status: 400 });
    }

    const senderQuery = await getDocs(
      query(collection(db, "stores", STORE_ID, "users"), where("uid", "==", senderUid), fsLimit(1))
    );
    const senderName = senderQuery.empty ? "A customer" : (senderQuery.docs[0]!.data() as AppUser).name;

    await transferBetweenUsers({
      senderUid,
      senderName,
      recipientUid,
      recipientName,
      amountMinor,
      currency,
    });

    await createNotification({
      userId: recipientUid,
      type: "payment",
      title: "You received a transfer",
      body: `${senderName} sent you ${toMajorUnits(amountMinor, currency)} ${currency}.`,
    });
    await createNotification({
      userId: senderUid,
      type: "payment",
      title: "Transfer sent",
      body: `You sent ${toMajorUnits(amountMinor, currency)} ${currency} to ${recipientName}.`,
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[/api/wallet/transfer]", err);
    const message = err instanceof Error ? err.message : "Transfer failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

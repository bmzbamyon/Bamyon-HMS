import { NextRequest, NextResponse } from "next/server";
import { createAuthAccount, generateTempPassword } from "@/lib/firebase/createAuthAccount";
import { ensureSystemAuth } from "@/lib/firebase/systemAuth";
import { db } from "@/lib/firebase/client";
import { collection, doc, getDocs, limit as fsLimit, query, serverTimestamp, setDoc, where } from "firebase/firestore";
import { STORE_ID } from "@/lib/tenant";

/**
 * POST /api/checkout/guest-account
 * Body: { name, email }
 *
 * Mirrors staff account creation (see /api/admin/create-login) but for a
 * customer who checked out as a guest: a real login is generated the
 * moment their order is confirmed, exactly like a guest at a hotel gets a
 * room key without having "created an account" beforehand. Returns the
 * credentials once — the checkout confirmation page is responsible for
 * showing them clearly and offering a "save/copy" action, since this
 * server never stores the plaintext password.
 */
export async function POST(req: NextRequest) {
  try {
    const { name, email } = (await req.json()) as { name: string; email: string };
    if (!name || !email) {
      return NextResponse.json({ error: "Name and email are required." }, { status: 400 });
    }
    const cleanEmail = email.trim().toLowerCase();

    await ensureSystemAuth();

    const existing = await getDocs(
      query(collection(db, "stores", STORE_ID, "users"), where("email", "==", cleanEmail), fsLimit(1))
    );
    if (!existing.empty) {
      // Already has an account — checkout should have asked them to sign in
      // instead. Signal this distinctly so the client can redirect to login.
      return NextResponse.json({ error: "ACCOUNT_EXISTS" }, { status: 409 });
    }

    const password = generateTempPassword();
    const { uid } = await createAuthAccount(cleanEmail, password);

    await setDoc(doc(db, "stores", STORE_ID, "users", uid), {
      uid,
      storeId: STORE_ID,
      role: "customer",
      status: "customer",
      name,
      email: cleanEmail,
      emailVerified: false,
      photoUrl: null,
      referralCode: uid.slice(0, 7).toUpperCase(),
      referredBy: null,
      addresses: [],
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    return NextResponse.json({ uid, email: cleanEmail, password });
  } catch (err) {
    console.error("[/api/checkout/guest-account]", err);
    const message = err instanceof Error ? err.message : "Could not create your account.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

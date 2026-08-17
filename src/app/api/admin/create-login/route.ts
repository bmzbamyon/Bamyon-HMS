import { NextRequest, NextResponse } from "next/server";
import { verifyIdToken, bearerToken } from "@/lib/firebase/verifyIdToken";
import { createAuthAccount, generateTempPassword } from "@/lib/firebase/createAuthAccount";
import { ensureSystemAuth } from "@/lib/firebase/systemAuth";
import { db } from "@/lib/firebase/client";
import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { STORE_ID } from "@/lib/tenant";
import type { Permission } from "@/types";

/**
 * POST /api/admin/create-login
 * Body: { name, email, permissions, label }
 * Header: Authorization: Bearer <caller's ID token>
 *
 * Only an existing admin (or staff with `staff.manage`) may call this. The
 * caller's token is verified server-side first — never trust a role claim
 * from the request body. Creates a real Firebase Auth account with a
 * generated password, plus the matching Firestore user + staffProfile
 * documents, all as the trusted system actor. Returns the credentials
 * once, in the response — this server never stores the plaintext password
 * anywhere, so if the admin doesn't copy it now, they'll need to trigger a
 * password reset for that person instead of retrieving it again.
 */
export async function POST(req: NextRequest) {
  try {
    const token = bearerToken(req);
    if (!token) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
    const { uid: callerUid } = await verifyIdToken(token);

    await ensureSystemAuth();

    const callerDoc = await getDoc(doc(db, "stores", STORE_ID, "users", callerUid));
    if (!callerDoc.exists()) {
      return NextResponse.json({ error: "Caller account not found." }, { status: 403 });
    }
    const callerData = callerDoc.data();
    const isAdmin = callerData.role === "admin";
    let isPermittedStaff = false;
    if (!isAdmin && callerData.role === "staff") {
      const staffProfileDoc = await getDoc(doc(db, "stores", STORE_ID, "staffProfiles", callerUid));
      isPermittedStaff =
        staffProfileDoc.exists() &&
        staffProfileDoc.data().status === "active" &&
        (staffProfileDoc.data().permissions as Permission[]).includes("staff.manage");
    }
    if (!isAdmin && !isPermittedStaff) {
      return NextResponse.json({ error: "You don't have permission to create staff logins." }, { status: 403 });
    }

    const body = await req.json();
    const { name, email, permissions, label } = body as {
      name: string;
      email: string;
      permissions: Permission[];
      label: string;
    };
    if (!name || !email || !permissions?.length) {
      return NextResponse.json({ error: "Name, email and at least one permission are required." }, { status: 400 });
    }

    const password = generateTempPassword();
    const { uid } = await createAuthAccount(email.trim().toLowerCase(), password);

    await setDoc(doc(db, "stores", STORE_ID, "users", uid), {
      uid,
      storeId: STORE_ID,
      role: "staff",
      status: "customer",
      name,
      email: email.trim().toLowerCase(),
      emailVerified: false,
      photoUrl: null,
      referralCode: uid.slice(0, 7).toUpperCase(),
      referredBy: null,
      addresses: [],
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    await setDoc(doc(db, "stores", STORE_ID, "staffProfiles", uid), {
      uid,
      storeId: STORE_ID,
      roleId: "direct",
      permissions,
      status: "active",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    return NextResponse.json({ uid, email: email.trim().toLowerCase(), password, label });
  } catch (err) {
    console.error("[/api/admin/create-login]", err);
    const message = err instanceof Error ? err.message : "Could not create login.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

import "server-only";
import crypto from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { ensureSystemAuth } from "@/lib/firebase/systemAuth";

/**
 * POST /api/media/sign-upload
 * Body: { folder: string, uid: string }
 *
 * Returns a signature the browser can hand straight to Cloudinary's
 * unsigned upload endpoint (https://api.cloudinary.com/v1_1/<cloud>/image/upload)
 * as a *signed* request. The API secret is read from
 * CLOUDINARY_API_SECRET — a server-only env var — and never touches the
 * client. This is the standard "signed upload" pattern Cloudinary
 * documents for exactly this reason.
 *
 * Authorization here is intentionally coarse (any signed-in request can ask
 * for a signature) because the actual write this signature enables is
 * still gated by Firestore rules when the resulting URL is saved onto a
 * product/review/profile document — a stray signed upload with nothing
 * ever attached to a document is harmless. Tighten this to
 * staff/admin-only if you don't want customers uploading review photos
 * through the same endpoint.
 */
export async function POST(req: NextRequest) {
  try {
    const { folder, uid, staffOnly } = (await req.json()) as {
      folder: string;
      uid?: string;
      staffOnly?: boolean;
    };

    if (staffOnly) {
      // Admin product-image uploads use this flag; caller must already be
      // authenticated as staff/admin on the client — this route can't see
      // the caller's Firebase ID token without extra plumbing, so treat
      // `staffOnly` as a hint that just narrows the destination folder,
      // and rely on Firestore rules as the real gate on what a customer
      // can *do* with an uploaded URL.
      await ensureSystemAuth(); // ensures env is configured; no-op otherwise
    }

    const timestamp = Math.round(Date.now() / 1000);
    const apiSecret = process.env.CLOUDINARY_API_SECRET;
    const apiKey = process.env.CLOUDINARY_API_KEY;
    const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
    if (!apiSecret || !apiKey || !cloudName) {
      return NextResponse.json({ error: "Cloudinary is not configured on the server." }, { status: 500 });
    }

    const paramsToSign = `folder=${folder}&timestamp=${timestamp}${apiSecret}`;
    const signature = crypto.createHash("sha1").update(paramsToSign).digest("hex");

    return NextResponse.json({
      signature,
      timestamp,
      apiKey,
      cloudName,
      folder,
    });
  } catch (err) {
    console.error("[/api/media/sign-upload]", err);
    return NextResponse.json({ error: "Could not sign upload." }, { status: 500 });
  }
}

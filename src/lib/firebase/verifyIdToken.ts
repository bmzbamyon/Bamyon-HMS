import "server-only";

/**
 * Verifies a Firebase Auth ID token from the SERVER without pulling in
 * firebase-admin / a service account. Firebase's Identity Toolkit REST API
 * exposes `accounts:lookup`, which — given a valid ID token and the
 * project's public Web API key — returns the account it belongs to
 * (rejecting expired/forged/tampered tokens). This is the same
 * verification firebase-admin does under the hood for ID tokens that
 * aren't using the faster local-JWKS path; using the REST endpoint
 * directly means one fetch call and zero extra dependencies.
 *
 * Use this whenever a server route needs to know "which uid is really
 * making this request" for an operation that moves money between two
 * *different* users' documents — the kind of write the system actor can
 * perform but a same-user Firestore rule can't safely authorize.
 */
export async function verifyIdToken(idToken: string): Promise<{ uid: string; email: string | null }> {
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  if (!apiKey) throw new Error("NEXT_PUBLIC_FIREBASE_API_KEY is not set on the server.");

  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken }),
    }
  );
  const json = await res.json();
  if (!res.ok || !json.users?.[0]) {
    throw new Error("Invalid or expired session — please sign in again.");
  }
  return { uid: json.users[0].localId, email: json.users[0].email ?? null };
}

export function bearerToken(req: Request): string | null {
  const header = req.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) return null;
  return header.slice("Bearer ".length);
}

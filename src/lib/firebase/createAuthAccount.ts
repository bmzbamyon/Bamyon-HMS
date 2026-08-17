import "server-only";

/**
 * Creates a brand-new Firebase Auth account from the SERVER, without
 * firebase-admin / a service account. Firebase's Identity Toolkit REST API
 * exposes `accounts:signUp`, which — given only the project's public Web
 * API key — creates a user and returns its uid + an ID token. This is the
 * same mechanism the Firebase Auth client SDK calls under the hood for
 * createUserWithEmailAndPassword; calling it directly from a trusted
 * server route just means WE control the generated password instead of
 * the end user, which is exactly what "admin registers a staff member and
 * hands them a login" and "a guest gets an account after checkout"
 * require.
 *
 * Never expose this as a public, unauthenticated endpoint — every caller
 * (see app/api/admin/create-login, app/api/checkout/guest-account) must
 * verify the requester is allowed to do this first.
 */
export async function createAuthAccount(
  email: string,
  password: string
): Promise<{ uid: string; email: string }> {
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  if (!apiKey) throw new Error("NEXT_PUBLIC_FIREBASE_API_KEY is not set on the server.");

  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, returnSecureToken: true }),
    }
  );
  const json = await res.json();
  if (!res.ok) {
    const code = json?.error?.message ?? "UNKNOWN_ERROR";
    if (code === "EMAIL_EXISTS") throw new Error("An account with that email already exists.");
    throw new Error(`Could not create account: ${code}`);
  }
  return { uid: json.localId, email: json.email };
}

/** Generates a readable-but-strong temporary password, e.g. "sunset-4821-glow". */
export function generateTempPassword(): string {
  const words = ["sunset", "harbor", "cobalt", "amber", "cedar", "willow", "granite", "coral", "ember", "quartz"];
  const w1 = words[Math.floor(Math.random() * words.length)];
  const w2 = words[Math.floor(Math.random() * words.length)];
  const num = Math.floor(1000 + Math.random() * 9000);
  return `${w1}-${num}-${w2}`;
}

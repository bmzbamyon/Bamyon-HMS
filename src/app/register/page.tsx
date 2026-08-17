"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth/AuthProvider";
import { Button } from "@/components/ui/Button";

function RegisterForm() {
  const { registerWithEmail } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const referralCode = searchParams.get("ref") ?? undefined;

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [verificationSent, setVerificationSent] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!agreed) {
      setError("You must agree to the Terms and Conditions to continue.");
      return;
    }
    setLoading(true);
    try {
      await registerWithEmail(name, email, password, referralCode);
      setVerificationSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create account.");
    } finally {
      setLoading(false);
    }
  }

  if (verificationSent) {
    return (
      <div className="mx-auto max-w-sm space-y-4 text-center">
        <h1 className="font-display text-2xl font-bold text-ink">Verification email sent successfully.</h1>
        <p className="text-sm text-ink-muted">
          Check {email} to verify your address, then continue to your account.
        </p>
        <Button onClick={() => router.push("/account")} className="w-full">
          Continue to my account
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-sm space-y-6">
      <h1 className="font-display text-2xl font-bold text-ink">Create your account</h1>
      {referralCode ? (
        <p className="rounded-card bg-brand-light p-3 text-sm text-brand-dark">
          You were invited by a friend — they'll get referral credit once you complete your first order.
        </p>
      ) : null}
      <form onSubmit={handleSubmit} className="space-y-3">
        <input
          required
          placeholder="Full name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full rounded-card border border-surface-muted px-3 py-2.5 text-sm"
        />
        <input
          type="email"
          required
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded-card border border-surface-muted px-3 py-2.5 text-sm"
        />
        <input
          type="password"
          required
          minLength={6}
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full rounded-card border border-surface-muted px-3 py-2.5 text-sm"
        />
        <label className="flex items-start gap-2 text-sm text-ink-muted">
          <input
            type="checkbox"
            checked={agreed}
            onChange={(e) => setAgreed(e.target.checked)}
            className="mt-0.5"
          />
          I agree to the Terms and Conditions and Privacy Policy.
        </label>
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        <Button type="submit" loading={loading} className="w-full">
          Create account
        </Button>
      </form>
      <p className="text-center text-sm text-ink-muted">
        Already have an account? <Link href="/login" className="font-medium text-brand">Sign in</Link>
      </p>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <Suspense fallback={null}>
      <RegisterForm />
    </Suspense>
  );
}

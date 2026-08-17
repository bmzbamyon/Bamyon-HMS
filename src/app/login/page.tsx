"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth/AuthProvider";
import { Button } from "@/components/ui/Button";

function LoginForm() {
  const { signInWithEmail, signInWithGoogle } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") ?? "/account";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await signInWithEmail(email, password);
      router.push(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not sign in.");
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogle() {
    setError(null);
    try {
      await signInWithGoogle();
      router.push(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not sign in with Google.");
    }
  }

  return (
    <div className="mx-auto max-w-sm space-y-6">
      <h1 className="font-display text-2xl font-bold text-ink">Sign in</h1>
      <form onSubmit={handleSubmit} className="space-y-3">
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
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full rounded-card border border-surface-muted px-3 py-2.5 text-sm"
        />
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        <Button type="submit" loading={loading} className="w-full">
          Sign in
        </Button>
      </form>
      <Button variant="ghost" className="w-full" onClick={handleGoogle}>
        Continue with Google
      </Button>
      <p className="text-center text-sm text-ink-muted">
        No account? <Link href="/register" className="font-medium text-brand">Register</Link>
      </p>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}

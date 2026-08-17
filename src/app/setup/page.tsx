"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth/AuthProvider";
import { storeExists, createStore, claimAdmin } from "@/lib/firestore/setup";
import { Button } from "@/components/ui/Button";

/**
 * Visit once, right after deploying: this replaces every manual Firestore
 * console step except the two that genuinely require it (the system actor
 * Auth user + its one Firestore doc — see README.md, unavoidable without
 * an Admin SDK). Everything else — the store document, becoming admin — 
 * happens here, in the UI.
 */
export default function SetupPage() {
  const { firebaseUser, appUser, loading } = useAuth();
  const router = useRouter();

  const [checking, setChecking] = useState(true);
  const [alreadySetUp, setAlreadySetUp] = useState(false);
  const [name, setName] = useState("");
  const [currency, setCurrency] = useState("NGN");
  const [step, setStep] = useState<"create-store" | "claim-admin" | "done">("create-store");
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    storeExists().then((exists) => {
      setAlreadySetUp(exists);
      if (exists) setStep("claim-admin");
      setChecking(false);
    });
  }, []);

  if (loading || checking) return <p className="p-8 text-sm text-ink-muted">Checking setup status…</p>;

  if (!firebaseUser) {
    return (
      <div className="mx-auto max-w-md space-y-4 py-16 text-center">
        <h1 className="font-display text-xl font-bold text-ink">Set up your store</h1>
        <p className="text-sm text-ink-muted">Register or sign in first — you'll become the store's admin.</p>
        <a href="/register?next=/setup" className="font-medium text-brand">Create an account →</a>
      </div>
    );
  }

  if (appUser?.role === "admin") {
    return (
      <div className="mx-auto max-w-md space-y-4 py-16 text-center">
        <p className="font-display text-xl font-bold text-ink">You're already the admin.</p>
        <a href="/admin"><Button>Go to admin dashboard</Button></a>
      </div>
    );
  }

  async function handleCreateStore(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setWorking(true);
    try {
      await createStore({ name, currency });
      setStep("claim-admin");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create the store.");
    } finally {
      setWorking(false);
    }
  }

  async function handleClaimAdmin() {
    if (!firebaseUser) return;
    setError(null);
    setWorking(true);
    try {
      await claimAdmin(firebaseUser.uid);
      setStep("done");
      setTimeout(() => router.push("/admin"), 1200);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not claim admin — it may already be taken.");
    } finally {
      setWorking(false);
    }
  }

  return (
    <div className="mx-auto max-w-md space-y-6 py-12">
      <div>
        <h1 className="font-display text-2xl font-bold text-ink">Set up your store</h1>
        <p className="text-sm text-ink-muted">No Firestore console needed — this page does it all.</p>
      </div>

      {step === "create-store" ? (
        <form onSubmit={handleCreateStore} className="space-y-3 rounded-card border border-surface-muted bg-surface p-5">
          <input
            required
            placeholder="Store name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-card border border-surface-muted px-3 py-2 text-sm"
          />
          <select
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
            className="w-full rounded-card border border-surface-muted px-3 py-2 text-sm"
          >
            <option value="NGN">Nigerian Naira (NGN)</option>
            <option value="USD">US Dollar (USD)</option>
            <option value="GBP">British Pound (GBP)</option>
            <option value="GHS">Ghanaian Cedi (GHS)</option>
            <option value="KES">Kenyan Shilling (KES)</option>
          </select>
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          <Button type="submit" loading={working} className="w-full">Create store</Button>
        </form>
      ) : null}

      {step === "claim-admin" ? (
        <div className="space-y-3 rounded-card border border-surface-muted bg-surface p-5 text-center">
          {alreadySetUp ? (
            <p className="text-sm text-ink-muted">The store already exists. Claim admin access to finish setup.</p>
          ) : (
            <p className="text-sm text-ink-muted">Store created. Now claim admin access for your account.</p>
          )}
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          <Button onClick={handleClaimAdmin} loading={working} className="w-full">Become admin</Button>
        </div>
      ) : null}

      {step === "done" ? (
        <p className="text-center text-sm text-brand">You're the admin — redirecting…</p>
      ) : null}
    </div>
  );
}

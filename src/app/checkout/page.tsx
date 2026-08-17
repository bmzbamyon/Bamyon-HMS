"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { signInWithEmailAndPassword } from "firebase/auth";
import { useAuth } from "@/lib/auth/AuthProvider";
import { auth } from "@/lib/firebase/client";
import { readLocalCart, writeLocalCart } from "@/lib/firestore/cart";
import { placeOrder, InsufficientStockError } from "@/lib/firestore/orders";
import { getWalletBalance } from "@/lib/firestore/wallet";
import { listDeliveryZones, resolveDeliveryZone, FALLBACK_DELIVERY_FEE_MINOR } from "@/lib/firestore/delivery";
import { getActiveAffiliateId, getActiveReferralCode } from "@/lib/firestore/attribution";
import type { Address, CartItem, DeliveryZone, WalletBalance } from "@/types";
import { Price } from "@/components/ui/Price";
import { Button } from "@/components/ui/Button";
import { addMinor } from "@/lib/money";
import { logError } from "@/lib/firestore/errorLog";

const CURRENCY = process.env.NEXT_PUBLIC_DEFAULT_CURRENCY ?? "NGN";
const NEW_ACCOUNT_CREDS_KEY = "bamyon:newAccountCreds";

export default function CheckoutPage() {
  const { firebaseUser, appUser } = useAuth();
  const router = useRouter();

  const [items, setItems] = useState<CartItem[]>([]);
  const [wallet, setWallet] = useState<WalletBalance | null>(null);
  const [zones, setZones] = useState<DeliveryZone[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<"wallet" | "paystack" | "bank_transfer">("paystack");
  const [useSavedAddressId, setUseSavedAddressId] = useState<string>("new");
  const [address, setAddress] = useState<Address>({
    id: "checkout",
    label: "Delivery address",
    fullName: appUser?.name ?? "",
    phone: appUser?.phone ?? "",
    countryCode: "+234",
    state: "",
    city: "",
    line1: "",
    isDefault: true,
  });
  const [placing, setPlacing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [guestName, setGuestName] = useState("");
  const [guestEmail, setGuestEmail] = useState("");

  useEffect(() => {
    setItems(readLocalCart());
    listDeliveryZones().then(setZones);
    if (firebaseUser) {
      getWalletBalance(firebaseUser.uid).then(setWallet);
    }
  }, [firebaseUser]);

  useEffect(() => {
    if (!appUser) return;
    const defaultAddress = appUser.addresses.find((a) => a.isDefault) ?? appUser.addresses[0];
    if (defaultAddress) {
      setAddress(defaultAddress);
      setUseSavedAddressId(defaultAddress.id);
    }
  }, [appUser]);

  const subtotalMinor = addMinor(...items.map((i) => i.priceMinorSnapshot * i.quantity));
  const matchedZone = resolveDeliveryZone(zones, address);
  const deliveryFeeMinor = matchedZone ? matchedZone.feeMinor : FALLBACK_DELIVERY_FEE_MINOR;
  const totalMinor = addMinor(subtotalMinor, deliveryFeeMinor);
  const insufficientWallet =
    paymentMethod === "wallet" && (!wallet || wallet.availableMinor < totalMinor);

  if (!firebaseUser || !appUser) {
    return (
      <div className="mx-auto max-w-md space-y-6">
        <div className="text-center">
          <h1 className="font-display text-xl font-bold text-ink">Checkout</h1>
          <p className="mt-1 text-sm text-ink-muted">
            Sign in, or continue as a guest — we'll create your account automatically once your
            order is confirmed, and show you the login.
          </p>
        </div>
        <div className="space-y-3 rounded-card border border-surface-muted bg-surface p-5">
          <input
            placeholder="Full name"
            value={guestName}
            onChange={(e) => setGuestName(e.target.value)}
            className="w-full rounded-card border border-surface-muted px-3 py-2 text-sm"
          />
          <input
            type="email"
            placeholder="Email"
            value={guestEmail}
            onChange={(e) => setGuestEmail(e.target.value)}
            className="w-full rounded-card border border-surface-muted px-3 py-2 text-sm"
          />
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          <Button
            className="w-full"
            loading={placing}
            onClick={async () => {
              if (!guestName || !guestEmail) {
                setError("Please enter your name and email to continue as a guest.");
                return;
              }
              setError(null);
              setPlacing(true);
              try {
                const res = await fetch("/api/checkout/guest-account", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ name: guestName, email: guestEmail }),
                });
                const json = await res.json();
                if (!res.ok) {
                  if (json.error === "ACCOUNT_EXISTS") {
                    router.push(`/login?next=/checkout&email=${encodeURIComponent(guestEmail)}`);
                    return;
                  }
                  throw new Error(json.error);
                }
                window.localStorage.setItem(
                  NEW_ACCOUNT_CREDS_KEY,
                  JSON.stringify({ email: json.email, password: json.password })
                );
                await signInWithEmailAndPassword(auth, json.email, json.password);
                // AuthProvider's onAuthStateChanged will pick up the new
                // session and re-render this page as signed-in automatically.
              } catch (err) {
                setError(err instanceof Error ? err.message : "Could not continue as guest.");
              } finally {
                setPlacing(false);
              }
            }}
          >
            Continue as guest
          </Button>
        </div>
        <p className="text-center text-sm text-ink-muted">
          Already have an account? <a href="/login?next=/checkout" className="font-medium text-brand">Sign in</a>
        </p>
      </div>
    );
  }

  if (items.length === 0) {
    return <p className="text-ink-muted">Your cart is empty. <a href="/shop" className="text-brand">Go shopping →</a></p>;
  }

  async function handlePlaceOrder() {
    setError(null);
    if (!address.line1 || !address.city || !address.state || !address.phone) {
      setError("Please fill in your full delivery address and phone number.");
      return;
    }
    setPlacing(true);
    try {
      const attribution = {
        affiliateId: getActiveAffiliateId(),
        referralCode: getActiveReferralCode(),
      };

      if (paymentMethod === "wallet") {
        const { orderId } = await placeOrder({
          userId: firebaseUser!.uid,
          items,
          deliveryAddress: address,
          deliveryFeeMinor,
          currency: CURRENCY,
          paymentMethod: "wallet",
          ...attribution,
        });
        writeLocalCart([]);
        router.push(`/orders?placed=${orderId}`);
        return;
      }

      if (paymentMethod === "bank_transfer") {
        const { orderId } = await placeOrder({
          userId: firebaseUser!.uid,
          items,
          deliveryAddress: address,
          deliveryFeeMinor,
          currency: CURRENCY,
          paymentMethod: "bank_transfer",
          ...attribution,
        });
        writeLocalCart([]);
        router.push(`/orders?placed=${orderId}&bankTransfer=1`);
        return;
      }

      // Paystack: create the order first (pending), then hand off to the
      // hosted checkout. Stock is reserved the moment the order is created,
      // just like every other payment method — see placeOrder().
      const { orderId, totalMinor: serverTotal } = await placeOrder({
        userId: firebaseUser!.uid,
        items,
        deliveryAddress: address,
        deliveryFeeMinor,
        currency: CURRENCY,
        paymentMethod: "paystack",
        ...attribution,
      });

      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: firebaseUser!.uid,
          email: firebaseUser!.email,
          amountMinor: serverTotal,
          currency: CURRENCY,
          purpose: "order_payment",
          orderId,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Could not start payment.");
      writeLocalCart([]);
      window.location.href = json.authorizationUrl;
    } catch (err) {
      if (err instanceof InsufficientStockError) {
        setError(err.message);
      } else {
        setError(err instanceof Error ? err.message : "Could not place order.");
      }
      logError({ error: err, context: "checkout.placeOrder", userId: firebaseUser?.uid });
    } finally {
      setPlacing(false);
    }
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
      <div className="space-y-6">
        <h1 className="font-display text-2xl font-bold text-ink">Checkout</h1>

        <section className="space-y-3 rounded-card border border-surface-muted bg-surface p-5">
          <p className="font-semibold text-ink">Delivery address</p>
          {appUser.addresses.length > 0 ? (
            <select
              value={useSavedAddressId}
              onChange={(e) => {
                setUseSavedAddressId(e.target.value);
                const found = appUser.addresses.find((a) => a.id === e.target.value);
                if (found) setAddress(found);
              }}
              className="w-full rounded-card border border-surface-muted px-3 py-2 text-sm"
            >
              {appUser.addresses.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.label} — {a.line1}, {a.city}
                </option>
              ))}
              <option value="new">+ Use a new address</option>
            </select>
          ) : null}
          <div className="grid gap-3 sm:grid-cols-2">
            <input
              placeholder="Full name"
              value={address.fullName}
              onChange={(e) => setAddress({ ...address, fullName: e.target.value })}
              className="rounded-card border border-surface-muted px-3 py-2 text-sm"
            />
            <input
              placeholder="Phone (e.g. 234...)"
              value={address.phone}
              onChange={(e) => setAddress({ ...address, phone: e.target.value })}
              className="rounded-card border border-surface-muted px-3 py-2 text-sm"
            />
            <input
              placeholder="State"
              value={address.state}
              onChange={(e) => setAddress({ ...address, state: e.target.value })}
              className="rounded-card border border-surface-muted px-3 py-2 text-sm"
            />
            <input
              placeholder="City"
              value={address.city}
              onChange={(e) => setAddress({ ...address, city: e.target.value })}
              className="rounded-card border border-surface-muted px-3 py-2 text-sm"
            />
            <input
              placeholder="Street address"
              value={address.line1}
              onChange={(e) => setAddress({ ...address, line1: e.target.value })}
              className="rounded-card border border-surface-muted px-3 py-2 text-sm sm:col-span-2"
            />
          </div>
        </section>

        <section className="space-y-3 rounded-card border border-surface-muted bg-surface p-5">
          <p className="font-semibold text-ink">Payment method</p>
          <div className="space-y-2">
            <PaymentOption
              label="Pay with Paystack"
              active={paymentMethod === "paystack"}
              onClick={() => setPaymentMethod("paystack")}
            />
            <PaymentOption
              label={`Pay with wallet ${wallet ? `(${CURRENCY} balance available)` : ""}`}
              active={paymentMethod === "wallet"}
              onClick={() => setPaymentMethod("wallet")}
            />
            <PaymentOption
              label="Bank transfer (manual confirmation)"
              active={paymentMethod === "bank_transfer"}
              onClick={() => setPaymentMethod("bank_transfer")}
            />
          </div>
          {insufficientWallet ? (
            <p className="text-sm text-red-600">
              Wallet balance is insufficient.{" "}
              <a href="/wallet" className="underline">Top up your wallet</a>.
            </p>
          ) : null}
        </section>

        {error ? <p className="text-sm text-red-600">{error}</p> : null}
      </div>

      <div className="h-fit space-y-3 rounded-card border border-surface-muted bg-surface p-5">
        <div className="flex justify-between text-sm">
          <span className="text-ink-muted">Subtotal</span>
          <Price amountMinor={subtotalMinor} currency={CURRENCY} size="sm" />
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-ink-muted">
            Delivery {matchedZone ? `(${matchedZone.estimateDaysMin}-${matchedZone.estimateDaysMax} days)` : "(estimate)"}
          </span>
          <Price amountMinor={deliveryFeeMinor} currency={CURRENCY} size="sm" />
        </div>
        <div className="flex justify-between border-t border-surface-muted pt-3 font-semibold">
          <span>Total</span>
          <Price amountMinor={totalMinor} currency={CURRENCY} size="md" />
        </div>
        <Button
          className="w-full"
          onClick={handlePlaceOrder}
          loading={placing}
          disabled={insufficientWallet}
        >
          Place order
        </Button>
      </div>
    </div>
  );
}

function PaymentOption({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full rounded-card border px-4 py-2.5 text-left text-sm font-medium ${
        active ? "border-brand bg-brand-light text-brand-dark" : "border-surface-muted text-ink"
      }`}
    >
      {label}
    </button>
  );
}

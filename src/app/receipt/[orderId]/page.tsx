"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { STORE_ID } from "@/lib/tenant";
import { getOrder } from "@/lib/firestore/orders";
import { useAuth } from "@/lib/auth/AuthProvider";
import { isStaffOrAdmin } from "@/lib/auth/permissions";
import type { Order, Store } from "@/types";
import { ReceiptDocument } from "@/components/receipt/ReceiptDocument";
import { Button } from "@/components/ui/Button";

export default function ReceiptPage() {
  const params = useParams<{ orderId: string }>();
  const router = useRouter();
  const { firebaseUser, appUser, loading: authLoading } = useAuth();

  const [order, setOrder] = useState<Order | null>(null);
  const [store, setStore] = useState<Store | null>(null);
  const [loading, setLoading] = useState(true);
  const [denied, setDenied] = useState(false);

  useEffect(() => {
    if (authLoading || !firebaseUser) return;
    (async () => {
      const [o, storeSnap] = await Promise.all([
        getOrder(params.orderId),
        getDoc(doc(db, "stores", STORE_ID)),
      ]);
      if (!o) {
        setLoading(false);
        return;
      }
      const allowed = o.userId === firebaseUser.uid || isStaffOrAdmin(appUser);
      if (!allowed) {
        setDenied(true);
        setLoading(false);
        return;
      }
      setOrder(o);
      setStore(storeSnap.exists() ? (storeSnap.data() as Store) : null);
      setLoading(false);
    })();
  }, [params.orderId, firebaseUser, appUser, authLoading]);

  if (authLoading || loading) return <p className="p-8 text-center text-sm text-ink-muted">Loading receipt…</p>;

  if (!firebaseUser) {
    return (
      <div className="p-8 text-center">
        <a href={`/login?next=/receipt/${params.orderId}`} className="text-brand">Sign in to view this receipt →</a>
      </div>
    );
  }

  if (denied || !order) {
    return <p className="p-8 text-center text-sm text-ink-muted">Receipt not found or you don't have access to it.</p>;
  }

  return (
    <div className="space-y-4 py-8">
      <div className="print-hide mx-auto flex max-w-2xl justify-between px-4">
        <button onClick={() => router.back()} className="text-sm text-ink-muted">← Back</button>
        <Button size="sm" onClick={() => window.print()}>Print receipt</Button>
      </div>
      <ReceiptDocument order={order} store={store} />
    </div>
  );
}

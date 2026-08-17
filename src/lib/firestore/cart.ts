import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { STORE_ID } from "@/lib/tenant";
import type { Cart, CartItem } from "@/types";

const LOCAL_KEY = `bamyon:${STORE_ID}:cart`;

/** Guests keep a cart in localStorage. Nothing here is trusted at checkout —
 * placeOrder() always re-reads live price/stock from Firestore. */
export function readLocalCart(): CartItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(LOCAL_KEY);
    return raw ? (JSON.parse(raw) as CartItem[]) : [];
  } catch {
    return [];
  }
}

export function writeLocalCart(items: CartItem[]): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(LOCAL_KEY, JSON.stringify(items));
}

export function addLocalItem(item: CartItem): CartItem[] {
  const items = readLocalCart();
  const existing = items.find((i) => i.variantId === item.variantId);
  const next = existing
    ? items.map((i) =>
        i.variantId === item.variantId ? { ...i, quantity: i.quantity + item.quantity } : i
      )
    : [...items, item];
  writeLocalCart(next);
  return next;
}

export function removeLocalItem(variantId: string): CartItem[] {
  const next = readLocalCart().filter((i) => i.variantId !== variantId);
  writeLocalCart(next);
  return next;
}

export function setLocalItemQuantity(variantId: string, quantity: number): CartItem[] {
  const next = readLocalCart()
    .map((i) => (i.variantId === variantId ? { ...i, quantity } : i))
    .filter((i) => i.quantity > 0);
  writeLocalCart(next);
  return next;
}

/** Signed-in users get their cart persisted so it survives across devices. */
export async function syncCartToFirestore(uid: string, items: CartItem[]): Promise<void> {
  const ref = doc(db, "stores", STORE_ID, "carts", uid);
  const cart: Omit<Cart, "updatedAt"> = { storeId: STORE_ID, ownerId: uid, items };
  await setDoc(ref, { ...cart, updatedAt: serverTimestamp() }, { merge: true });
}

export async function loadCartFromFirestore(uid: string): Promise<CartItem[]> {
  const snap = await getDoc(doc(db, "stores", STORE_ID, "carts", uid));
  if (!snap.exists()) return [];
  return (snap.data() as Cart).items;
}

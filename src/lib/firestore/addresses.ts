import { doc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { STORE_ID } from "@/lib/tenant";
import type { Address } from "@/types";

/**
 * Addresses are stored as an array on the user document rather than a
 * subcollection — a customer rarely has more than a handful, and keeping
 * them inline means the whole address book loads with the profile in one
 * read instead of a second query on every checkout.
 */
export async function saveAddress(userId: string, addresses: Address[], newAddress: Address): Promise<Address[]> {
  const next = newAddress.isDefault
    ? [...addresses.map((a) => ({ ...a, isDefault: false })), newAddress]
    : [...addresses, newAddress];
  await updateDoc(doc(db, "stores", STORE_ID, "users", userId), { addresses: next, updatedAt: Date.now() });
  return next;
}

export async function removeAddress(userId: string, addresses: Address[], addressId: string): Promise<Address[]> {
  const next = addresses.filter((a) => a.id !== addressId);
  await updateDoc(doc(db, "stores", STORE_ID, "users", userId), { addresses: next, updatedAt: Date.now() });
  return next;
}

export function generateAddressId(): string {
  return `addr_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

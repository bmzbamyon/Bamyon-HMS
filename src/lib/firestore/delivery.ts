import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { STORE_ID } from "@/lib/tenant";
import type { Address, DeliveryZone } from "@/types";

const zonesCol = () => collection(db, "stores", STORE_ID, "deliveryZones");

export async function listDeliveryZones(): Promise<DeliveryZone[]> {
  const snap = await getDocs(query(zonesCol(), orderBy("createdAt", "asc")));
  return snap.docs.map((d) => d.data() as DeliveryZone);
}

export async function createDeliveryZone(
  input: Omit<DeliveryZone, "id" | "storeId" | "createdAt" | "updatedAt">
): Promise<string> {
  const ref = doc(zonesCol());
  await setDoc(ref, {
    ...input,
    id: ref.id,
    storeId: STORE_ID,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

export async function deleteDeliveryZone(zoneId: string): Promise<void> {
  await deleteDoc(doc(zonesCol(), zoneId));
}

/**
 * Resolves the delivery fee/estimate for an address against configured
 * zones. Falls back to whichever zone is marked `isDefault`, and if the
 * merchant hasn't configured any zones at all, falls back to a clearly
 * labelled flat rate so checkout never breaks for a brand-new store.
 */
export function resolveDeliveryZone(
  zones: DeliveryZone[],
  address: Pick<Address, "state">
): DeliveryZone | null {
  const stateLower = address.state?.toLowerCase().trim();
  const matched = zones.find((z) => z.states.some((s) => s.toLowerCase().trim() === stateLower));
  if (matched) return matched;
  return zones.find((z) => z.isDefault) ?? null;
}

export const FALLBACK_DELIVERY_FEE_MINOR = 250000; // ₦2,500 — used only if the store has zero configured zones

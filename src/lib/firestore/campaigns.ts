import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { STORE_ID } from "@/lib/tenant";
import type { Campaign } from "@/types";

const campaignsCol = () => collection(db, "stores", STORE_ID, "campaigns");

export async function listAllCampaignsForAdmin(): Promise<Campaign[]> {
  const snap = await getDocs(query(campaignsCol(), orderBy("sortOrder", "asc")));
  return snap.docs.map((d) => d.data() as Campaign);
}

/** Storefront: only campaigns that are enabled AND currently within their date window. */
export async function listActiveCampaigns(): Promise<Campaign[]> {
  const all = await listAllCampaignsForAdmin();
  const now = Date.now();
  return all.filter((c) => {
    if (!c.enabled) return false;
    if (c.startsAt && now < c.startsAt) return false;
    if (c.endsAt && now > c.endsAt) return false;
    return true;
  });
}

export async function createCampaign(
  input: Omit<Campaign, "id" | "storeId" | "createdAt" | "updatedAt">
): Promise<string> {
  const ref = doc(campaignsCol());
  await setDoc(ref, {
    ...input,
    id: ref.id,
    storeId: STORE_ID,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

export async function updateCampaign(id: string, patch: Partial<Campaign>): Promise<void> {
  await updateDoc(doc(campaignsCol(), id), { ...patch, updatedAt: serverTimestamp() });
}

export async function deleteCampaign(id: string): Promise<void> {
  await deleteDoc(doc(campaignsCol(), id));
}

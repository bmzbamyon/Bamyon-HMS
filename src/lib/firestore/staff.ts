import { collection, doc, getDocs, orderBy, query, serverTimestamp, setDoc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { STORE_ID } from "@/lib/tenant";
import type { Permission, StaffInvite, StaffProfile } from "@/types";

const invitesCol = () => collection(db, "stores", STORE_ID, "staffInvites");
const staffProfilesCol = () => collection(db, "stores", STORE_ID, "staffProfiles");

export async function createStaffInvite(params: {
  email: string;
  label: string;
  permissions: Permission[];
  invitedByUid: string;
}): Promise<void> {
  const email = params.email.trim().toLowerCase();
  await setDoc(doc(invitesCol(), email), {
    email,
    storeId: STORE_ID,
    label: params.label,
    permissions: params.permissions,
    invitedByUid: params.invitedByUid,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export async function listStaffInvites(): Promise<StaffInvite[]> {
  const snap = await getDocs(query(invitesCol(), orderBy("createdAt", "desc")));
  return snap.docs.map((d) => d.data() as StaffInvite);
}

export async function listStaffProfiles(): Promise<StaffProfile[]> {
  const snap = await getDocs(query(staffProfilesCol(), orderBy("createdAt", "desc")));
  return snap.docs.map((d) => d.data() as StaffProfile);
}

export async function updateStaffPermissions(uid: string, permissions: Permission[]): Promise<void> {
  await updateDoc(doc(staffProfilesCol(), uid), { permissions, updatedAt: serverTimestamp() });
}

export async function setStaffStatus(uid: string, status: StaffProfile["status"]): Promise<void> {
  await updateDoc(doc(staffProfilesCol(), uid), { status, updatedAt: serverTimestamp() });
}

export const PERMISSION_GROUPS: { label: string; permissions: Permission[] }[] = [
  { label: "Products", permissions: ["products.read", "products.write"] },
  { label: "Orders", permissions: ["orders.read", "orders.update"] },
  { label: "Customers", permissions: ["customers.read"] },
  { label: "Wallet & finance", permissions: ["wallet.read", "wallet.verify", "wallet.adjust"] },
  { label: "Reviews", permissions: ["reviews.moderate"] },
  { label: "Content", permissions: ["blog.publish", "community.moderate"] },
  { label: "Analytics", permissions: ["analytics.read"] },
  { label: "Settings", permissions: ["settings.theme"] },
  { label: "Staff", permissions: ["staff.manage"] },
  { label: "Affiliate", permissions: ["affiliate.manage"] },
  { label: "POS", permissions: ["pos.operate"] },
];

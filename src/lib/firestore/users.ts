import { collection, doc, getDoc, getDocs, limit as fsLimit, orderBy, query } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { STORE_ID } from "@/lib/tenant";
import type { AppUser } from "@/types";

const usersCol = () => collection(db, "stores", STORE_ID, "users");

/** Admin/staff CRM listing — requires `customers.read`, enforced by firestore.rules. */
export async function listCustomers(): Promise<AppUser[]> {
  const q = query(usersCol(), orderBy("createdAt", "desc"), fsLimit(200));
  const snap = await getDocs(q);
  return snap.docs.map((d) => d.data() as AppUser).filter((u) => u.role === "customer");
}

export async function getCustomer(uid: string): Promise<AppUser | null> {
  const snap = await getDoc(doc(usersCol(), uid));
  return snap.exists() ? (snap.data() as AppUser) : null;
}

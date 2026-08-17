import { collection, doc, getDocs, limit as fsLimit, orderBy, query, serverTimestamp, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { STORE_ID } from "@/lib/tenant";
import type { AuditLogEntry } from "@/types";

const auditCol = () => collection(db, "stores", STORE_ID, "auditLogs");

export async function writeAuditLog(entry: {
  actorId: string;
  action: string;
  targetType: string;
  targetId: string;
  before?: unknown;
  after?: unknown;
}): Promise<void> {
  const ref = doc(auditCol());
  await setDoc(ref, {
    ...entry,
    id: ref.id,
    storeId: STORE_ID,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export async function listAuditLogs(): Promise<AuditLogEntry[]> {
  const q = query(auditCol(), orderBy("createdAt", "desc"), fsLimit(200));
  const snap = await getDocs(q);
  return snap.docs.map((d) => d.data() as AuditLogEntry);
}

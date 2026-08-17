import {
  collection,
  doc,
  getDocs,
  limit as fsLimit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { STORE_ID } from "@/lib/tenant";
import type { StaffAttendanceEntry } from "@/types";

const attendanceCol = () => collection(db, "stores", STORE_ID, "staffAttendance");

export async function getOpenShift(staffUid: string): Promise<StaffAttendanceEntry | null> {
  const q = query(
    attendanceCol(),
    where("staffUid", "==", staffUid),
    where("clockOutAt", "==", null),
    fsLimit(1)
  );
  const snap = await getDocs(q);
  return snap.empty ? null : (snap.docs[0]!.data() as StaffAttendanceEntry);
}

export async function clockIn(staffUid: string, staffName: string): Promise<void> {
  const existing = await getOpenShift(staffUid);
  if (existing) return; // already clocked in — idempotent
  const ref = doc(attendanceCol());
  await setDoc(ref, {
    id: ref.id,
    storeId: STORE_ID,
    staffUid,
    staffName,
    clockInAt: Date.now(),
    clockOutAt: null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export async function clockOut(staffUid: string): Promise<void> {
  const open = await getOpenShift(staffUid);
  if (!open) return;
  await updateDoc(doc(attendanceCol(), open.id), { clockOutAt: Date.now(), updatedAt: serverTimestamp() });
}

/** Admin: full attendance history, most recent first. */
export async function listAllAttendance(): Promise<StaffAttendanceEntry[]> {
  const q = query(attendanceCol(), orderBy("createdAt", "desc"), fsLimit(300));
  const snap = await getDocs(q);
  return snap.docs.map((d) => d.data() as StaffAttendanceEntry);
}

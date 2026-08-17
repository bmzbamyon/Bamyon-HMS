import {
  collection,
  doc,
  getDocs,
  limit as fsLimit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { STORE_ID } from "@/lib/tenant";
import type { AppNotification, NotificationType } from "@/types";

const notificationsCol = () => collection(db, "stores", STORE_ID, "notifications");

export async function createNotification(input: {
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  link?: string;
}): Promise<void> {
  const ref = doc(notificationsCol());
  await setDoc(ref, {
    ...input,
    id: ref.id,
    storeId: STORE_ID,
    readAt: null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export function subscribeToNotifications(
  userId: string,
  cb: (notifications: AppNotification[]) => void
): () => void {
  const q = query(
    notificationsCol(),
    where("userId", "==", userId),
    orderBy("createdAt", "desc"),
    fsLimit(50)
  );
  return onSnapshot(q, (snap) => cb(snap.docs.map((d) => d.data() as AppNotification)));
}

export async function markNotificationRead(id: string): Promise<void> {
  await updateDoc(doc(notificationsCol(), id), { readAt: Date.now(), updatedAt: serverTimestamp() });
}

export async function markAllNotificationsRead(userId: string): Promise<void> {
  const q = query(notificationsCol(), where("userId", "==", userId), where("readAt", "==", null));
  const snap = await getDocs(q);
  await Promise.all(snap.docs.map((d) => updateDoc(d.ref, { readAt: Date.now(), updatedAt: serverTimestamp() })));
}

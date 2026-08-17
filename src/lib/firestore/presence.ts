import { doc, onSnapshot, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { STORE_ID } from "@/lib/tenant";

const ONLINE_WINDOW_MS = 2 * 60 * 1000; // "online" if seen in the last 2 minutes

export function isRecentlyOnline(lastSeenAt: number | undefined | null): boolean {
  if (!lastSeenAt) return false;
  return Date.now() - lastSeenAt < ONLINE_WINDOW_MS;
}

export async function pingPresence(uid: string): Promise<void> {
  try {
    await updateDoc(doc(db, "stores", STORE_ID, "users", uid), { lastSeenAt: Date.now() });
  } catch {
    // best-effort — presence is a nice-to-have, never worth surfacing an error for
  }
}

/** Subscribes to a single user's lastSeenAt for a live online/offline dot. */
export function subscribeToPresence(uid: string, cb: (online: boolean) => void): () => void {
  return onSnapshot(doc(db, "stores", STORE_ID, "users", uid), (snap) => {
    cb(isRecentlyOnline(snap.exists() ? (snap.data().lastSeenAt as number | undefined) : undefined));
  });
}

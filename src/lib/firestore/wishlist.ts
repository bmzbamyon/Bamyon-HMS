import { collection, deleteDoc, doc, getDocs, onSnapshot, serverTimestamp, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { STORE_ID } from "@/lib/tenant";
import type { WishlistItem } from "@/types";

const wishlistCol = (userId: string) => collection(db, "stores", STORE_ID, "users", userId, "wishlistItems");

export async function toggleWishlist(userId: string, productId: string, isWishlisted: boolean): Promise<void> {
  const ref = doc(wishlistCol(userId), productId);
  if (isWishlisted) {
    await deleteDoc(ref);
  } else {
    await setDoc(ref, {
      id: productId,
      storeId: STORE_ID,
      userId,
      productId,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }
}

export async function listWishlistProductIds(userId: string): Promise<string[]> {
  const snap = await getDocs(wishlistCol(userId));
  return snap.docs.map((d) => (d.data() as WishlistItem).productId);
}

export function subscribeToWishlist(userId: string, cb: (productIds: string[]) => void): () => void {
  return onSnapshot(wishlistCol(userId), (snap) =>
    cb(snap.docs.map((d) => (d.data() as WishlistItem).productId))
  );
}

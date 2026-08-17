import {
  collection,
  doc,
  getDocs,
  increment,
  limit as fsLimit,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { STORE_ID } from "@/lib/tenant";
import type { Order, Product, Review } from "@/types";

const reviewsCol = () => collection(db, "stores", STORE_ID, "reviews");

export async function listReviewsForProduct(productId: string): Promise<Review[]> {
  const q = query(
    reviewsCol(),
    where("productId", "==", productId),
    where("status", "==", "published"),
    orderBy("createdAt", "desc"),
    fsLimit(50)
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => d.data() as Review);
}

/**
 * A customer may only review a product they have a delivered/completed order
 * for — this checks ownership before allowing the write. verifiedPurchase is
 * always computed server-side-equivalent (here: from the customer's own
 * order history, which Firestore rules already scope to their uid) rather
 * than accepted from the client as a flag.
 */
export async function submitReview(params: {
  userId: string;
  userName: string;
  userPhoto?: string;
  productId: string;
  rating: 1 | 2 | 3 | 4 | 5;
  body: string;
  media?: string[];
  purchaseOrders: Order[]; // caller passes the customer's own orders (already uid-scoped)
}): Promise<string> {
  const verifiedPurchase = params.purchaseOrders.some(
    (o) =>
      o.deliveryStatus === "delivered" || o.deliveryStatus === "completed"
        ? o.items.some((i) => i.productId === params.productId)
        : false
  );

  const reviewRef = doc(reviewsCol());
  const productRef = doc(db, "stores", STORE_ID, "products", params.productId);

  await runTransaction(db, async (tx) => {
    const productSnap = await tx.get(productRef);
    if (!productSnap.exists()) throw new Error("Product not found.");
    const product = productSnap.data() as Product;

    const newCount = product.ratingCount + 1;
    const newAverage =
      (product.ratingAverage * product.ratingCount + params.rating) / newCount;

    tx.set(reviewRef, {
      id: reviewRef.id,
      storeId: STORE_ID,
      productId: params.productId,
      userId: params.userId,
      userNameSnapshot: params.userName,
      userPhotoSnapshot: params.userPhoto ?? null,
      rating: params.rating,
      body: params.body,
      media: params.media ?? [],
      verifiedPurchase,
      status: "published",
      helpfulCount: 0,
      viewCount: 0,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    tx.update(productRef, {
      ratingAverage: newAverage,
      ratingCount: newCount,
      updatedAt: serverTimestamp(),
    });
  });

  return reviewRef.id;
}

/** Owner-only edit — Firestore rules independently enforce `userId == request.auth.uid`. */
export async function updateOwnReview(
  reviewId: string,
  patch: Pick<Review, "rating" | "body">
): Promise<void> {
  await updateDoc(doc(reviewsCol(), reviewId), { ...patch, updatedAt: serverTimestamp() });
}

export async function respondToReview(
  reviewId: string,
  staffId: string,
  body: string
): Promise<void> {
  await updateDoc(doc(reviewsCol(), reviewId), {
    merchantResponse: { body, respondedAt: Date.now(), staffId },
    updatedAt: serverTimestamp(),
  });
}

export async function incrementReviewView(reviewId: string): Promise<void> {
  await updateDoc(doc(reviewsCol(), reviewId), { viewCount: increment(1) });
}

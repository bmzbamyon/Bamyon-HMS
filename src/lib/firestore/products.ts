import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
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
import type { Product, Variant } from "@/types";

const productsCol = () => collection(db, "stores", STORE_ID, "products");
const variantsCol = (productId: string) =>
  collection(db, "stores", STORE_ID, "products", productId, "variants");

/** Public catalogue read: published products only. No demo data — an empty
 * catalogue returns an empty array and the UI renders a real empty state. */
export async function listPublishedProducts(opts?: {
  categoryId?: string;
  take?: number;
}): Promise<Product[]> {
  const clauses = [where("status", "==", "published")];
  if (opts?.categoryId) {
    clauses.push(where("categoryIds", "array-contains", opts.categoryId));
  }
  const q = query(
    productsCol(),
    ...clauses,
    orderBy("createdAt", "desc"),
    fsLimit(opts?.take ?? 24)
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => d.data() as Product);
}

export async function getProductBySlug(slug: string): Promise<Product | null> {
  const q = query(productsCol(), where("slug", "==", slug), fsLimit(1));
  const snap = await getDocs(q);
  if (snap.empty) return null;
  return snap.docs[0]!.data() as Product;
}

export async function getProductVariants(productId: string): Promise<Variant[]> {
  const snap = await getDocs(variantsCol(productId));
  return snap.docs.map((d) => d.data() as Variant);
}

/** Admin/staff: create a product in draft status. No auto-publish. */
export async function createProduct(
  input: Omit<Product, "id" | "storeId" | "createdAt" | "updatedAt" | "ratingAverage" | "ratingCount">
): Promise<string> {
  const ref = doc(productsCol());
  const product: Product = {
    ...input,
    id: ref.id,
    storeId: STORE_ID,
    ratingAverage: 0,
    ratingCount: 0,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  await setDoc(ref, { ...product, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
  return ref.id;
}

export async function updateProduct(productId: string, patch: Partial<Product>): Promise<void> {
  const ref = doc(db, "stores", STORE_ID, "products", productId);
  await updateDoc(ref, { ...patch, updatedAt: serverTimestamp() });
}

export async function deleteProduct(productId: string): Promise<void> {
  await deleteDoc(doc(db, "stores", STORE_ID, "products", productId));
}

export async function createVariant(
  productId: string,
  input: Omit<Variant, "id" | "storeId" | "productId" | "createdAt" | "updatedAt">
): Promise<string> {
  const ref = doc(variantsCol(productId));
  await setDoc(ref, {
    ...input,
    id: ref.id,
    storeId: STORE_ID,
    productId,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

export async function updateVariant(
  productId: string,
  variantId: string,
  patch: Partial<Variant>
): Promise<void> {
  const ref = doc(db, "stores", STORE_ID, "products", productId, "variants", variantId);
  await updateDoc(ref, { ...patch, updatedAt: serverTimestamp() });
}

/** Admin listing includes drafts/archived — used only behind an admin route guard. */
export async function listAllProductsForAdmin(): Promise<Product[]> {
  const q = query(productsCol(), orderBy("updatedAt", "desc"), fsLimit(200));
  const snap = await getDocs(q);
  return snap.docs.map((d) => d.data() as Product);
}

export async function getProduct(productId: string): Promise<Product | null> {
  const snap = await getDoc(doc(db, "stores", STORE_ID, "products", productId));
  return snap.exists() ? (snap.data() as Product) : null;
}

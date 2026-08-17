import {
  collection,
  doc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  where,
  limit as fsLimit,
} from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { STORE_ID } from "@/lib/tenant";
import type { Category } from "@/types";

const categoriesCol = () => collection(db, "stores", STORE_ID, "categories");

export async function listCategories(): Promise<Category[]> {
  const q = query(categoriesCol(), orderBy("sortOrder", "asc"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => d.data() as Category);
}

export async function getCategoryBySlug(slug: string): Promise<Category | null> {
  const q = query(categoriesCol(), where("slug", "==", slug), fsLimit(1));
  const snap = await getDocs(q);
  if (snap.empty) return null;
  return snap.docs[0]!.data() as Category;
}

export async function createCategory(
  input: Omit<Category, "id" | "storeId" | "createdAt" | "updatedAt">
): Promise<string> {
  const ref = doc(categoriesCol());
  await setDoc(ref, {
    ...input,
    id: ref.id,
    storeId: STORE_ID,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

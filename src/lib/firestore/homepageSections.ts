import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  documentId,
  limit as fsLimit,
} from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { STORE_ID } from "@/lib/tenant";
import type { HomepageSection, Product } from "@/types";

const sectionsCol = () => collection(db, "stores", STORE_ID, "homepageSections");

export async function listAllSectionsForAdmin(): Promise<HomepageSection[]> {
  const snap = await getDocs(query(sectionsCol(), orderBy("sortOrder", "asc")));
  return snap.docs.map((d) => d.data() as HomepageSection);
}

export async function listEnabledSections(): Promise<HomepageSection[]> {
  const all = await listAllSectionsForAdmin();
  return all.filter((s) => s.enabled);
}

export async function createSection(
  input: Omit<HomepageSection, "id" | "storeId" | "createdAt" | "updatedAt">
): Promise<string> {
  const ref = doc(sectionsCol());
  await setDoc(ref, {
    ...input,
    id: ref.id,
    storeId: STORE_ID,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

export async function updateSection(id: string, patch: Partial<HomepageSection>): Promise<void> {
  await updateDoc(doc(sectionsCol(), id), { ...patch, updatedAt: serverTimestamp() });
}

export async function deleteSection(id: string): Promise<void> {
  await deleteDoc(doc(sectionsCol(), id));
}

export async function reorderSections(orderedIds: string[]): Promise<void> {
  await Promise.all(
    orderedIds.map((id, index) => updateDoc(doc(sectionsCol(), id), { sortOrder: index, updatedAt: serverTimestamp() }))
  );
}

/** Resolves a section's actual product list based on its source type. */
export async function resolveSectionProducts(section: HomepageSection): Promise<Product[]> {
  const productsCol = collection(db, "stores", STORE_ID, "products");

  if (section.sourceType === "manual") {
    const ids = (section.productIds ?? []).slice(0, 30);
    if (ids.length === 0) return [];
    // Firestore "in" queries cap at 30 values — fine for a manually curated row.
    const snap = await getDocs(query(productsCol, where(documentId(), "in", ids), where("status", "==", "published")));
    return snap.docs.map((d) => d.data() as Product);
  }

  if (section.sourceType === "category" && section.categoryId) {
    const snap = await getDocs(
      query(
        productsCol,
        where("status", "==", "published"),
        where("categoryIds", "array-contains", section.categoryId),
        orderBy("createdAt", "desc"),
        fsLimit(section.take)
      )
    );
    return snap.docs.map((d) => d.data() as Product);
  }

  // "all_published"
  const snap = await getDocs(
    query(productsCol, where("status", "==", "published"), orderBy("createdAt", "desc"), fsLimit(section.take))
  );
  return snap.docs.map((d) => d.data() as Product);
}

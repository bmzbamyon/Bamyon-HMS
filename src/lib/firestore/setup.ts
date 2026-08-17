import { doc, getDoc, runTransaction, serverTimestamp, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { STORE_ID } from "@/lib/tenant";
import { DEFAULT_THEME } from "@/lib/theme/tokens";
import type { Store } from "@/types";

export async function storeExists(): Promise<boolean> {
  const snap = await getDoc(doc(db, "stores", STORE_ID));
  return snap.exists();
}

/**
 * Creates the /stores/{storeId} document from the UI — see the `/setup`
 * page. This is the ONE piece of manual configuration a merchant used to
 * have to do by hand in the Firestore console; now it's a form. Also
 * creates the meta/bootstrap flag that the very next step (claimAdmin)
 * consumes to let the person running setup promote themselves to admin
 * without ever touching Firestore directly.
 */
export async function createStore(params: {
  name: string;
  currency: string;
}): Promise<void> {
  const storeRef = doc(db, "stores", STORE_ID);
  const store: Store = {
    id: STORE_ID,
    name: params.name,
    slug: STORE_ID,
    baseCurrency: params.currency,
    enabledCurrencies: [params.currency],
    branding: {},
    theme: DEFAULT_THEME,
    featureFlags: {
      community: false,
      courses: false,
      affiliate: true,
      referrals: true,
      wallet: true,
      pos: true,
    },
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  await setDoc(storeRef, { ...store, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
  await setDoc(doc(db, "stores", STORE_ID, "meta", "bootstrap"), { claimed: false });
}

/**
 * Promotes the given uid to admin, exactly once — see the transactional
 * rationale in firestore.rules (users/{uid} update + meta/bootstrap
 * update are validated against the SAME consistent transactional read, so
 * this can't be raced into granting admin to two different people).
 */
export async function claimAdmin(uid: string): Promise<void> {
  await runTransaction(db, async (tx) => {
    const bootstrapRef = doc(db, "stores", STORE_ID, "meta", "bootstrap");
    const bootstrapSnap = await tx.get(bootstrapRef);
    if (!bootstrapSnap.exists() || bootstrapSnap.data().claimed) {
      throw new Error("Admin has already been claimed for this store.");
    }
    tx.update(bootstrapRef, { claimed: true });
    tx.update(doc(db, "stores", STORE_ID, "users", uid), { role: "admin", updatedAt: serverTimestamp() });
  });
}

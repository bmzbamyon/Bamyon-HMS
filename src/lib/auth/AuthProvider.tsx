"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  signOut as firebaseSignOut,
  sendPasswordResetEmail,
  sendEmailVerification,
  type User as FirebaseUser,
} from "firebase/auth";
import { doc, onSnapshot, serverTimestamp, setDoc, getDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase/client";
import { STORE_ID } from "@/lib/tenant";
import type { AppUser, StaffInvite } from "@/types";
import { generateReferralCode } from "@/lib/firestore/referral-code";
import { findUserByReferralCode, createPendingReferral } from "@/lib/firestore/referrals";

interface AuthContextValue {
  firebaseUser: FirebaseUser | null;
  appUser: AppUser | null;
  loading: boolean;
  registerWithEmail: (name: string, email: string, password: string, referralCode?: string) => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signOutUser: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

async function ensureUserDocument(fbUser: FirebaseUser) {
  const ref = doc(db, "stores", STORE_ID, "users", fbUser.uid);
  const existing = await getDoc(ref);
  if (existing.exists()) {
    // Already provisioned — just keep emailVerified fresh, never touch role/status here.
    await setDoc(ref, { emailVerified: fbUser.emailVerified, updatedAt: serverTimestamp() }, { merge: true });
    return;
  }

  // Check for a pending staff invite matching this email — see
  // lib/firestore/staff.ts createStaffInvite(). This is how staff accounts
  // get provisioned without firebase-admin: an admin records an invite by
  // email ahead of time, and Firestore rules (see firestore.rules
  // `users create`) only allow a NEW user document to claim role:"staff"
  // if a matching invite already exists — the client can't just grant
  // itself staff access.
  const email = (fbUser.email ?? "").toLowerCase();
  const inviteSnap = email ? await getDoc(doc(db, "stores", STORE_ID, "staffInvites", email)) : null;
  const invite = inviteSnap?.exists() ? (inviteSnap.data() as StaffInvite) : null;

  await setDoc(ref, {
    uid: fbUser.uid,
    storeId: STORE_ID,
    role: invite ? "staff" : "customer",
    status: "customer",
    name: fbUser.displayName ?? fbUser.email?.split("@")[0] ?? "Customer",
    email: fbUser.email ?? "",
    emailVerified: fbUser.emailVerified,
    photoUrl: fbUser.photoURL ?? null,
    referralCode: generateReferralCode(fbUser.uid),
    referredBy: null,
    addresses: [],
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  if (invite) {
    await setDoc(doc(db, "stores", STORE_ID, "staffProfiles", fbUser.uid), {
      uid: fbUser.uid,
      storeId: STORE_ID,
      roleId: "invited",
      permissions: invite.permissions,
      status: "active",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [appUser, setAppUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (fbUser) => {
      setFirebaseUser(fbUser);
      if (!fbUser) {
        setAppUser(null);
        setLoading(false);
        return;
      }
      await ensureUserDocument(fbUser);
      const ref = doc(db, "stores", STORE_ID, "users", fbUser.uid);
      const unsubDoc = onSnapshot(ref, (snap) => {
        setAppUser(snap.exists() ? (snap.data() as AppUser) : null);
        setLoading(false);
      });
      return () => unsubDoc();
    });
    return () => unsub();
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      firebaseUser,
      appUser,
      loading,
      async registerWithEmail(name, email, password, referralCode) {
        const cred = await createUserWithEmailAndPassword(auth, email, password);
        await sendEmailVerification(cred.user);
        await ensureUserDocument(cred.user);
        const ref = doc(db, "stores", STORE_ID, "users", cred.user.uid);
        if (name) {
          await setDoc(ref, { name }, { merge: true });
        }
        if (referralCode) {
          const referrer = await findUserByReferralCode(referralCode);
          if (referrer && referrer.uid !== cred.user.uid) {
            await setDoc(ref, { referredBy: referrer.uid }, { merge: true });
            await createPendingReferral(referrer.uid, cred.user.uid);
          }
        }
      },
      async signInWithEmail(email, password) {
        await signInWithEmailAndPassword(auth, email, password);
      },
      async signInWithGoogle() {
        await signInWithPopup(auth, new GoogleAuthProvider());
      },
      async signOutUser() {
        await firebaseSignOut(auth);
      },
      async resetPassword(email) {
        await sendPasswordResetEmail(auth, email);
      },
    }),
    [firebaseUser, appUser, loading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within <AuthProvider>");
  return ctx;
}

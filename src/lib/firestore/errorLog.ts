import { collection, doc, getDocs, limit as fsLimit, orderBy, query, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { STORE_ID } from "@/lib/tenant";
import type { ErrorLogEntry } from "@/types";

const errorLogCol = () => collection(db, "stores", STORE_ID, "errorLogs");

/**
 * Every meaningful catch block in the app should call this alongside (not
 * instead of) console.error — a browser console only the developer can see
 * doesn't help an admin who's staring at a broken checkout. Failing to log
 * a log entry is swallowed on purpose: logging must never itself crash the
 * flow it's trying to record a failure for.
 */
export async function logError(params: {
  error: unknown;
  context: string;
  userId?: string | null;
  severity?: "error" | "warning";
}): Promise<void> {
  try {
    const ref = doc(errorLogCol());
    const message = params.error instanceof Error ? params.error.message : String(params.error);
    const stack = params.error instanceof Error ? params.error.stack : undefined;
    await setDoc(ref, {
      id: ref.id,
      storeId: STORE_ID,
      message,
      stack: stack ?? null,
      context: params.context,
      userId: params.userId ?? null,
      severity: params.severity ?? "error",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
  } catch {
    // Logging is best-effort — never let a logging failure mask the
    // original error or break the caller's flow.
  }
}

export async function listErrorLogs(): Promise<ErrorLogEntry[]> {
  const q = query(errorLogCol(), orderBy("createdAt", "desc"), fsLimit(200));
  const snap = await getDocs(q);
  return snap.docs.map((d) => d.data() as ErrorLogEntry);
}

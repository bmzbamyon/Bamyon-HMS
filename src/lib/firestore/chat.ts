import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { STORE_ID } from "@/lib/tenant";
import type { ChatMessage, Conversation } from "@/types";
import { createNotification } from "@/lib/firestore/notifications";

const conversationRef = (customerId: string) => doc(db, "stores", STORE_ID, "conversations", customerId);
const messagesCol = (customerId: string) =>
  collection(db, "stores", STORE_ID, "conversations", customerId, "messages");

/** Ensures a conversation thread exists for this customer — safe to call on every chat open. */
export async function ensureConversation(customerId: string, customerName: string, customerPhotoUrl?: string): Promise<void> {
  const ref = conversationRef(customerId);
  const snap = await getDoc(ref);
  if (snap.exists()) return;
  await setDoc(ref, {
    id: customerId,
    storeId: STORE_ID,
    customerId,
    customerName,
    customerPhotoUrl: customerPhotoUrl ?? null,
    lastMessageBody: "",
    lastMessageSenderRole: "customer",
    lastMessageAt: Date.now(),
    unreadForCustomer: 0,
    unreadForStaff: 0,
    status: "open",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

/** Real-time subscription to a single conversation's message list, oldest first. */
export function subscribeToMessages(customerId: string, cb: (messages: ChatMessage[]) => void): () => void {
  const q = query(messagesCol(customerId), orderBy("createdAt", "asc"));
  return onSnapshot(q, (snap) => cb(snap.docs.map((d) => d.data() as ChatMessage)));
}

/** Real-time subscription to the conversation metadata doc (for unread counts, presence-adjacent info). */
export function subscribeToConversation(customerId: string, cb: (conv: Conversation | null) => void): () => void {
  return onSnapshot(conversationRef(customerId), (snap) => cb(snap.exists() ? (snap.data() as Conversation) : null));
}

/** Admin: real-time subscription to every conversation, most recently active first. */
export function subscribeToAllConversations(cb: (conversations: Conversation[]) => void): () => void {
  const q = query(collection(db, "stores", STORE_ID, "conversations"), orderBy("lastMessageAt", "desc"));
  return onSnapshot(q, (snap) => cb(snap.docs.map((d) => d.data() as Conversation)));
}

export async function sendMessage(params: {
  customerId: string;
  senderId: string;
  senderRole: "customer" | "staff";
  senderName: string;
  body: string;
  imageUrl?: string;
}): Promise<void> {
  const ref = doc(messagesCol(params.customerId));
  await setDoc(ref, {
    id: ref.id,
    conversationId: params.customerId,
    storeId: STORE_ID,
    senderId: params.senderId,
    senderRole: params.senderRole,
    senderName: params.senderName,
    body: params.body,
    imageUrl: params.imageUrl ?? null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  const convRef = conversationRef(params.customerId);
  const convSnap = await getDoc(convRef);
  const current = convSnap.exists() ? (convSnap.data() as Conversation) : null;

  await updateDoc(convRef, {
    lastMessageBody: params.body || (params.imageUrl ? "📷 Photo" : ""),
    lastMessageSenderRole: params.senderRole,
    lastMessageAt: Date.now(),
    unreadForCustomer:
      params.senderRole === "staff" ? (current?.unreadForCustomer ?? 0) + 1 : 0,
    unreadForStaff:
      params.senderRole === "customer" ? (current?.unreadForStaff ?? 0) + 1 : 0,
    updatedAt: serverTimestamp(),
  });

  // Notify the other side — surfaces on the existing notification bell too.
  if (params.senderRole === "staff") {
    await createNotification({
      userId: params.customerId,
      type: "system",
      title: "New message from support",
      body: params.body || "Sent a photo",
      link: "/support",
    });
  }
}

export async function markConversationRead(customerId: string, role: "customer" | "staff"): Promise<void> {
  await updateDoc(conversationRef(customerId), {
    [role === "customer" ? "unreadForCustomer" : "unreadForStaff"]: 0,
    updatedAt: serverTimestamp(),
  });
}

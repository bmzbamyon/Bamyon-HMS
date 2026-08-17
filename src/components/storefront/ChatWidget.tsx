"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth/AuthProvider";
import {
  ensureConversation,
  markConversationRead,
  sendMessage,
  subscribeToConversation,
  subscribeToMessages,
} from "@/lib/firestore/chat";
import { pingPresence } from "@/lib/firestore/presence";
import { uploadMediaFile } from "@/lib/media/upload";
import type { ChatMessage, Conversation } from "@/types";
import { logError } from "@/lib/firestore/errorLog";

export function ChatWidget() {
  const { firebaseUser, appUser } = useAuth();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!firebaseUser) return;
    pingPresence(firebaseUser.uid);
    const interval = setInterval(() => pingPresence(firebaseUser.uid), 30000);
    return () => clearInterval(interval);
  }, [firebaseUser]);

  useEffect(() => {
    if (!firebaseUser || !appUser) return;
    ensureConversation(firebaseUser.uid, appUser.name, appUser.photoUrl ?? undefined);
    const unsubConv = subscribeToConversation(firebaseUser.uid, setConversation);
    const unsubMsgs = subscribeToMessages(firebaseUser.uid, setMessages);
    return () => {
      unsubConv();
      unsubMsgs();
    };
  }, [firebaseUser, appUser]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, open]);

  useEffect(() => {
    if (open && firebaseUser) markConversationRead(firebaseUser.uid, "customer");
  }, [open, firebaseUser]);

  if (!firebaseUser || !appUser || pathname?.startsWith("/admin")) return null;

  const unread = conversation?.unreadForCustomer ?? 0;

  async function handleSend() {
    if (!body.trim() || !firebaseUser || !appUser) return;
    setSending(true);
    try {
      await sendMessage({
        customerId: firebaseUser.uid,
        senderId: firebaseUser.uid,
        senderRole: "customer",
        senderName: appUser.name,
        body: body.trim(),
      });
      setBody("");
    } catch (err) {
      logError({ error: err, context: "chat.customer.sendMessage", userId: firebaseUser.uid });
    } finally {
      setSending(false);
    }
  }

  async function handleImageUpload(file: File) {
    if (!firebaseUser || !appUser) return;
    setUploading(true);
    try {
      const media = await uploadMediaFile(file, `chat/${firebaseUser.uid}`);
      await sendMessage({
        customerId: firebaseUser.uid,
        senderId: firebaseUser.uid,
        senderRole: "customer",
        senderName: appUser.name,
        body: "",
        imageUrl: media.url,
      });
    } catch (err) {
      logError({ error: err, context: "chat.customer.uploadImage", userId: firebaseUser.uid });
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="print-hide fixed bottom-4 right-4 z-50">
      {open ? (
        <div className="flex h-[28rem] w-80 flex-col overflow-hidden rounded-card border border-surface-muted bg-surface shadow-2xl">
          <div className="flex items-center justify-between bg-brand px-4 py-3 text-white">
            <div>
              <p className="text-sm font-semibold">Chat with us</p>
              <p className="text-xs text-white/80">We usually reply quickly</p>
            </div>
            <button onClick={() => setOpen(false)} aria-label="Close chat" className="text-white/80 hover:text-white">
              ✕
            </button>
          </div>

          <div ref={scrollRef} className="flex-1 space-y-2 overflow-y-auto bg-surface-muted p-3">
            {messages.length === 0 ? (
              <p className="mt-8 text-center text-xs text-ink-muted">
                Send a message and our team will get back to you here.
              </p>
            ) : (
              messages.map((m) => (
                <div key={m.id} className={`flex ${m.senderRole === "customer" ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`max-w-[75%] rounded-card px-3 py-2 text-sm ${
                      m.senderRole === "customer" ? "bg-brand text-white" : "bg-surface text-ink"
                    }`}
                  >
                    {m.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={m.imageUrl} alt="Sent attachment" className="mb-1 max-h-40 rounded-card object-cover" />
                    ) : null}
                    {m.body ? <p>{m.body}</p> : null}
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="flex items-center gap-2 border-t border-surface-muted p-2">
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-ink-muted hover:bg-surface-muted"
              aria-label="Attach photo"
            >
              📎
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              hidden
              onChange={(e) => e.target.files?.[0] && handleImageUpload(e.target.files[0])}
            />
            <input
              value={body}
              onChange={(e) => setBody(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSend()}
              placeholder="Type a message…"
              className="flex-1 rounded-full border border-surface-muted px-3 py-1.5 text-sm outline-none focus:border-brand"
            />
            <button
              onClick={handleSend}
              disabled={sending || !body.trim()}
              className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-brand text-white disabled:opacity-50"
              aria-label="Send message"
            >
              ➤
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setOpen(true)}
          className="relative flex h-14 w-14 items-center justify-center rounded-full bg-brand text-2xl text-white shadow-xl hover:bg-brand-dark"
          aria-label="Open chat"
        >
          💬
          {unread > 0 ? (
            <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-600 text-xs font-bold text-white">
              {unread > 9 ? "9+" : unread}
            </span>
          ) : null}
        </button>
      )}
    </div>
  );
}

"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/lib/auth/AuthProvider";
import {
  markConversationRead,
  sendMessage,
  subscribeToAllConversations,
  subscribeToMessages,
} from "@/lib/firestore/chat";
import { subscribeToPresence } from "@/lib/firestore/presence";
import { uploadMediaFile } from "@/lib/media/upload";
import type { ChatMessage, Conversation } from "@/types";
import { EmptyState } from "@/components/ui/EmptyState";
import { logError } from "@/lib/firestore/errorLog";

export default function AdminChatPage() {
  const { appUser } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [search, setSearch] = useState("");
  const [activeCustomerId, setActiveCustomerId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [customerOnline, setCustomerOnline] = useState(false);
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => subscribeToAllConversations(setConversations), []);

  useEffect(() => {
    if (!activeCustomerId) return;
    const unsubMsgs = subscribeToMessages(activeCustomerId, setMessages);
    const unsubPresence = subscribeToPresence(activeCustomerId, setCustomerOnline);
    markConversationRead(activeCustomerId, "staff");
    return () => {
      unsubMsgs();
      unsubPresence();
    };
  }, [activeCustomerId]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const filtered = useMemo(() => {
    if (!search.trim()) return conversations;
    const q = search.toLowerCase();
    return conversations.filter((c) => c.customerName.toLowerCase().includes(q));
  }, [conversations, search]);

  const activeConversation = conversations.find((c) => c.customerId === activeCustomerId);

  async function handleSend() {
    if (!body.trim() || !activeCustomerId || !appUser) return;
    setSending(true);
    try {
      await sendMessage({
        customerId: activeCustomerId,
        senderId: appUser.uid,
        senderRole: "staff",
        senderName: appUser.name,
        body: body.trim(),
      });
      setBody("");
    } catch (err) {
      logError({ error: err, context: "chat.staff.sendMessage", userId: appUser.uid });
    } finally {
      setSending(false);
    }
  }

  async function handleImageUpload(file: File) {
    if (!activeCustomerId || !appUser) return;
    setUploading(true);
    try {
      const media = await uploadMediaFile(file, `chat/${activeCustomerId}`);
      await sendMessage({
        customerId: activeCustomerId,
        senderId: appUser.uid,
        senderRole: "staff",
        senderName: appUser.name,
        body: "",
        imageUrl: media.url,
      });
    } catch (err) {
      logError({ error: err, context: "chat.staff.uploadImage", userId: appUser.uid });
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="grid h-[calc(100vh-8rem)] gap-4 lg:grid-cols-[300px_1fr]">
      <div className="flex flex-col rounded-card border border-surface-muted bg-surface">
        <div className="border-b border-surface-muted p-3">
          <h1 className="font-display text-lg font-bold text-ink">Support chat</h1>
          <input
            placeholder="Search customers…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="mt-2 w-full rounded-card border border-surface-muted px-3 py-1.5 text-sm"
          />
        </div>
        <div className="flex-1 overflow-y-auto">
          {filtered.length === 0 ? (
            <p className="p-4 text-sm text-ink-muted">No conversations yet.</p>
          ) : (
            filtered.map((c) => (
              <button
                key={c.customerId}
                onClick={() => setActiveCustomerId(c.customerId)}
                className={`flex w-full items-start gap-2 border-b border-surface-muted p-3 text-left ${
                  activeCustomerId === c.customerId ? "bg-brand-light" : "hover:bg-surface-muted"
                }`}
              >
                <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-brand text-xs font-bold text-white">
                  {c.customerName[0]?.toUpperCase() ?? "?"}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-ink">{c.customerName}</p>
                  <p className="truncate text-xs text-ink-muted">{c.lastMessageBody || "No messages yet"}</p>
                </div>
                {c.unreadForStaff > 0 ? (
                  <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-red-600 text-[10px] font-bold text-white">
                    {c.unreadForStaff > 9 ? "9+" : c.unreadForStaff}
                  </span>
                ) : null}
              </button>
            ))
          )}
        </div>
      </div>

      <div className="flex flex-col rounded-card border border-surface-muted bg-surface">
        {!activeConversation ? (
          <div className="flex flex-1 items-center justify-center">
            <EmptyState title="Select a conversation" description="Pick a customer on the left to view the thread." />
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2 border-b border-surface-muted p-3">
              <span className="relative flex h-8 w-8 items-center justify-center rounded-full bg-brand text-xs font-bold text-white">
                {activeConversation.customerName[0]?.toUpperCase() ?? "?"}
                <span
                  className={`absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-surface ${
                    customerOnline ? "bg-green-500" : "bg-ink-muted"
                  }`}
                />
              </span>
              <div>
                <p className="text-sm font-semibold text-ink">{activeConversation.customerName}</p>
                <p className="text-xs text-ink-muted">{customerOnline ? "Online" : "Offline"}</p>
              </div>
            </div>

            <div ref={scrollRef} className="flex-1 space-y-2 overflow-y-auto bg-surface-muted p-4">
              {messages.map((m) => (
                <div key={m.id} className={`flex ${m.senderRole === "staff" ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`max-w-[70%] rounded-card px-3 py-2 text-sm ${
                      m.senderRole === "staff" ? "bg-brand text-white" : "bg-surface text-ink"
                    }`}
                  >
                    {m.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={m.imageUrl} alt="Sent attachment" className="mb-1 max-h-48 rounded-card object-cover" />
                    ) : null}
                    {m.body ? <p>{m.body}</p> : null}
                  </div>
                </div>
              ))}
            </div>

            <div className="flex items-center gap-2 border-t border-surface-muted p-3">
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-ink-muted hover:bg-surface-muted"
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
                placeholder="Type a reply…"
                className="flex-1 rounded-full border border-surface-muted px-3 py-2 text-sm outline-none focus:border-brand"
              />
              <button
                onClick={handleSend}
                disabled={sending || !body.trim()}
                className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-brand text-white disabled:opacity-50"
                aria-label="Send reply"
              >
                ➤
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

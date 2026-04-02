"use client";

import { FormEvent, useMemo, useState } from "react";
import { useDemoStore } from "@/lib/demo-store";

type LocalMessage = { id: string; threadId: string; body: string; direction: "IN" | "OUT"; at: string };

export default function ConversationsPage() {
  const { customers, threads, isReady } = useDemoStore();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<LocalMessage[]>([]);
  const [draft, setDraft] = useState("");

  const selected = useMemo(() => threads.value.find((x) => x.id === selectedId) ?? threads.value[0], [selectedId, threads.value]);

  if (!isReady) return <div className="card">Loading demo data...</div>;

  const send = (e: FormEvent) => {
    e.preventDefault();
    if (!selected || !draft.trim()) return;
    const msg: LocalMessage = { id: `m_${Date.now()}`, threadId: selected.id, body: draft, direction: "OUT", at: new Date().toLocaleTimeString() };
    setMessages((prev) => [...prev, msg]);
    setDraft("");
    threads.update((prev) => prev.map((t) => (t.id === selected.id ? { ...t, preview: msg.body, updatedAt: msg.at } : t)));
  };

  const currentMessages = messages.filter((m) => m.threadId === selected?.id);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Conversations</h1>
      <div className="grid gap-4 md:grid-cols-[320px_1fr]">
        <aside className="card space-y-2">
          {threads.value.map((thread) => {
            const customer = customers.value.find((c) => c.id === thread.customerId);
            return (
              <button key={thread.id} onClick={() => setSelectedId(thread.id)} className="w-full rounded-lg border border-slate-800 p-3 text-left">
                <div className="flex items-center justify-between"><span className="font-medium">{customer?.fullName}</span>{thread.unread > 0 ? <span className="badge">{thread.unread}</span> : null}</div>
                <p className="mt-1 text-sm text-slate-300">{thread.preview}</p>
              </button>
            );
          })}
        </aside>
        <section className="card space-y-3">
          <div className="text-sm text-slate-400">Thread: {selected?.id}</div>
          <div className="max-h-72 space-y-2 overflow-auto rounded-md border border-slate-800 p-3">
            {currentMessages.length === 0 ? <p className="text-sm text-slate-400">No local demo messages yet.</p> : null}
            {currentMessages.map((message) => (
              <div key={message.id} className={`rounded-md p-2 text-sm ${message.direction === "OUT" ? "bg-slate-800" : "bg-slate-700"}`}>{message.body}</div>
            ))}
          </div>
          <form onSubmit={send} className="flex gap-2">
            <input className="input" placeholder="Type a message" value={draft} onChange={(e) => setDraft(e.target.value)} />
            <button className="btn">Send</button>
          </form>
        </section>
      </div>
    </div>
  );
}

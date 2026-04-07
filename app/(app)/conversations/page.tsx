"use client";

import { useEffect, useMemo, useState } from "react";
import { defaultConversations, readStoredConversations, writeStoredConversations, type StoredConversation } from "@/lib/conversation-store";

export default function ConversationsPage() {
  const [threads, setThreads] = useState<StoredConversation[]>(() => readStoredConversations(defaultConversations));
  const [selectedThreadId, setSelectedThreadId] = useState<string>(() => readStoredConversations(defaultConversations)[0]?.id ?? "");
  const [message, setMessage] = useState("");

  useEffect(() => {
    writeStoredConversations(threads);
  }, [threads]);

  const selectedThread = useMemo(() => threads.find((thread) => thread.id === selectedThreadId) ?? null, [threads, selectedThreadId]);

  const sendMessage = (closeAfterSend: boolean) => {
    if (!selectedThread || !message.trim()) return;

    setThreads((prev) =>
      prev.map((thread) => {
        if (thread.id !== selectedThread.id) return thread;

        return {
          ...thread,
          preview: message.trim(),
          updatedAt: "Now",
          open: !closeAfterSend,
          messages: [...thread.messages, { id: `m_${Date.now()}`, role: "agent", text: message.trim(), at: "Now" }]
        };
      })
    );

    setMessage("");
  };

  const closeConversation = () => {
    if (!selectedThread) return;

    setThreads((prev) =>
      prev.map((thread) =>
        thread.id === selectedThread.id
          ? {
              ...thread,
              open: false
            }
          : thread
      )
    );
  };

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Conversations</h1>
      <div className="grid gap-4 md:grid-cols-[320px_1fr]">
        <aside className="card space-y-2">
          {threads.map((thread) => (
            <button
              key={thread.id}
              type="button"
              onClick={() => setSelectedThreadId(thread.id)}
              className={`w-full rounded-lg border p-3 text-left ${selectedThreadId === thread.id ? "border-[#28d9c6]/60 bg-[#182236]" : "border-slate-800"}`}
            >
              <div className="flex items-center justify-between">
                <span className="font-medium">{thread.customerName}</span>
                <span className={`rounded-full px-2 py-0.5 text-xs ${thread.open ? "bg-amber-500/20 text-amber-300" : "bg-slate-700/40 text-slate-400"}`}>{thread.open ? "Open" : "Closed"}</span>
              </div>
              <p className="mt-1 text-sm text-slate-300">{thread.preview}</p>
            </button>
          ))}
        </aside>

        <section className="card">
          {selectedThread ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">{selectedThread.customerName}</h2>
                <span className={`rounded-full px-2 py-1 text-xs ${selectedThread.open ? "bg-amber-500/20 text-amber-300" : "bg-slate-700/40 text-slate-400"}`}>{selectedThread.open ? "Open" : "Closed"}</span>
              </div>

              <div className="max-h-56 space-y-2 overflow-y-auto rounded-xl border border-[#253149] bg-[#0b1323] p-3">
                {selectedThread.messages.map((msg) => (
                  <div key={msg.id} className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${msg.role === "agent" ? "ml-auto bg-[#25d3c4]/20 text-[#9ff8ec]" : "bg-slate-700/40 text-slate-200"}`}>
                    {msg.text}
                  </div>
                ))}
              </div>

              <textarea className="input min-h-24" placeholder="Type your message..." value={message} onChange={(event) => setMessage(event.target.value)} />

              <div className="flex flex-wrap justify-end gap-2">
                <button type="button" onClick={sendMessage.bind(null, false)} className="rounded-xl border border-[#253149] bg-[#0a111f] px-4 py-2 text-sm font-medium text-slate-300 hover:bg-slate-900/70">
                  Send
                </button>
                <button type="button" onClick={closeConversation} className="rounded-xl border border-[#253149] bg-[#0a111f] px-4 py-2 text-sm font-medium text-slate-300 hover:bg-slate-900/70">
                  Close
                </button>
                <button type="button" onClick={sendMessage.bind(null, true)} className="rounded-xl bg-[#28d9c6] px-4 py-2 text-sm font-semibold text-[#022a36] hover:opacity-90">
                  Send & Close
                </button>
              </div>
            </div>
          ) : (
            "Select a thread to view messages and quick actions."
          )}
        </section>
      </div>
    </div>
  );
}

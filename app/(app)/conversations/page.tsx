"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Search, Send, Link as LinkIcon, Wrench, X, ChevronRight, ChevronLeft } from "lucide-react";
import { defaultConversations, readStoredConversations, writeStoredConversations, type StoredConversation } from "@/lib/conversation-store";
import { defaultRepairs, readStoredRepairs, type StoredRepair } from "@/lib/repair-store";

type LinkModalState = { open: boolean; threadId: string | null };

function LinkRepairModal({
  repairs,
  onClose,
  onSelect
}: {
  repairs: StoredRepair[];
  onClose: () => void;
  onSelect: (repairId: string) => void;
}) {
  const [query, setQuery] = useState("");
  const filtered = repairs.filter((repair) => `${repair.title} ${repair.customerName} ${repair.assetName}`.toLowerCase().includes(query.toLowerCase()));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#02050d]/80 px-4 backdrop-blur-sm">
      <div className="w-full max-w-xl rounded-2xl border border-[#d7dce3] bg-[#f4f6fa] p-6 text-slate-900 shadow-[0_24px_80px_rgba(0,0,0,0.5)]">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-2xl font-semibold">Link to Repair</h2>
          <button onClick={onClose} className="rounded-md p-1 text-slate-500 hover:bg-slate-200" type="button"><X className="h-5 w-5" /></button>
        </div>

        <label className="mb-4 flex items-center gap-2 rounded-xl border border-[#bfc9d8] bg-white px-3 py-2">
          <Search className="h-4 w-4 text-slate-500" />
          <input className="w-full bg-transparent text-sm outline-none" placeholder="Search repairs..." value={query} onChange={(event) => setQuery(event.target.value)} />
        </label>

        <div className="space-y-2">
          {filtered.map((repair) => (
            <button key={repair.id} type="button" onClick={() => onSelect(repair.id)} className="w-full rounded-xl border border-[#cdd5e2] bg-white p-3 text-left hover:bg-slate-50">
              <div className="flex items-center justify-between">
                <div className="font-semibold">{repair.title}</div>
                <span className="rounded-full bg-slate-200 px-2 py-0.5 text-xs text-slate-600">{repair.stage}</span>
              </div>
              <div className="text-sm text-slate-600">{repair.customerName} · {repair.assetName}</div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function ConversationsPage() {
  const [threads, setThreads] = useState<StoredConversation[]>(() => readStoredConversations(defaultConversations));
  const [repairs, setRepairs] = useState<StoredRepair[]>(() => readStoredRepairs(defaultRepairs));
  const [selectedThreadId, setSelectedThreadId] = useState<string>(() => readStoredConversations(defaultConversations)[0]?.id ?? "");
  const [message, setMessage] = useState("");
  const [showRepairPanel, setShowRepairPanel] = useState(false);
  const [listCollapsed, setListCollapsed] = useState(false);
  const [linkModal, setLinkModal] = useState<LinkModalState>({ open: false, threadId: null });
  const messageWindowRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setRepairs(readStoredRepairs(defaultRepairs));

    setThreads((prev) =>
      prev.map((thread) => {
        const autoRepair = readStoredRepairs(defaultRepairs).find((repair) => repair.customerPhone === thread.customerPhone);

        return {
          ...thread,
          customerName: autoRepair ? autoRepair.customerName : thread.customerName || thread.customerPhone,
          linkedRepairId: thread.linkedRepairId ?? autoRepair?.id
        };
      })
    );
  }, []);

  useEffect(() => {
    writeStoredConversations(threads);
  }, [threads]);

  const selectedThread = useMemo(() => threads.find((thread) => thread.id === selectedThreadId) ?? null, [threads, selectedThreadId]);
  const linkedRepair = selectedThread ? repairs.find((repair) => repair.id === selectedThread.linkedRepairId) ?? null : null;

  useEffect(() => {
    if (!messageWindowRef.current) return;
    messageWindowRef.current.scrollTop = messageWindowRef.current.scrollHeight;
  }, [selectedThreadId, selectedThread?.messages.length]);

  const sendMessage = () => {
    if (!selectedThread || !message.trim()) return;

    setThreads((prev) =>
      prev.map((thread) =>
        thread.id === selectedThread.id
          ? {
              ...thread,
              preview: message.trim(),
              updatedAt: "Now",
              open: true,
              messages: [...thread.messages, { id: `m_${Date.now()}`, role: "agent", text: message.trim(), at: "Now" }]
            }
          : thread
      )
    );

    setMessage("");
  };

  const linkRepairToThread = (threadId: string, repairId: string) => {
    const repair = repairs.find((item) => item.id === repairId);
    if (!repair) return;

    setThreads((prev) =>
      prev.map((thread) =>
        thread.id === threadId
          ? {
              ...thread,
              linkedRepairId: repair.id,
              customerName: repair.customerName,
              customerPhone: repair.customerPhone
            }
          : thread
      )
    );

    setLinkModal({ open: false, threadId: null });
  };

  const toggleConversationList = () => {
    setListCollapsed((prev) => {
      const next = !prev;
      if (next) {
        setShowRepairPanel(true);
      }
      return next;
    });
  };

  const showRepairColumn = !listCollapsed && showRepairPanel && Boolean(linkedRepair);
  const showRepairOverlay = listCollapsed && showRepairPanel && Boolean(linkedRepair);

  return (
    <div className={`-mx-10 -my-8 grid h-[calc(100vh-69px)] gap-0 overflow-hidden bg-[#0b1221] transition-[grid-template-columns] duration-300 ${listCollapsed ? "grid-cols-[56px_1fr]" : "grid-cols-[380px_1fr]"}`}>
      <aside className="relative border-r border-[#253149] bg-[#121b2b]/65">
        <button
          type="button"
          onClick={toggleConversationList}
          className="absolute right-3 top-3 z-20 inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[#253149] bg-[#0a111f] text-slate-300 hover:bg-[#182236]"
          aria-label={listCollapsed ? "Expand conversations list" : "Collapse conversations list"}
        >
          {listCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </button>
        <div className={`transition-opacity duration-200 ${listCollapsed ? "pointer-events-none opacity-0" : "opacity-100"}`}>
          <div className="p-4">
          <h1 className="text-2xl font-semibold text-white">Conversations</h1>
          <label className="mt-3 flex items-center gap-2 rounded-xl border border-[#253149] bg-[#0a111f] px-3 py-2 text-slate-400">
            <Search className="h-4 w-4" />
            <input className="w-full bg-transparent text-sm outline-none" placeholder="Search..." />
          </label>
          </div>

          <div className="space-y-1 px-3 pb-3">
            {threads.map((thread) => (
              <button key={thread.id} type="button" onClick={() => setSelectedThreadId(thread.id)} className={`w-full rounded-xl border p-3 text-left ${selectedThreadId === thread.id ? "border-[#28d9c6]/40 bg-[#182236]" : "border-transparent hover:bg-[#182236]/60"}`}>
                <div className="flex items-center justify-between">
                  <span className="font-medium text-slate-200">{thread.customerName || thread.customerPhone}</span>
                  <span className="text-xs text-slate-500">{thread.updatedAt}</span>
                </div>
                <p className="mt-1 text-sm text-slate-300">{thread.preview}</p>
                <p className="mt-1 text-xs italic text-slate-500">{thread.linkedRepairId ? `🔗 ${repairs.find((r) => r.id === thread.linkedRepairId)?.title ?? "Repair linked"}` : "No repair linked"}</p>
              </button>
            ))}
          </div>
        </div>
      </aside>

      <section className={`relative grid min-w-0 overflow-hidden transition-transform duration-300 ${listCollapsed ? "translate-x-5 grid-cols-[1fr]" : showRepairColumn ? "grid-cols-[1fr_380px]" : "grid-cols-[1fr]"}`}>
        <div className="flex min-w-0 flex-col">
          {selectedThread ? (
            <>
              <header className="flex items-center justify-between border-b border-[#253149] px-5 py-3">
                <div>
                  <div className="font-semibold text-slate-200">{selectedThread.customerName || selectedThread.customerPhone}</div>
                  <div className="text-sm text-slate-500">{selectedThread.customerPhone}</div>
                </div>
                <div className="flex items-center gap-2">
                  {selectedThread.linkedRepairId ? (
                    <button type="button" onClick={() => setShowRepairPanel(true)} className="inline-flex items-center gap-2 rounded-xl border border-[#25d3c4]/50 bg-[#25d3c4]/10 px-3 py-2 text-sm font-semibold text-[#69f0df]">
                      <Wrench className="h-4 w-4" />
                      Repair Details
                    </button>
                  ) : (
                    <button type="button" onClick={() => setLinkModal({ open: true, threadId: selectedThread.id })} className="inline-flex items-center gap-2 rounded-xl border border-[#253149] bg-[#111a2b] px-3 py-2 text-sm font-semibold text-slate-300">
                      <LinkIcon className="h-4 w-4" />
                      Link Repair
                    </button>
                  )}
                </div>
              </header>

              <div ref={messageWindowRef} className="flex-1 space-y-3 overflow-y-auto p-4">
                {selectedThread.messages.map((msg) => (
                  <div key={msg.id} className={`max-w-[72%] rounded-2xl px-4 py-3 text-base ${msg.role === "agent" ? "ml-auto bg-[#29cfc0] text-[#05292f]" : "bg-[#1f2736] text-slate-200"}`}>
                    {msg.text}
                    <div className="mt-1 text-right text-xs opacity-70">{msg.at}</div>
                  </div>
                ))}
              </div>

              <div className="border-t border-[#253149] p-3">
                <div className="flex items-center gap-2">
                  <input className="input" placeholder="Type a message..." value={message} onChange={(event) => setMessage(event.target.value)} />
                  <button type="button" onClick={sendMessage} className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-[#28d9c6] text-[#022a36]"><Send className="h-4 w-4" /></button>
                </div>
              </div>
            </>
          ) : null}
        </div>

        {showRepairColumn && linkedRepair ? (
          <aside className="relative border-l border-[#253149] bg-[#0b1221] pl-6 pr-5 py-5">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2 text-xl font-semibold text-white">
                <Wrench className="h-5 w-5 text-[#25d3c4]" />
                Repair Details
              </div>
            </div>
            <h3 className="text-2xl font-semibold text-white">{linkedRepair.title}</h3>
            <div className="mt-2 text-sm text-slate-400">{linkedRepair.customerName} · {linkedRepair.assetName}</div>
            <div className="mt-4 border-t border-[#253149] pt-4 text-sm text-slate-300">{linkedRepair.description}</div>
            <div className="mt-5 space-y-2">
              {["Diagnosing", "Repairing", "Ready for Pickup"].map((step) => (
                <button key={step} type="button" className="flex w-full items-center justify-between rounded-xl border border-[#253149] px-3 py-2 text-left text-sm text-slate-200 hover:bg-[#182236]">
                  {step}
                  <ChevronRight className="h-4 w-4 text-slate-500" />
                </button>
              ))}
            </div>
            <button type="button" onClick={() => selectedThread && setLinkModal({ open: true, threadId: selectedThread.id })} className="absolute bottom-5 right-5 text-[#69f0df] hover:text-[#25d3c4]" aria-label="Change linked repair">
              <LinkIcon className="h-5 w-5" />
            </button>
          </aside>
        ) : null}

        <div
          className={`absolute inset-0 z-20 bg-black/40 transition-opacity ${showRepairOverlay ? "opacity-100" : "pointer-events-none opacity-0"}`}
          onClick={() => setShowRepairPanel(false)}
        />
        <aside
          className={`absolute inset-y-0 right-0 z-30 w-[380px] border-l border-[#253149] bg-[#0b1221] p-5 transition-transform duration-300 ${
            showRepairOverlay ? "translate-x-0" : "translate-x-full"
          }`}
        >
          {linkedRepair ? (
            <>
              <div className="mb-4 flex items-center justify-between">
                <div className="flex items-center gap-2 text-xl font-semibold text-white">
                  <Wrench className="h-5 w-5 text-[#25d3c4]" />
                  Repair Details
                </div>
                <button type="button" className="rounded-md p-1 text-slate-400 hover:bg-[#182236] hover:text-white" onClick={() => setShowRepairPanel(false)}>
                  <X className="h-5 w-5" />
                </button>
              </div>
              <h3 className="text-2xl font-semibold text-white">{linkedRepair.title}</h3>
              <div className="mt-2 text-sm text-slate-400">{linkedRepair.customerName} · {linkedRepair.assetName}</div>
              <div className="mt-4 border-t border-[#253149] pt-4 text-sm text-slate-300">{linkedRepair.description}</div>
              <div className="mt-5 space-y-2">
                {["Diagnosing", "Repairing", "Ready for Pickup"].map((step) => (
                  <button key={step} type="button" className="flex w-full items-center justify-between rounded-xl border border-[#253149] px-3 py-2 text-left text-sm text-slate-200 hover:bg-[#182236]">
                    {step}
                    <ChevronRight className="h-4 w-4 text-slate-500" />
                  </button>
                ))}
              </div>
              <button type="button" onClick={() => selectedThread && setLinkModal({ open: true, threadId: selectedThread.id })} className="absolute bottom-5 right-5 text-[#69f0df] hover:text-[#25d3c4]" aria-label="Change linked repair">
                <LinkIcon className="h-5 w-5" />
              </button>
            </>
          ) : (
            <div className="text-sm text-slate-400">No repair linked to this conversation.</div>
          )}
        </aside>
      </section>

      {linkModal.open && linkModal.threadId ? (
        <LinkRepairModal repairs={repairs.filter((repair) => repair.status === "Open")} onClose={() => setLinkModal({ open: false, threadId: null })} onSelect={(repairId) => linkRepairToThread(linkModal.threadId!, repairId)} />
      ) : null}
    </div>
  );
}

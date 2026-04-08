"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Search, Send, Link as LinkIcon, Wrench, X, ChevronLeft, FileText, Camera, Unlink2, Link2 } from "lucide-react";
import { defaultConversations, readStoredConversations, writeStoredConversations, type StoredConversation } from "@/lib/conversation-store";
import { defaultRepairs, readStoredRepairs, writeStoredRepairs, type StoredRepair } from "@/lib/repair-store";
import { RepairDetailsPanel } from "@/components/repairs/repair-details-panel";
import { useTenantRepairLabel } from "@/lib/use-tenant-terminology";

type LinkModalState = { open: boolean; threadId: string | null };

function LinkRepairModal({
  repairs,
  repairLabel,
  onClose,
  onSelect,
  onCreate
}: {
  repairs: StoredRepair[];
  repairLabel: string;
  onClose: () => void;
  onSelect: (repairId: string) => void;
  onCreate: () => void;
}) {
  const [query, setQuery] = useState("");
  const filtered = repairs.filter((repair) => `${repair.title} ${repair.customerName} ${repair.assetName}`.toLowerCase().includes(query.toLowerCase()));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#02050d]/80 px-4 backdrop-blur-sm">
      <div className="w-full max-w-xl rounded-2xl border border-[#d7dce3] bg-[#f4f6fa] p-6 text-slate-900 shadow-[0_24px_80px_rgba(0,0,0,0.5)]">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-semibold">Link to {repairLabel}</h2>
            <button type="button" onClick={onCreate} className="rounded-xl border border-[#2fb2a3]/40 bg-[#2fb2a3]/10 px-3 py-1 text-xs font-semibold text-[#1f8e82] hover:bg-[#2fb2a3]/20">+ New {repairLabel}</button>
          </div>
          <button onClick={onClose} className="rounded-md p-1 text-slate-500 hover:bg-slate-200" type="button"><X className="h-5 w-5" /></button>
        </div>

        <label className="mb-4 flex items-center gap-2 rounded-xl border border-[#bfc9d8] bg-white px-3 py-2">
          <Search className="h-4 w-4 text-slate-500" />
          <input className="w-full bg-transparent text-sm outline-none" placeholder={`Search ${repairLabel.toLowerCase()}s...`} value={query} onChange={(event) => setQuery(event.target.value)} />
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

function TemplatePickerModal({
  onClose,
  onSelect
}: {
  onClose: () => void;
  onSelect: (value: string) => void;
}) {
  const templateOptions = ["Device Received", "Repair Update", "Ready for Pickup"];
  const quickReplyOptions = ["Thanks, we'll check this now.", "Can you share your serial number?", "Your device is ready to collect."];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#02050d]/80 px-4 backdrop-blur-sm">
      <div className="w-full max-w-xl rounded-2xl border border-[#d7dce3] bg-[#f4f6fa] p-6 text-slate-900 shadow-[0_24px_80px_rgba(0,0,0,0.5)]">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-2xl font-semibold">Templates & Quick Replies</h2>
          <button type="button" onClick={onClose} className="rounded-md p-1 text-slate-500 hover:bg-slate-200" aria-label="Close template picker">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-5">
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Templates</h3>
            <div className="mt-2 space-y-2">
              {templateOptions.map((item) => (
                <button key={item} type="button" onClick={() => onSelect(item)} className="w-full rounded-xl border border-[#cdd5e2] bg-white px-3 py-2 text-left text-sm font-medium text-slate-700 hover:bg-slate-50">
                  {item}
                </button>
              ))}
            </div>
          </div>
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Quick replies</h3>
            <div className="mt-2 space-y-2">
              {quickReplyOptions.map((item) => (
                <button key={item} type="button" onClick={() => onSelect(item)} className="w-full rounded-xl border border-[#cdd5e2] bg-white px-3 py-2 text-left text-sm font-medium text-slate-700 hover:bg-slate-50">
                  {item}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ConversationsPage() {
  const repairLabel = useTenantRepairLabel();
  const [threads, setThreads] = useState<StoredConversation[]>(() => readStoredConversations(defaultConversations));
  const [repairs, setRepairs] = useState<StoredRepair[]>(() => readStoredRepairs(defaultRepairs));
  const [selectedThreadId, setSelectedThreadId] = useState<string>(() => readStoredConversations(defaultConversations)[0]?.id ?? "");
  const [message, setMessage] = useState("");
  const [showTemplatePicker, setShowTemplatePicker] = useState(false);
  const [showRepairPanel, setShowRepairPanel] = useState(true);
  const [listCollapsed, setListCollapsed] = useState(false);
  const [linkModal, setLinkModal] = useState<LinkModalState>({ open: false, threadId: null });
  const [openRepairLinkMenu, setOpenRepairLinkMenu] = useState(false);
  const messageWindowRef = useRef<HTMLDivElement | null>(null);
  const imageInputRef = useRef<HTMLInputElement | null>(null);

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

  useEffect(() => {
    const handleConversationNavClick = () => {
      setListCollapsed(false);
    };

    window.addEventListener("conversations:nav-click", handleConversationNavClick);
    return () => window.removeEventListener("conversations:nav-click", handleConversationNavClick);
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest("[data-repair-link-menu='true']")) return;
      setOpenRepairLinkMenu(false);
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    setOpenRepairLinkMenu(false);
  }, [selectedThreadId]);

  const selectedThread = useMemo(() => threads.find((thread) => thread.id === selectedThreadId) ?? null, [threads, selectedThreadId]);
  const linkedRepair = selectedThread ? repairs.find((repair) => repair.id === selectedThread.linkedRepairId) ?? null : null;
  const sortedThreads = useMemo(
    () =>
      [...threads].sort((a, b) => {
        const aTimestamp = Number(a.messages[a.messages.length - 1]?.id.replace("m_", "") ?? 0);
        const bTimestamp = Number(b.messages[b.messages.length - 1]?.id.replace("m_", "") ?? 0);
        if (aTimestamp !== bTimestamp) return bTimestamp - aTimestamp;

        if (a.updatedAt === "Now" && b.updatedAt !== "Now") return -1;
        if (b.updatedAt === "Now" && a.updatedAt !== "Now") return 1;
        return b.updatedAt.localeCompare(a.updatedAt);
      }),
    [threads]
  );

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
    setOpenRepairLinkMenu(false);
  };

  const unlinkRepairFromThread = (threadId: string) => {
    setThreads((prev) =>
      prev.map((thread) =>
        thread.id === threadId
          ? {
              ...thread,
              linkedRepairId: undefined
            }
          : thread
      )
    );
    setShowRepairPanel(false);
    setOpenRepairLinkMenu(false);
  };

  const createRepairFromThread = (threadId: string) => {
    const thread = threads.find((item) => item.id === threadId);
    if (!thread) return;

    const newRepair: StoredRepair = {
      id: `repair_${Date.now()}`,
      title: `New ${repairLabel}`,
      description: "Created from conversation",
      customerName: thread.customerName || thread.customerPhone,
      customerPhone: thread.customerPhone,
      assetName: "Unknown device",
      stage: "New",
      priority: "Medium",
      status: "Open"
    };

    setRepairs((prev) => {
      const updated = [newRepair, ...prev];
      writeStoredRepairs(updated);
      return updated;
    });

    setThreads((prev) =>
      prev.map((item) =>
        item.id === threadId
          ? {
              ...item,
              linkedRepairId: newRepair.id,
              customerName: newRepair.customerName,
              customerPhone: newRepair.customerPhone
            }
          : item
      )
    );

    setShowRepairPanel(true);
    setLinkModal({ open: false, threadId: null });
  };

  const handleImageSelected = (file: File | null) => {
    if (!selectedThread || !file) return;

    setThreads((prev) =>
      prev.map((thread) =>
        thread.id === selectedThread.id
          ? {
              ...thread,
              preview: `📷 ${file.name}`,
              updatedAt: "Now",
              open: true,
              messages: [...thread.messages, { id: `m_${Date.now()}`, role: "agent", text: `📷 Image uploaded: ${file.name}`, at: "Now" }]
            }
          : thread
      )
    );
  };

  const toggleConversationList = () => {
    setListCollapsed((prev) => {
      const next = !prev;
      setShowRepairPanel(true);
      return next;
    });
  };

  const showRepairColumn = showRepairPanel && Boolean(linkedRepair);

  return (
    <div className={`-mx-10 -my-8 grid h-[calc(100vh-69px)] gap-0 overflow-hidden bg-[#0b1221] transition-[grid-template-columns] duration-300 ${listCollapsed ? "grid-cols-[88px_1fr]" : "grid-cols-[380px_1fr]"}`}>
      <aside className="flex min-h-0 flex-col border-r border-[#253149] bg-[#121b2b]/65">
        <div className={`min-h-0 flex-1 transition-opacity duration-200 ${listCollapsed ? "pointer-events-none opacity-0" : "opacity-100"}`}>
          <div className="p-4">
            <h1 className="text-2xl font-semibold text-white">Conversations</h1>
            <label className="mt-3 flex items-center gap-2 rounded-xl border border-[#253149] bg-[#0a111f] px-3 py-2 text-slate-400">
              <Search className="h-4 w-4" />
              <input className="w-full bg-transparent text-sm outline-none" placeholder="Search..." />
            </label>
          </div>

          <div className="space-y-1 px-3 pb-3">
            {sortedThreads.map((thread) => (
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

        <div className="border-t border-[#1a2436] p-4">
          <button
            type="button"
            onClick={toggleConversationList}
            className="mx-auto flex h-9 w-9 items-center justify-center rounded-md text-slate-500 hover:bg-slate-900/70"
            aria-label={listCollapsed ? "Expand conversations list" : "Collapse conversations list"}
          >
            <ChevronLeft className={`h-5 w-5 transition-transform ${listCollapsed ? "rotate-180" : ""}`} />
          </button>
        </div>
      </aside>

      <section className={`relative grid min-h-0 min-w-0 overflow-hidden ${showRepairColumn ? "grid-cols-[1fr_380px]" : "grid-cols-[1fr]"}`}>
        <div className="flex min-h-0 min-w-0 flex-col">
          {selectedThread ? (
            <>
              <header className="flex items-center justify-between border-b border-[#253149] px-5 py-3">
                <div>
                  <div className="font-semibold text-slate-200">{selectedThread.customerName || selectedThread.customerPhone}</div>
                  <div className="text-sm text-slate-500">{selectedThread.customerPhone}</div>
                </div>
                <div className="flex items-center gap-2">
                  {selectedThread.linkedRepairId ? (
                    showRepairPanel ? null : (
                      <button type="button" onClick={() => setShowRepairPanel((prev) => !prev)} className="inline-flex items-center gap-2 rounded-xl border border-[#25d3c4]/50 bg-[#25d3c4]/10 px-3 py-2 text-sm font-semibold text-[#69f0df]">
                        <Wrench className="h-4 w-4" />
                        {repairLabel} Details
                      </button>
                    )
                  ) : (
                    <button type="button" onClick={() => setLinkModal({ open: true, threadId: selectedThread.id })} className="inline-flex items-center gap-2 rounded-xl border border-[#253149] bg-[#111a2b] px-3 py-2 text-sm font-semibold text-slate-300">
                      <LinkIcon className="h-4 w-4" />
                      Link {repairLabel}
                    </button>
                  )}
                </div>
              </header>

              <div ref={messageWindowRef} className="subtle-scrollbar flex-1 space-y-3 overflow-y-auto p-4">
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
                  <button
                    type="button"
                    onClick={() => setShowTemplatePicker(true)}
                    className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-[#253149] bg-[#111a2b] text-slate-300 hover:bg-[#182236]"
                    aria-label="Select template or quick reply"
                  >
                    <FileText className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => imageInputRef.current?.click()}
                    className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-[#253149] bg-[#111a2b] text-slate-300 hover:bg-[#182236]"
                    aria-label="Upload or capture image"
                  >
                    <Camera className="h-4 w-4" />
                  </button>
                  <button type="button" onClick={sendMessage} className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-[#28d9c6] text-[#022a36]"><Send className="h-4 w-4" /></button>
                </div>
                <input
                  ref={imageInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={(event) => {
                    handleImageSelected(event.target.files?.[0] ?? null);
                    event.currentTarget.value = "";
                  }}
                />
              </div>
            </>
          ) : null}
        </div>

        {showRepairColumn && linkedRepair ? (
          <div className="relative">
            <RepairDetailsPanel
              repair={linkedRepair}
              itemLabel={repairLabel}
              onClose={() => setShowRepairPanel(false)}
              onLinkChange={() => setOpenRepairLinkMenu((prev) => !prev)}
              className="relative border-l border-[#253149] bg-[#0b1221] pl-6 pr-5 py-5"
            />
            {openRepairLinkMenu && selectedThread ? (
              <div data-repair-link-menu="true" className="absolute bottom-16 right-5 z-20 w-48 rounded-xl border border-[#d7dce3] bg-[#f4f6fa] p-1 text-left shadow-xl">
                <button
                  type="button"
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-700 hover:bg-slate-200"
                  onClick={() => unlinkRepairFromThread(selectedThread.id)}
                >
                  <Unlink2 className="h-4 w-4" />
                  Unlink {repairLabel.toLowerCase()}
                </button>
                <button
                  type="button"
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-700 hover:bg-slate-200"
                  onClick={() => {
                    setLinkModal({ open: true, threadId: selectedThread.id });
                    setOpenRepairLinkMenu(false);
                  }}
                >
                  <Link2 className="h-4 w-4" />
                  Link to other {repairLabel.toLowerCase()}
                </button>
              </div>
            ) : null}
          </div>
        ) : null}
      </section>

      {linkModal.open && linkModal.threadId ? (
        <LinkRepairModal
          repairs={repairs.filter((repair) => repair.status === "Open")}
          repairLabel={repairLabel}
          onClose={() => setLinkModal({ open: false, threadId: null })}
          onSelect={(repairId) => linkRepairToThread(linkModal.threadId!, repairId)}
          onCreate={() => createRepairFromThread(linkModal.threadId!)}
        />
      ) : null}
      {showTemplatePicker ? <TemplatePickerModal onClose={() => setShowTemplatePicker(false)} onSelect={(value) => { setMessage(value); setShowTemplatePicker(false); }} /> : null}
    </div>
  );
}

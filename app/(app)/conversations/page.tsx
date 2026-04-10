"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  Search,
  Send,
  Link as LinkIcon,
  Wrench,
  X,
  ChevronLeft,
  MessageSquareText,
  Camera,
} from "lucide-react";
import {
  defaultConversations,
  readStoredConversations,
  writeStoredConversations,
  type StoredConversation,
} from "@/lib/conversation-store";
import {
  defaultRepairs,
  readStoredRepairs,
  writeStoredRepairs,
  type StoredRepair,
} from "@/lib/repair-store";
import { RepairDetailsPanel } from "@/components/repairs/repair-details-panel";
import { useTenantRepairLabel } from "@/lib/use-tenant-terminology";

type LinkModalState = { open: boolean; threadId: string | null };
const fallbackQuickReplies = [
  "Thanks for your message! We will check this right away.",
  "Can you share your serial number?",
  "Your repair is ready for pickup. Please visit us during opening hours."
];
const SELECTED_THREAD_STORAGE_KEY = "statusflow.selected-thread-id";

function LinkRepairModal({
  repairs,
  repairLabel,
  onClose,
  onSelect,
  onCreate,
}: {
  repairs: StoredRepair[];
  repairLabel: string;
  onClose: () => void;
  onSelect: (repairId: string) => void;
  onCreate: () => void;
}) {
  const [query, setQuery] = useState("");

  const filtered = repairs.filter((repair) =>
    `${repair.title} ${repair.customerName} ${repair.assetName}`
      .toLowerCase()
      .includes(query.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#02050d]/80 px-4 backdrop-blur-sm">
      <div className="w-full max-w-xl rounded-2xl border border-[#d7dce3] bg-[#f4f6fa] p-6 text-slate-900 shadow-[0_24px_80px_rgba(0,0,0,0.5)]">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-semibold">Link to {repairLabel}</h2>
            <button
              type="button"
              onClick={onCreate}
              className="rounded-xl border border-[#2fb2a3]/40 bg-[#2fb2a3]/10 px-3 py-1 text-xs font-semibold text-[#1f8e82] hover:bg-[#2fb2a3]/20"
            >
              + New {repairLabel}
            </button>
          </div>
          <button
            onClick={onClose}
            className="rounded-md p-1 text-slate-500 hover:bg-slate-200"
            type="button"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <label className="mb-4 flex items-center gap-2 rounded-xl border border-[#bfc9d8] bg-white px-3 py-2">
          <Search className="h-4 w-4 text-slate-500" />
          <input
            className="w-full bg-transparent text-sm outline-none"
            placeholder={`Search ${repairLabel.toLowerCase()}s...`}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>

        <div className="space-y-2">
          {filtered.map((repair) => (
            <button
              key={repair.id}
              type="button"
              onClick={() => onSelect(repair.id)}
              className="w-full rounded-xl border border-[#cdd5e2] bg-white p-3 text-left hover:bg-slate-50"
            >
              <div className="flex items-center justify-between">
                <div className="font-semibold">{repair.title}</div>
                <span className="rounded-full bg-slate-200 px-2 py-0.5 text-xs text-slate-600">
                  {repair.stage}
                </span>
              </div>
              <div className="text-sm text-slate-600">
                {repair.customerName} · {repair.assetName}
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function QuickReplyPickerModal({
  onClose,
  onSelect,
  quickReplyOptions,
}: {
  onClose: () => void;
  onSelect: (value: string) => void;
  quickReplyOptions: string[];
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#02050d]/80 px-4 backdrop-blur-sm">
      <div className="w-full max-w-xl rounded-2xl border border-[#d7dce3] bg-[#f4f6fa] p-6 text-slate-900 shadow-[0_24px_80px_rgba(0,0,0,0.5)]">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-2xl font-semibold">Quick replies</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-slate-500 hover:bg-slate-200"
            aria-label="Close quick reply picker"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-2">
          {quickReplyOptions.map((item, index) => (
            <button
              key={`${item}-${index}`}
              type="button"
              onClick={() => onSelect(item)}
              className="w-full rounded-xl border border-[#cdd5e2] bg-white px-3 py-2 text-left text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              {item}
            </button>
          ))}
          {quickReplyOptions.length === 0 ? (
            <p className="rounded-xl border border-dashed border-[#cdd5e2] bg-white px-3 py-4 text-sm text-slate-500">
              No quick replies available.
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function ConversationsPageContent() {
  const searchParams = useSearchParams();
  const repairLabel = useTenantRepairLabel();

  const [threads, setThreads] = useState<StoredConversation[]>(() =>
    readStoredConversations(defaultConversations)
  );
  const [repairs, setRepairs] = useState<StoredRepair[]>(() =>
    readStoredRepairs(defaultRepairs)
  );
  const [selectedThreadId, setSelectedThreadId] = useState<string>(
    () => {
      if (typeof window === "undefined") return readStoredConversations(defaultConversations)[0]?.id ?? "";
      return (
        window.localStorage.getItem(SELECTED_THREAD_STORAGE_KEY) ??
        readStoredConversations(defaultConversations)[0]?.id ??
        ""
      );
    }
  );
  const [message, setMessage] = useState("");
  const [quickReplyOptions, setQuickReplyOptions] = useState<string[]>(() => {
    if (typeof window === "undefined") {
      return fallbackQuickReplies;
    }
    try {
      const raw = window.localStorage.getItem("statusflow.quick-replies");
      if (!raw) return fallbackQuickReplies;
      const parsed = JSON.parse(raw) as { body?: string }[];
      if (!Array.isArray(parsed)) return fallbackQuickReplies;
      const replies = parsed.map((item) => item.body ?? "").filter((item) => item.trim().length > 0);
      return replies.length > 0 ? replies : fallbackQuickReplies;
    } catch {
      return fallbackQuickReplies;
    }
  });
  const [showQuickReplyPicker, setShowQuickReplyPicker] = useState(false);
  const [showRepairPanel, setShowRepairPanel] = useState(true);
  const [isMobileRepairDrawerOpen, setIsMobileRepairDrawerOpen] = useState(false);
  const [listCollapsed, setListCollapsed] = useState(false);
  const [mobileActivePane, setMobileActivePane] = useState<"list" | "chat">(
    "list"
  );
  const [linkModal, setLinkModal] = useState<LinkModalState>({
    open: false,
    threadId: null,
  });
  const messageWindowRef = useRef<HTMLDivElement | null>(null);
  const imageInputRef = useRef<HTMLInputElement | null>(null);

  const threadIdParam = searchParams.get("threadId");

  useEffect(() => {
    const storedRepairs = readStoredRepairs(defaultRepairs);
    setRepairs(storedRepairs);

    setThreads((prev) =>
      prev.map((thread) => {
        const autoRepair = storedRepairs.find(
          (repair) => repair.customerPhone === thread.customerPhone
        );

        return {
          ...thread,
          customerName: autoRepair
            ? autoRepair.customerName
            : thread.customerName || thread.customerPhone,
          linkedRepairId: thread.linkedRepairId ?? autoRepair?.id,
        };
      })
    );
  }, []);

  useEffect(() => {
    writeStoredConversations(threads);
  }, [threads]);

  useEffect(() => {
    if (!threadIdParam) return;

    if (threads.some((thread) => thread.id === threadIdParam)) {
      setSelectedThreadId(threadIdParam);
      setShowRepairPanel(true);
      setMobileActivePane("chat");
      setIsMobileRepairDrawerOpen(false);
    }
  }, [threadIdParam, threads]);

  useEffect(() => {
    if (!selectedThreadId) {
      window.localStorage.removeItem(SELECTED_THREAD_STORAGE_KEY);
      return;
    }

    window.localStorage.setItem(SELECTED_THREAD_STORAGE_KEY, selectedThreadId);
  }, [selectedThreadId]);

  useEffect(() => {
    const handleConversationNavClick = () => {
      setListCollapsed(false);
      setMobileActivePane("list");
      setIsMobileRepairDrawerOpen(false);
    };

    window.addEventListener("conversations:nav-click", handleConversationNavClick);

    return () => {
      window.removeEventListener(
        "conversations:nav-click",
        handleConversationNavClick
      );
    };
  }, []);

  useEffect(() => {
    const refreshQuickReplies = () => {
      try {
        const raw = window.localStorage.getItem("statusflow.quick-replies");
        const parsed = raw ? (JSON.parse(raw) as { body?: string }[]) : [];
        const replies = Array.isArray(parsed) ? parsed.map((item) => item.body ?? "").filter((item) => item.trim().length > 0) : [];
        setQuickReplyOptions(replies.length > 0 ? replies : fallbackQuickReplies);
      } catch {
        setQuickReplyOptions(fallbackQuickReplies);
      }
    };
    refreshQuickReplies();
    window.addEventListener("templates:changed", refreshQuickReplies);
    window.addEventListener("storage", refreshQuickReplies);
    return () => {
      window.removeEventListener("templates:changed", refreshQuickReplies);
      window.removeEventListener("storage", refreshQuickReplies);
    };
  }, []);

  const selectedThread = useMemo(
    () => threads.find((thread) => thread.id === selectedThreadId) ?? null,
    [threads, selectedThreadId]
  );

  const linkedRepair = selectedThread
    ? repairs.find((repair) => repair.id === selectedThread.linkedRepairId) ?? null
    : null;

  const sortedThreads = useMemo(
    () =>
      [...threads].sort((a, b) => {
        const aTimestamp = Number(
          a.messages[a.messages.length - 1]?.id.replace("m_", "") ?? 0
        );
        const bTimestamp = Number(
          b.messages[b.messages.length - 1]?.id.replace("m_", "") ?? 0
        );

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
              messages: [
                ...thread.messages,
                {
                  id: `m_${Date.now()}`,
                  role: "agent",
                  text: message.trim(),
                  at: "Now",
                },
              ],
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
              customerPhone: repair.customerPhone,
            }
          : thread
      )
    );

    setLinkModal({ open: false, threadId: null });
    setShowRepairPanel(true);
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
      status: "Open",
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
              customerPhone: newRepair.customerPhone,
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
              messages: [
                ...thread.messages,
                {
                  id: `m_${Date.now()}`,
                  role: "agent",
                  text: `📷 Image uploaded: ${file.name}`,
                  at: "Now",
                },
              ],
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

  const updateRepairStage = (repairId: string, stageName: string) => {
    setRepairs((prev) => {
      const updated = prev.map((repair) =>
        repair.id === repairId
          ? {
            ...repair,
            stage: stageName
          }
          : repair
      );
      writeStoredRepairs(updated);
      return updated;
    });
  };

  const showRepairColumn = showRepairPanel && Boolean(linkedRepair);
  const showMobileRepairDrawer = Boolean(selectedThread && linkedRepair);

  return (
    <div
      className={`-mx-5 -my-6 h-[calc(100dvh-69px)] overflow-hidden md:-mx-10 md:-my-8 md:h-[calc(100vh-69px)] md:grid md:gap-0 md:transition-[grid-template-columns] md:duration-300 ${
        listCollapsed ? "grid-cols-[88px_1fr]" : "grid-cols-[380px_1fr]"
      }`}
      style={{ background: "var(--bg)" }}
    >
      <aside
        className={`${
          mobileActivePane === "chat" ? "hidden md:flex" : "flex"
        } min-h-0 h-full flex-col border-r`}
        style={{
          borderColor: "var(--border)",
          background: "var(--surface-2)",
        }}
      >
        <div
          className={`min-h-0 flex-1 transition-opacity duration-200 ${
            listCollapsed ? "pointer-events-none opacity-0" : "opacity-100"
          }`}
        >
          <div className="p-4">
            <h1 className="text-2xl font-semibold text-white">Conversations</h1>
            <label
              className="mt-3 flex items-center gap-2 rounded-xl border px-3 py-2 text-slate-400"
              style={{
                borderColor: "var(--border)",
                background: "var(--surface-1)",
              }}
            >
              <Search className="h-4 w-4" />
              <input
                className="w-full bg-transparent text-sm outline-none"
                placeholder="Search..."
              />
            </label>
          </div>

          <div className="space-y-1 px-3 pb-3">
            {sortedThreads.map((thread) => (
              <button
                key={thread.id}
                type="button"
                onClick={() => {
                  setSelectedThreadId(thread.id);
                  setMobileActivePane("chat");
                  setIsMobileRepairDrawerOpen(false);
                }}
                className={`w-full rounded-xl border p-3 text-left ${
                  selectedThreadId === thread.id
                    ? ""
                    : "border-transparent hover:bg-white/5"
                }`}
                style={
                  selectedThreadId === thread.id
                    ? {
                        borderColor: "var(--border-strong)",
                        background: "var(--surface-3)",
                      }
                    : undefined
                }
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium text-slate-200">
                    {thread.customerName || thread.customerPhone}
                  </span>
                  <span className="text-xs text-slate-500">{thread.updatedAt}</span>
                </div>
                <p className="mt-1 text-sm text-slate-300">{thread.preview}</p>
                <p className="mt-1 text-xs italic text-slate-500">
                  {thread.linkedRepairId
                    ? `🔗 ${
                        repairs.find((r) => r.id === thread.linkedRepairId)?.title ??
                        "Repair linked"
                      }`
                    : "No repair linked"}
                </p>
              </button>
            ))}
          </div>
        </div>

        <div className="hidden border-t border-[#1a2436] p-4 md:block">
          <button
            type="button"
            onClick={toggleConversationList}
            className="mx-auto flex h-9 w-9 items-center justify-center rounded-md text-slate-500 hover:bg-slate-900/70"
            aria-label={
              listCollapsed
                ? "Expand conversations list"
                : "Collapse conversations list"
            }
          >
            <ChevronLeft
              className={`h-5 w-5 transition-transform ${
                listCollapsed ? "rotate-180" : ""
              }`}
            />
          </button>
        </div>
      </aside>

      <section
        className={`${
          mobileActivePane === "list" ? "hidden md:grid" : "grid"
        } relative min-h-0 h-full min-w-0 overflow-hidden ${
          showRepairColumn
            ? "grid-cols-[1fr] md:grid-cols-[1fr_380px]"
            : "grid-cols-[1fr]"
        }`}
        style={{ background: "var(--surface-1)" }}
      >
        <div className="flex min-h-0 min-w-0 flex-col">
          {selectedThread ? (
            <>
              <header
                className="sticky top-0 z-20 flex items-center justify-between border-b px-4 py-3 md:px-5"
                style={{ borderColor: "var(--border)" }}
              >
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setMobileActivePane("list")}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-md text-slate-400 hover:bg-slate-900/70 md:hidden"
                    aria-label="Back to conversations"
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </button>
                  <div>
                  <div className="font-semibold text-slate-200">
                    {selectedThread.customerName || selectedThread.customerPhone}
                  </div>
                  <div className="text-sm text-slate-500">
                    {selectedThread.customerPhone}
                  </div>
                </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="md:hidden">
                    {selectedThread.linkedRepairId ? (
                      <button
                        type="button"
                        onClick={() => setIsMobileRepairDrawerOpen(true)}
                        className="inline-flex items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface-3)] px-3 py-2 text-sm font-semibold text-[var(--text-primary)]"
                      >
                        <Wrench className="h-4 w-4" />
                        {repairLabel} details
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() =>
                          setLinkModal({ open: true, threadId: selectedThread.id })
                        }
                        className="inline-flex items-center gap-2 rounded-xl border border-[#253149] bg-[#111a2b] px-3 py-2 text-sm font-semibold text-slate-300"
                      >
                        <LinkIcon className="h-4 w-4" />
                        Link {repairLabel}
                      </button>
                    )}
                  </div>
                  <div className="hidden md:block">
                    {selectedThread.linkedRepairId ? (
                      showRepairPanel ? null : (
                        <button
                          type="button"
                          onClick={() => setShowRepairPanel((prev) => !prev)}
                          className="inline-flex items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface-3)] px-3 py-2 text-sm font-semibold text-[var(--text-primary)]"
                        >
                          <Wrench className="h-4 w-4" />
                          {repairLabel} Details
                        </button>
                      )
                    ) : (
                      <button
                        type="button"
                        onClick={() =>
                          setLinkModal({ open: true, threadId: selectedThread.id })
                        }
                        className="inline-flex items-center gap-2 rounded-xl border border-[#253149] bg-[#111a2b] px-3 py-2 text-sm font-semibold text-slate-300"
                      >
                        <LinkIcon className="h-4 w-4" />
                        Link {repairLabel}
                      </button>
                    )}
                  </div>
                </div>
              </header>

              <div ref={messageWindowRef} className="subtle-scrollbar flex-1 space-y-3 overflow-y-auto px-3 py-4 md:p-4">
                {selectedThread.messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`max-w-[72%] rounded-2xl px-4 py-3 text-base ${
                      msg.role === "agent" ? "ml-auto" : ""
                    }`}
                    style={
                      msg.role === "agent"
                        ? {
                            background: "var(--surface-3)",
                            color: "var(--text-primary)",
                          }
                        : {
                            background: "var(--surface-muted)",
                            color: "var(--text-primary)",
                          }
                    }
                  >
                    {msg.text}
                    <div className="mt-1 text-right text-xs opacity-70">{msg.at}</div>
                  </div>
                ))}
              </div>

              <div
                className="sticky bottom-0 z-20 border-t bg-[var(--surface-1)] p-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)]"
                style={{ borderColor: "var(--border)" }}
              >
                <div className="flex items-center gap-2">
                  <input
                    className="input chat-input"
                    placeholder="Type a message..."
                    value={message}
                    onChange={(event) => setMessage(event.target.value)}
                  />
                  <button
                    type="button"
                    onClick={() => setShowQuickReplyPicker(true)}
                    className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-[#253149] bg-[#111a2b] text-slate-300 hover:bg-[#182236]"
                    aria-label="Select quick reply"
                  >
                    <MessageSquareText className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => imageInputRef.current?.click()}
                    className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-[#253149] bg-[#111a2b] text-slate-300 hover:bg-[#182236]"
                    aria-label="Upload or capture image"
                  >
                    <Camera className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={sendMessage}
                    className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-[#25d3c4] text-[#022a36]"
                  >
                    <Send className="h-4 w-4" />
                  </button>
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
          <div
            className="relative hidden h-full min-h-0 overflow-hidden border-l md:block"
            style={{
              borderColor: "var(--border)",
              background: "var(--surface-1)",
            }}
          >
            <RepairDetailsPanel
              repair={linkedRepair}
              itemLabel={repairLabel}
              onClose={() => setShowRepairPanel(false)}
              onStageChange={(stageName) => updateRepairStage(linkedRepair.id, stageName)}
              className="relative h-full min-h-0 pl-6 pr-5 py-5"
            />
          </div>
        ) : null}
      </section>

      {showMobileRepairDrawer && linkedRepair ? (
        <div
          className={`fixed inset-0 z-40 bg-[#02050d]/55 transition-opacity duration-300 md:hidden ${
            isMobileRepairDrawerOpen ? "opacity-100" : "pointer-events-none opacity-0"
          }`}
          onClick={() => setIsMobileRepairDrawerOpen(false)}
          aria-hidden="true"
        >
          <div
            className={`absolute inset-y-0 right-0 w-full max-w-[min(100vw,28rem)] transform border-l shadow-[-16px_0_36px_rgba(0,0,0,0.36)] transition-transform duration-300 ease-out ${
              isMobileRepairDrawerOpen ? "translate-x-0" : "translate-x-full"
            }`}
            style={{
              borderColor: "var(--border)",
              background: "var(--surface-1)",
            }}
            onClick={(event) => event.stopPropagation()}
          >
            <RepairDetailsPanel
              repair={linkedRepair}
              itemLabel={repairLabel}
              onClose={() => setIsMobileRepairDrawerOpen(false)}
              onStageChange={(stageName) => updateRepairStage(linkedRepair.id, stageName)}
              className="h-full min-h-0 max-w-full overflow-hidden px-4 py-4"
            />
          </div>
        </div>
      ) : null}

      {linkModal.open && linkModal.threadId ? (
        <LinkRepairModal
          repairs={repairs.filter((repair) => repair.status === "Open")}
          repairLabel={repairLabel}
          onClose={() => setLinkModal({ open: false, threadId: null })}
          onSelect={(repairId) => linkRepairToThread(linkModal.threadId!, repairId)}
          onCreate={() => createRepairFromThread(linkModal.threadId!)}
        />
      ) : null}

      {showQuickReplyPicker ? (
        <QuickReplyPickerModal
          onClose={() => setShowQuickReplyPicker(false)}
          quickReplyOptions={quickReplyOptions}
          onSelect={(value) => {
            setMessage(value);
            setShowQuickReplyPicker(false);
          }}
        />
      ) : null}
    </div>
  );
}

function ConversationsPageFallback() {
  return (
    <div
      className="-mx-5 -my-6 flex h-[calc(100dvh-69px)] items-center justify-center md:-mx-10 md:-my-8 md:h-[calc(100vh-69px)]"
      style={{ background: "var(--bg)" }}
    >
      <div className="text-sm text-slate-400">Loading conversations...</div>
    </div>
  );
}

export default function ConversationsPage() {
  return (
    <Suspense fallback={<ConversationsPageFallback />}>
      <ConversationsPageContent />
    </Suspense>
  );
}

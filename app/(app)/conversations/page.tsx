"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState, type TouchEvent } from "react";
import { useSearchParams } from "next/navigation";
import clsx from "clsx";
import {
  Search,
  Send,
  Link as LinkIcon,
  Wrench,
  X,
  ChevronLeft,
  MessageSquareText,
  Camera,
  ArrowUpDown,
  RotateCcw,
  Trash2,
} from "lucide-react";
import { ModalShell } from "@/components/ui/modal-shell";
import {
  dedupeConversationsById,
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
import { defaultWorkflowStages, readStoredWorkflowStages, type StoredWorkflowStage } from "@/lib/workflow-stage-store";
import { createNormalizedInboundMessage } from "@/lib/integrations/providers/normalized-inbound-message";
import { findMatchingWorkflowButtonAction } from "@/lib/workflows/button-reply-matcher";
import { executeWorkflowButtonAction } from "@/lib/workflows/workflow-button-action-executor";
import { LocalWorkflowActionRepository, getLocalTenantId } from "@/lib/workflows/workflow-action-repository";
import { applyRepairStageChange, type RepairStageChangeOptions } from "@/lib/repair-stage-change";

type LinkModalState = { open: boolean; threadId: string | null };
type TouchGesture = { x: number; y: number };
const fallbackQuickReplies = [
  "Thanks for your message! We will check this right away.",
  "Can you share your serial number?",
  "Your repair is ready for pickup. Please visit us during opening hours."
];
const SELECTED_THREAD_STORAGE_KEY = "statusflow.selected-thread-id";
const TEMPLATE_BUTTONS_MARKER = "\n\nButtons:\n";

function parseTemplateMessageContent(text: string) {
  const markerIndex = text.indexOf(TEMPLATE_BUTTONS_MARKER);
  if (markerIndex < 0) {
    return {
      body: text,
      buttons: [] as string[]
    };
  }

  const body = text.slice(0, markerIndex).trimEnd();
  const buttons = text
    .slice(markerIndex + TEMPLATE_BUTTONS_MARKER.length)
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("- "))
    .map((line) => line.slice(2).trim())
    .filter((line) => line.length > 0);

  return {
    body: body.length > 0 ? body : text,
    buttons
  };
}

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
  const [selectedRepairId, setSelectedRepairId] = useState<string | null>(null);

  const filtered = repairs.filter((repair) =>
    `${repair.title} ${repair.customerName} ${repair.assetName}`
      .toLowerCase()
      .includes(query.toLowerCase())
  );

  return (
    <ModalShell
      title={(
        <div className="flex items-center gap-3">
          <span>Link to {repairLabel}</span>
          <button
            type="button"
            onClick={onCreate}
            className="rounded-xl border border-[#2fb2a3]/40 bg-[#2fb2a3]/10 px-3 py-1 text-xs font-semibold text-[#1f8e82] hover:bg-[#2fb2a3]/20"
          >
            + New {repairLabel}
          </button>
        </div>
      )}
      onClose={onClose}
      maxWidthClassName="max-w-xl"
      closeLabel="Close link repair dialog"
      closeOnBackdrop
      footer={(
        <>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-[#d0d6e0] bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => selectedRepairId && onSelect(selectedRepairId)}
            className={clsx(
              "rounded-xl px-5 py-2 text-sm font-semibold text-white",
              selectedRepairId ? "bg-[#2fb2a3] hover:bg-[#2a9f91]" : "cursor-not-allowed bg-slate-400"
            )}
            disabled={!selectedRepairId}
          >
            Link
          </button>
        </>
      )}
    >
      <div className="space-y-4">
        <label className="flex items-center gap-2 rounded-xl border border-[#bfc9d8] bg-white px-3 py-2">
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
              onClick={() => setSelectedRepairId(repair.id)}
              className={clsx(
                "w-full rounded-xl border bg-white p-3 text-left hover:bg-slate-50",
                selectedRepairId === repair.id
                  ? "border-[#2fb2a3] ring-2 ring-[#2fb2a3]/20"
                  : "border-[#cdd5e2]"
              )}
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
    </ModalShell>
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
    <ModalShell title="Quick replies" onClose={onClose} maxWidthClassName="max-w-xl" closeLabel="Close quick reply picker">
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
    </ModalShell>
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
  const [workflowStages, setWorkflowStages] = useState<StoredWorkflowStage[]>(() =>
    readStoredWorkflowStages(defaultWorkflowStages)
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
  const processedInboundIdsRef = useRef<Set<string>>(new Set());
  const [showRepairPanel, setShowRepairPanel] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"open" | "closed">("open");
  const [sortDirection, setSortDirection] = useState<"newest" | "oldest">("newest");
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
  const messageInputRef = useRef<HTMLTextAreaElement | null>(null);
  const touchStartRef = useRef<TouchGesture | null>(null);
  const repairDrawerTouchStartRef = useRef<TouchGesture | null>(null);
  const listTouchStartRef = useRef<TouchGesture | null>(null);

  const formatScheduledTemplateLabel = useCallback((scheduledForIso?: string, cancelled = false) => {
    if (!scheduledForIso) return null;
    const scheduledDate = new Date(scheduledForIso);
    if (Number.isNaN(scheduledDate.getTime())) return null;

    const formatter = new Intl.DateTimeFormat("en-GB", {
      timeZone: "Europe/Amsterdam",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      day: "2-digit",
      month: "short",
      timeZoneName: "short"
    });

    return `${cancelled ? "Cancelled sending" : "Scheduled send"}: ${formatter.format(scheduledDate)}`;
  }, []);

  const threadIdParam = searchParams.get("threadId");
  const normalizedSearchQuery = searchQuery.trim().toLowerCase();

  const updateThreads = useCallback(
    (updater: (current: StoredConversation[]) => StoredConversation[]) => {
      setThreads((previousThreads) => dedupeConversationsById(updater(previousThreads)));
    },
    []
  );

  useEffect(() => {
    const storedRepairs = readStoredRepairs(defaultRepairs);
    setRepairs(storedRepairs);

    updateThreads((prev) =>
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
  }, [updateThreads]);

  useEffect(() => {
    const refreshWorkflowStages = () => setWorkflowStages(readStoredWorkflowStages(defaultWorkflowStages));
    refreshWorkflowStages();
    window.addEventListener("workflow-stages:changed", refreshWorkflowStages);
    window.addEventListener("storage", refreshWorkflowStages);
    return () => {
      window.removeEventListener("workflow-stages:changed", refreshWorkflowStages);
      window.removeEventListener("storage", refreshWorkflowStages);
    };
  }, []);

  useEffect(() => {
    writeStoredConversations(threads);
  }, [threads]);

  useEffect(() => {
    const flushScheduledTemplates = () => {
      const now = Date.now();

      updateThreads((prev) =>
        prev.map((thread) => {
          let threadChanged = false;
          const nextMessages = thread.messages.map((message) => {
            if (!message.scheduledForIso) return message;
            if (message.scheduledStatus === "cancelled") return message;
            const scheduledAtMs = new Date(message.scheduledForIso).getTime();
            if (Number.isNaN(scheduledAtMs) || scheduledAtMs > now) return message;

            threadChanged = true;
            return {
              ...message,
              at: "Now",
              scheduledForIso: undefined,
              scheduledStatus: undefined
            };
          });

          return threadChanged ? { ...thread, messages: nextMessages } : thread;
        })
      );
    };

    flushScheduledTemplates();
    const intervalId = window.setInterval(flushScheduledTemplates, 30_000);
    return () => window.clearInterval(intervalId);
  }, [updateThreads]);

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

  useEffect(() => {
    const inputElement = messageInputRef.current;
    if (!inputElement) return;

    const baseHeight = 44;
    const expandedHeight = 88;
    inputElement.style.height = `${baseHeight}px`;
    const nextHeight = inputElement.scrollHeight > baseHeight ? expandedHeight : baseHeight;
    inputElement.style.height = `${nextHeight}px`;
  }, [message]);

  const selectedThread = useMemo(
    () => threads.find((thread) => thread.id === selectedThreadId) ?? null,
    [threads, selectedThreadId]
  );

  const linkedRepair = selectedThread
    ? repairs.find((repair) => repair.id === selectedThread.linkedRepairId) ?? null
    : null;

  const visibleThreads = useMemo(() => {
    const sortThreads = (left: StoredConversation, right: StoredConversation) => {
      const leftTimestamp = Number(
        left.messages[left.messages.length - 1]?.id.replace("m_", "") ?? 0
      );
      const rightTimestamp = Number(
        right.messages[right.messages.length - 1]?.id.replace("m_", "") ?? 0
      );

      if (leftTimestamp !== rightTimestamp) {
        return sortDirection === "newest"
          ? rightTimestamp - leftTimestamp
          : leftTimestamp - rightTimestamp;
      }
      if (left.updatedAt === "Now" && right.updatedAt !== "Now") {
        return sortDirection === "newest" ? -1 : 1;
      }
      if (right.updatedAt === "Now" && left.updatedAt !== "Now") {
        return sortDirection === "newest" ? 1 : -1;
      }
      return sortDirection === "newest"
        ? right.updatedAt.localeCompare(left.updatedAt)
        : left.updatedAt.localeCompare(right.updatedAt);
    };

    const matchesSearchQuery = (thread: StoredConversation) =>
      `${thread.customerName} ${thread.customerPhone} ${thread.preview}`
        .toLowerCase()
        .includes(normalizedSearchQuery);

    const matchesStatusFilter = (thread: StoredConversation) =>
      thread.open === (statusFilter === "open");

    const matchesConversationFilters = (thread: StoredConversation) => {
      if (!matchesSearchQuery(thread)) return false;
      return matchesStatusFilter(thread);
    };

    return dedupeConversationsById(threads.filter(matchesConversationFilters)).sort(sortThreads);
  }, [normalizedSearchQuery, sortDirection, statusFilter, threads]);

  useEffect(() => {
    if (visibleThreads.length === 0) {
      if (selectedThreadId) {
        setSelectedThreadId("");
      }
      return;
    }

    if (!selectedThreadId) {
      setSelectedThreadId(visibleThreads[0]?.id ?? "");
      return;
    }

    if (visibleThreads.some((thread) => thread.id === selectedThreadId)) return;

    setSelectedThreadId(visibleThreads[0]?.id ?? "");
  }, [selectedThreadId, visibleThreads]);

  useEffect(() => {
    if (!messageWindowRef.current) return;
    messageWindowRef.current.scrollTop = messageWindowRef.current.scrollHeight;
  }, [selectedThreadId, selectedThread?.messages.length]);

  const updateConversationOpenState = (threadId: string, open: boolean) => {
    updateThreads((prev) =>
      prev.map((thread) => (thread.id === threadId ? { ...thread, open } : thread))
    );
  };

  const sendMessage = ({ closeConversation = false }: { closeConversation?: boolean } = {}) => {
    if (!selectedThread || !message.trim()) return;

    updateThreads((prev) =>
      prev.map((thread) =>
        thread.id === selectedThread.id
          ? {
              ...thread,
              preview: message.trim(),
              updatedAt: "Now",
              open: closeConversation ? false : true,
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

  const handleConversationStatusButtonClick = () => {
    if (!selectedThread) return;
    updateConversationOpenState(selectedThread.id, !selectedThread.open);
  };

  const cancelScheduledTemplateMessage = useCallback((threadId: string, messageId: string) => {
    updateThreads((prev) =>
      prev.map((thread) => {
        if (thread.id !== threadId) return thread;

        let didUpdate = false;
        const messages = thread.messages.map((message) => {
          if (message.id !== messageId || !message.scheduledForIso || message.scheduledStatus === "cancelled") {
            return message;
          }
          didUpdate = true;
          return {
            ...message,
            scheduledStatus: "cancelled"
          };
        });

        return didUpdate ? { ...thread, messages } : thread;
      })
    );
  }, [updateThreads]);

  const linkRepairToThread = (threadId: string, repairId: string) => {
    const repair = repairs.find((item) => item.id === repairId);
    if (!repair) return;

    updateThreads((prev) =>
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

    updateThreads((prev) =>
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

    updateThreads((prev) =>
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

  const updateRepairStage = useCallback((repairId: string, stageName: string, options?: RepairStageChangeOptions) => {
    const result = applyRepairStageChange({
      repairs,
      conversations: threads,
      repairId,
      stageName,
      options
    });
    setRepairs(result.repairs);
    writeStoredRepairs(result.repairs);
    updateThreads(() => result.conversations);
  }, [repairs, threads, updateThreads]);

  useEffect(() => {
    const tenantId = getLocalTenantId();
    const repository = new LocalWorkflowActionRepository(workflowStages);

    threads.forEach((thread) => {
      const lastMessage = thread.messages[thread.messages.length - 1];
      if (!lastMessage || lastMessage.role !== "customer") return;
      if (processedInboundIdsRef.current.has(lastMessage.id)) return;
      processedInboundIdsRef.current.add(lastMessage.id);

      const inbound = createNormalizedInboundMessage({
        tenantId,
        provider: "local",
        conversationId: thread.id,
        messageId: lastMessage.id,
        messageText: lastMessage.text,
        occurredAt: new Date().toISOString(),
        rawPayload: { threadId: thread.id, messageId: lastMessage.id }
      });

      const preferredStageId = repairs.find((item) => item.id === thread.linkedRepairId)?.stage;
      const preferredWorkflowStageId = workflowStages.find((item) => item.name === preferredStageId)?.id;
      const result = findMatchingWorkflowButtonAction({
        repository,
        inboundMessage: inbound,
        preferredWorkflowStageId
      });

      if (result.status !== "matched") {
        if (result.status === "ambiguous") {
          console.warn("[workflow-button-reply] Ambiguous button reply, skipping automatic execution.", {
            tenantId,
            normalizedText: inbound.messageTextNormalized,
            candidateCount: result.candidates.length
          });
        }
        return;
      }

      const linkedRepairId = thread.linkedRepairId;
      if (!linkedRepairId) return;

      const execution = executeWorkflowButtonAction(result.mapping);
      if (execution.actionType === "MOVE_TO_STAGE" && execution.moveToStageId) {
        const targetStage = workflowStages.find((item) => item.id === execution.moveToStageId);
        if (targetStage) {
          updateRepairStage(linkedRepairId, targetStage.name);
        }
      }
    });
  }, [repairs, threads, updateRepairStage, workflowStages]);

  const showRepairColumn = showRepairPanel && Boolean(linkedRepair);
  const showMobileRepairDrawer = Boolean(selectedThread && linkedRepair);

  const handleChatTouchStart = (event: TouchEvent<HTMLDivElement>) => {
    const firstTouch = event.touches[0];
    if (!firstTouch) return;
    touchStartRef.current = { x: firstTouch.clientX, y: firstTouch.clientY };
  };

  const handleChatTouchEnd = (event: TouchEvent<HTMLDivElement>) => {
    const touchStart = touchStartRef.current;
    touchStartRef.current = null;
    if (!touchStart || mobileActivePane !== "chat") return;

    const firstChangedTouch = event.changedTouches[0];
    if (!firstChangedTouch) return;

    const deltaX = firstChangedTouch.clientX - touchStart.x;
    const deltaY = firstChangedTouch.clientY - touchStart.y;
    const minHorizontalSwipe = 70;
    const maxVerticalMovement = 50;

    if (
      Math.abs(deltaX) < minHorizontalSwipe ||
      Math.abs(deltaY) > maxVerticalMovement
    ) {
      return;
    }

    if (deltaX > 0) {
      setMobileActivePane("list");
      setIsMobileRepairDrawerOpen(false);
      return;
    }

    if (linkedRepair) {
      setIsMobileRepairDrawerOpen(true);
    }
  };

  const handleRepairDrawerTouchStart = (event: TouchEvent<HTMLDivElement>) => {
    const firstTouch = event.touches[0];
    if (!firstTouch) return;
    repairDrawerTouchStartRef.current = { x: firstTouch.clientX, y: firstTouch.clientY };
  };

  const handleRepairDrawerTouchEnd = (event: TouchEvent<HTMLDivElement>) => {
    const touchStart = repairDrawerTouchStartRef.current;
    repairDrawerTouchStartRef.current = null;
    if (!touchStart || !isMobileRepairDrawerOpen) return;

    const firstChangedTouch = event.changedTouches[0];
    if (!firstChangedTouch) return;

    const deltaX = firstChangedTouch.clientX - touchStart.x;
    const deltaY = firstChangedTouch.clientY - touchStart.y;
    const minHorizontalSwipe = 70;
    const maxVerticalMovement = 50;

    if (
      Math.abs(deltaX) < minHorizontalSwipe ||
      Math.abs(deltaY) > maxVerticalMovement ||
      deltaX < 0
    ) {
      return;
    }

    setIsMobileRepairDrawerOpen(false);
  };

  const handleListTouchStart = (event: TouchEvent<HTMLElement>) => {
    const firstTouch = event.touches[0];
    if (!firstTouch) return;
    listTouchStartRef.current = { x: firstTouch.clientX, y: firstTouch.clientY };
  };

  const handleListTouchEnd = (event: TouchEvent<HTMLElement>) => {
    const touchStart = listTouchStartRef.current;
    listTouchStartRef.current = null;
    if (!touchStart || mobileActivePane !== "list") return;

    const firstChangedTouch = event.changedTouches[0];
    if (!firstChangedTouch) return;

    const deltaX = firstChangedTouch.clientX - touchStart.x;
    const deltaY = firstChangedTouch.clientY - touchStart.y;
    const minHorizontalSwipe = 70;
    const maxVerticalMovement = 50;

    if (Math.abs(deltaX) < minHorizontalSwipe || Math.abs(deltaY) > maxVerticalMovement || deltaX < 0) {
      return;
    }

    window.dispatchEvent(new Event("mobile-menu:open"));
  };

  return (
    <div
      className={`fixed inset-x-0 bottom-0 top-[69px] overflow-hidden md:static md:-mx-10 md:-my-8 md:h-[calc(100vh-69px)] md:grid md:gap-0 md:transition-[grid-template-columns] md:duration-300 ${
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
        onTouchStart={handleListTouchStart}
        onTouchEnd={handleListTouchEnd}
      >
        <div
          className={`min-h-0 flex-1 transition-opacity duration-200 ${
            listCollapsed ? "pointer-events-none opacity-0" : "opacity-100"
          }`}
        >
          <div className="p-4">
            <h1 className="text-2xl font-semibold text-white">Conversations</h1>
            <div className="mt-3 flex items-center gap-2">
              <label
                className="flex flex-1 items-center gap-2 rounded-xl border px-3 py-1.5 text-slate-400"
                style={{
                  borderColor: "var(--border)",
                  background: "var(--surface-1)",
                }}
              >
                <Search className="h-4 w-4" />
                <input
                  className="w-full bg-transparent text-xs outline-none"
                  placeholder="Search..."
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                />
              </label>
              <button
                type="button"
                onClick={() =>
                  setSortDirection((prev) => (prev === "newest" ? "oldest" : "newest"))
                }
                className="inline-flex h-9 w-9 items-center justify-center rounded-xl border text-slate-300 hover:bg-white/5"
                style={{ borderColor: "var(--border)", background: "var(--surface-1)" }}
                aria-label={
                  sortDirection === "newest"
                    ? "Sort by oldest first"
                    : "Sort by newest first"
                }
              >
                <ArrowUpDown className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setStatusFilter("open")}
                className={`rounded-xl border px-3 py-2 text-sm font-medium transition ${
                  statusFilter === "open" ? "text-white" : "text-slate-300"
                }`}
                style={
                  statusFilter === "open"
                    ? { borderColor: "var(--border-strong)", background: "var(--surface-3)" }
                    : { borderColor: "var(--border)", background: "var(--surface-1)" }
                }
              >
                Open
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter("closed")}
                className={`rounded-xl border px-3 py-2 text-sm font-medium transition ${
                  statusFilter === "closed" ? "text-white" : "text-slate-300"
                }`}
                style={
                  statusFilter === "closed"
                    ? { borderColor: "var(--border-strong)", background: "var(--surface-3)" }
                    : { borderColor: "var(--border)", background: "var(--surface-1)" }
                }
              >
                Closed
              </button>
            </div>
          </div>

          <div className="space-y-1 px-3 pb-3">
            {visibleThreads.map((thread) => (
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
            {visibleThreads.length === 0 ? (
              <p className="rounded-xl border border-dashed border-[#2f3c52] px-3 py-4 text-sm text-slate-400">
                No {statusFilter} conversations found.
              </p>
            ) : null}
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
        <div
          className="flex min-h-0 min-w-0 flex-col"
          onTouchStart={handleChatTouchStart}
          onTouchEnd={handleChatTouchEnd}
        >
          {selectedThread ? (
            <>
              <header
                className="fixed left-0 right-0 top-[69px] z-30 flex items-center justify-between border-b px-4 py-3 md:sticky md:top-0 md:px-5"
                style={{
                  borderColor: "var(--border)",
                  background: "var(--surface-1)",
                }}
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
                        <Wrench className="h-4 w-4 text-[#25d3c4]" />
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

              <div
                ref={messageWindowRef}
                className="subtle-scrollbar flex-1 space-y-3 overflow-y-auto px-3 pb-4 pt-[76px] md:p-4"
              >
                {selectedThread.messages.map((msg) => {
                  const parsedMessage = parseTemplateMessageContent(msg.text);
                  const hasTemplateButtons = parsedMessage.buttons.length > 0;
                  const isCancelledScheduledTemplate = msg.scheduledStatus === "cancelled";

                  return (
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
                      <div className="whitespace-pre-wrap">{parsedMessage.body}</div>
                      {hasTemplateButtons ? (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {parsedMessage.buttons.map((buttonText, buttonIndex) => (
                            <span
                              key={`${msg.id}-template-button-${buttonText}-${buttonIndex}`}
                              className="rounded-full border border-slate-300 bg-slate-200 px-2.5 py-1 text-xs font-medium text-slate-700"
                            >
                              {buttonText}
                            </span>
                          ))}
                        </div>
                      ) : null}
                      {msg.scheduledForIso ? (
                        <div
                          className={clsx(
                            "mt-2 inline-flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-xs font-medium",
                            isCancelledScheduledTemplate
                              ? "border-[#a43f2e]/35 bg-[#fff2ef] text-[#8f311f]"
                              : "border-[#2b6cb0]/40 bg-[#eaf4ff] text-[#1e4e8c]"
                          )}
                        >
                          {!isCancelledScheduledTemplate ? (
                            <button
                              type="button"
                              onClick={() => cancelScheduledTemplateMessage(selectedThread.id, msg.id)}
                              className="inline-flex h-5 w-5 items-center justify-center rounded-md text-current transition hover:bg-black/10"
                              aria-label="Cancel scheduled template send"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          ) : (
                            <span className="inline-flex h-5 w-5 items-center justify-center rounded-md bg-black/5">
                              <Trash2 className="h-3.5 w-3.5" />
                            </span>
                          )}
                          <span>{formatScheduledTemplateLabel(msg.scheduledForIso, isCancelledScheduledTemplate)}</span>
                        </div>
                      ) : null}
                      <div className="mt-1 text-right text-xs opacity-70">{msg.at}</div>
                    </div>
                  );
                })}
              </div>

              <div
                className="sticky bottom-0 z-20 mt-auto shrink-0 border-t bg-[var(--surface-1)] p-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)]"
                style={{ borderColor: "var(--border)" }}
              >
                <div className="flex items-center gap-2">
                  <textarea
                    ref={messageInputRef}
                    className="input chat-input resize-none"
                    placeholder="Type a message..."
                    value={message}
                    onChange={(event) => setMessage(event.target.value)}
                    rows={1}
                    style={{ minHeight: "44px", maxHeight: "88px" }}
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
                    onClick={handleConversationStatusButtonClick}
                    className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-[#253149] bg-[#111a2b] text-slate-300 transition-colors hover:bg-[#182236]"
                    aria-label={selectedThread.open ? "Close conversation" : "Reopen conversation"}
                  >
                    {selectedThread.open ? <X className="h-4 w-4" /> : <RotateCcw className="h-4 w-4" />}
                  </button>
                  <button
                    type="button"
                    onClick={() => sendMessage()}
                    className="inline-flex h-11 w-14 items-center justify-center rounded-xl border border-[#2ae0d0] bg-[#25d3c4] text-[#022a36] shadow-[0_6px_18px_rgba(37,211,196,0.45)] transition-all hover:-translate-y-0.5 hover:bg-[#33decf] hover:shadow-[0_10px_20px_rgba(37,211,196,0.55)]"
                    aria-label="Send message"
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
              onStageChange={(stageName, options) =>
                updateRepairStage(linkedRepair.id, stageName, options)
              }
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
            className={`absolute inset-y-0 right-0 w-[calc(100%-3.25rem)] max-w-[28rem] min-w-[18rem] transform border-l shadow-[-16px_0_36px_rgba(0,0,0,0.36)] transition-transform duration-300 ease-out ${
              isMobileRepairDrawerOpen ? "translate-x-0" : "translate-x-full"
            }`}
            style={{
              borderColor: "var(--border)",
              background: "var(--surface-1)",
            }}
            onClick={(event) => event.stopPropagation()}
            onTouchStart={handleRepairDrawerTouchStart}
            onTouchEnd={handleRepairDrawerTouchEnd}
          >
            <div className="pointer-events-none absolute inset-y-0 -left-3 flex items-center">
              <span className="h-12 w-1 rounded-full bg-white/30" aria-hidden="true" />
            </div>
            <RepairDetailsPanel
              repair={linkedRepair}
              itemLabel={repairLabel}
              onClose={() => setIsMobileRepairDrawerOpen(false)}
              onStageChange={(stageName, options) =>
                updateRepairStage(linkedRepair.id, stageName, options)
              }
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

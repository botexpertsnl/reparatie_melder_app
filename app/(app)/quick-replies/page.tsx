"use client";

import { useEffect, useMemo, useState } from "react";
import { MoreHorizontal, Pencil, Plus, Trash2 } from "lucide-react";
import clsx from "clsx";
import Link from "next/link";
import { ModalShell } from "@/components/ui/modal-shell";

import { defaultWorkflowStages, filterVisibleWorkflowStages, readStoredWorkflowStages, type StoredWorkflowStage } from "@/lib/workflow-stage-store";

type QuickReply = {
  id: string;
  name: string;
  body: string;
};

const quickReplyStorageKey = "statusflow.quick-replies";

const initialQuickReplies: QuickReply[] = [
  { id: "qr_1", name: "Greeting", body: "Thanks for your message! We will check this right away." },
  { id: "qr_2", name: "Pickup Info", body: "Your repair is ready for pickup. Please visit us during opening hours." }
];

function readStoredQuickReplies(fallback: QuickReply[]) {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(quickReplyStorageKey);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as QuickReply[];
    return Array.isArray(parsed) ? parsed : fallback;
  } catch {
    return fallback;
  }
}

function writeStoredQuickReplies(items: QuickReply[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(quickReplyStorageKey, JSON.stringify(items));
  window.dispatchEvent(new Event("templates:changed"));
}

function QuickReplyModal({
  mode,
  initialValues,
  onClose,
  onSubmit
}: {
  mode: "create" | "edit";
  initialValues: { name: string; body: string };
  onClose: () => void;
  onSubmit: (values: { name: string; body: string }) => void;
}) {
  const [name, setName] = useState(initialValues.name);
  const [body, setBody] = useState(initialValues.body);
  const isValid = name.trim().length > 0 && body.trim().length > 0;

  return (
    <ModalShell
      title={mode === "create" ? "Add Quick Reply" : "Edit Quick Reply"}
      onClose={onClose}
      maxWidthClassName="max-w-xl"
      closeLabel="Close quick reply modal"
      footer={
        <>
          <button type="button" onClick={onClose} className="rounded-xl border border-[#d0d6e0] bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100">Cancel</button>
          <button type="submit" form="quick-reply-form" className={clsx("rounded-xl px-5 py-2 text-sm font-semibold text-white", isValid ? "bg-[#2fb2a3] hover:bg-[#2a9f91]" : "cursor-not-allowed bg-slate-400")} disabled={!isValid}>{mode === "create" ? "Add Quick Reply" : "Save Quick Reply"}</button>
        </>
      }
    >
      <form
        id="quick-reply-form"
        className="space-y-5"
        onSubmit={(event) => {
          event.preventDefault();
          if (!isValid) return;
          onSubmit({ name: name.trim(), body: body.trim() });
        }}
      >
        <div>
          <label htmlFor="quick-reply-name" className="mb-2 block text-sm font-medium text-slate-700">Name *</label>
          <input id="quick-reply-name" className="w-full rounded-xl border border-[#bfc9d8] bg-white px-3 py-2 text-sm mobile-no-zoom outline-none focus:border-[#30b5a5]" value={name} onChange={(event) => setName(event.target.value)} />
        </div>
        <div>
          <label htmlFor="quick-reply-body" className="mb-2 block text-sm font-medium text-slate-700">Body preview *</label>
          <textarea id="quick-reply-body" className="min-h-24 w-full rounded-xl border border-[#bfc9d8] bg-white px-3 py-2 text-sm mobile-no-zoom outline-none focus:border-[#30b5a5]" value={body} onChange={(event) => setBody(event.target.value)} />
        </div>
      </form>
    </ModalShell>
  );
}

function DeleteQuickReplyModal({ quickReplyName, onCancel, onConfirm }: { quickReplyName: string; onCancel: () => void; onConfirm: () => void }) {
  return (
    <ModalShell
      title="Delete quick reply"
      onClose={onCancel}
      maxWidthClassName="max-w-md"
      closeLabel="Close delete quick reply dialog"
      footer={
        <>
          <button type="button" onClick={onCancel} className="rounded-xl border border-[#d0d6e0] bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100">Cancel</button>
          <button type="button" onClick={onConfirm} className="rounded-xl bg-red-500 px-5 py-2 text-sm font-semibold text-white hover:bg-red-600">Delete</button>
        </>
      }
    >
      <p className="text-sm text-slate-600">
        This quick reply will be permanently deleted: <span className="font-semibold">{quickReplyName}</span>.
      </p>
    </ModalShell>
  );
}

export default function QuickRepliesPage() {
  const [workflowStages, setWorkflowStages] = useState<StoredWorkflowStage[]>(() => readStoredWorkflowStages(defaultWorkflowStages));
  const [quickReplies, setQuickReplies] = useState<QuickReply[]>(() => readStoredQuickReplies(initialQuickReplies));
  const [isCreateQuickReplyModalOpen, setIsCreateQuickReplyModalOpen] = useState(false);
  const [editingQuickReplyId, setEditingQuickReplyId] = useState<string | null>(null);
  const [deletingQuickReplyId, setDeletingQuickReplyId] = useState<string | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  useEffect(() => {
    writeStoredQuickReplies(quickReplies);
  }, [quickReplies]);

  useEffect(() => {
    const refreshWorkflowStages = () => {
      setWorkflowStages(readStoredWorkflowStages(defaultWorkflowStages));
    };

    refreshWorkflowStages();
    window.addEventListener("workflow-stages:changed", refreshWorkflowStages);
    window.addEventListener("storage", refreshWorkflowStages);

    return () => {
      window.removeEventListener("workflow-stages:changed", refreshWorkflowStages);
      window.removeEventListener("storage", refreshWorkflowStages);
    };
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest("[data-action-menu='true']")) return;
      setOpenMenuId(null);
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const editingQuickReply = quickReplies.find((reply) => reply.id === editingQuickReplyId) ?? null;
  const deletingQuickReply = quickReplies.find((reply) => reply.id === deletingQuickReplyId) ?? null;
  const visibleWorkflowStages = useMemo(() => filterVisibleWorkflowStages(workflowStages), [workflowStages]);

  return (
    <>
      <div className="space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-white">Quick Replies</h1>
            <p className="mt-1 text-sm text-slate-400">Short reusable messages for faster responses.</p>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setIsCreateQuickReplyModalOpen(true)}
              className="inline-flex h-11 items-center gap-2 rounded-xl bg-[var(--surface-3)] px-5 text-sm font-semibold text-[var(--text-primary)]"
            >
              <Plus className="h-4 w-4" />
              Add Quick Reply
            </button>
          </div>
        </div>

        <section className="grid gap-4 md:grid-cols-2">
          {quickReplies.map((reply) => {
            const linkedStages = visibleWorkflowStages.filter((stage) =>
              (stage.templateButtonActions ?? []).some((action) => action.sendQuickReplyEnabled && action.quickReplyId === reply.id)
            );

            return (
              <article
                key={reply.id}
                role="button"
                tabIndex={0}
                onClick={() => setEditingQuickReplyId(reply.id)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    setEditingQuickReplyId(reply.id);
                  }
                }}
                className="relative cursor-pointer rounded-2xl border border-[#253149] bg-[#121b2b]/65 p-5 shadow-[0_10px_24px_rgba(0,0,0,0.12)] transition-all duration-200 hover:-translate-y-0.5 hover:brightness-105"
              >
                <div className="flex items-start justify-between">
                  <h3 className="text-lg font-semibold text-white">{reply.name}</h3>
                  <button
                    data-action-menu="true"
                    className="rounded-md p-1 text-slate-400 hover:bg-slate-800/70"
                    aria-label={`Open actions for ${reply.name}`}
                    onClick={(event) => {
                      event.stopPropagation();
                      setOpenMenuId((prev) => (prev === reply.id ? null : reply.id));
                    }}
                  >
                    <MoreHorizontal className="h-4 w-4" />
                  </button>
                </div>
                {openMenuId === reply.id ? (
                  <div data-action-menu="true" className="absolute right-6 top-14 z-10 w-32 rounded-xl border border-[#d7dce3] bg-[#f4f6fa] p-1 shadow-xl">
                    <button
                      type="button"
                      className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-200"
                      onClick={(event) => {
                        event.stopPropagation();
                        setEditingQuickReplyId(reply.id);
                        setOpenMenuId(null);
                      }}
                    >
                      <Pencil className="h-4 w-4" />
                      Edit
                    </button>
                    <button
                      type="button"
                      className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-red-500 hover:bg-red-50"
                      onClick={(event) => {
                        event.stopPropagation();
                        setDeletingQuickReplyId(reply.id);
                        setOpenMenuId(null);
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                      Delete
                    </button>
                  </div>
                ) : null}

                <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                  <span className="font-semibold text-slate-300">Workflow stage:</span>
                  {linkedStages.length > 0 ? (
                    linkedStages.map((stage) => (
                      <Link
                        key={stage.id}
                        href={{ pathname: "/settings/advanced", query: { stageId: stage.id } }}
                        onClick={(event) => event.stopPropagation()}
                        style={{
                          color: stage.color,
                          borderColor: stage.color,
                          backgroundColor: `${stage.color}1a`
                        }}
                        className="inline-flex items-center rounded-full border px-2.5 py-1 font-semibold hover:brightness-110"
                      >
                        {stage.name}
                      </Link>
                    ))
                  ) : (
                    <span className="font-medium text-slate-400">None</span>
                  )}
                </div>

                <p className="mt-3 line-clamp-3 text-sm leading-7 text-slate-400">{reply.body}</p>
              </article>
            );
          })}
        </section>
      </div>

      {isCreateQuickReplyModalOpen ? (
        <QuickReplyModal
          mode="create"
          initialValues={{ name: "", body: "" }}
          onClose={() => setIsCreateQuickReplyModalOpen(false)}
          onSubmit={(values) => {
            setQuickReplies((prev) => [{ id: `qr_${Date.now()}`, name: values.name, body: values.body }, ...prev]);
            setIsCreateQuickReplyModalOpen(false);
          }}
        />
      ) : null}

      {editingQuickReply ? (
        <QuickReplyModal
          mode="edit"
          initialValues={{ name: editingQuickReply.name, body: editingQuickReply.body }}
          onClose={() => setEditingQuickReplyId(null)}
          onSubmit={(values) => {
            setQuickReplies((prev) => prev.map((reply) => (reply.id === editingQuickReply.id ? { ...reply, name: values.name, body: values.body } : reply)));
            setEditingQuickReplyId(null);
          }}
        />
      ) : null}

      {deletingQuickReply ? (
        <DeleteQuickReplyModal
          quickReplyName={deletingQuickReply.name}
          onCancel={() => setDeletingQuickReplyId(null)}
          onConfirm={() => {
            setQuickReplies((prev) => prev.filter((reply) => reply.id !== deletingQuickReply.id));
            setDeletingQuickReplyId(null);
          }}
        />
      ) : null}
    </>
  );
}

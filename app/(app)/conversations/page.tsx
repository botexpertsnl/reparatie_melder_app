"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState, type TouchEvent } from "react";
import { createPortal } from "react-dom";
import { useSession } from "next-auth/react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
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
  type StoredConversationMessage,
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
import {
  appendRepairCreatedHistoryEntry,
  applyRepairStageChange,
  type RepairStageChangeOptions
} from "@/lib/repair-stage-change";
import {
  readStoredRepairHistory,
  writeStoredRepairHistory,
  type StoredRepairHistoryItem
} from "@/lib/repair-history-store";
import { useMobileRowSwipe } from "@/lib/use-mobile-row-swipe";
import { readTenantSettings } from "@/lib/tenant-settings-store";
import { getImpersonatingTenant } from "@/lib/impersonation-store";
import {
  getCooldownWindowMs,
  shouldSendBusinessHoursAutoReply,
  type BusinessHoursReplyType
} from "@/lib/business-hours";
import {
  readBusinessHoursCooldownForConversation,
  writeBusinessHoursCooldownForConversation
} from "@/lib/business-hours-cooldown-store";
import { useFixedSizeVirtualList } from "@/lib/use-fixed-size-virtual-list";
import { defaultStoredTemplates, readStoredTemplates, type StoredTemplate } from "@/lib/template-store";
import { buildTemplateMessageWithButtons, fillTemplateBody } from "@/lib/repair-stage-transition";

type LinkModalState = { open: boolean; threadId: string | null };
type TouchGesture = { x: number; y: number };
type NewRepairFormValues = {
  customerFirstName: string;
  customerLastName: string;
  customerPhone: string;
  assetName: string;
  repairTitle: string;
  description: string;
  repairStage: StoredRepair["stage"];
};
const fallbackQuickReplies = [
  "Thanks for your message! We will check this right away.",
  "Can you share your serial number?",
  "Your repair is ready for pickup. Please visit us during opening hours."
];
const TEMPLATE_BUTTONS_MARKER = "\n\nButtons:\n";
const MESSAGE_PREVIEW_MAX_LENGTH = 46;
const FIRST_NAME_MAX_LENGTH = 25;
const LAST_NAME_MAX_LENGTH = 25;
const REPAIR_TITLE_MAX_LENGTH = 50;
const ASSET_NAME_MAX_LENGTH = 50;
const ISO_LIKE_TIMESTAMP_REGEX = /^\d{4}-\d{2}-\d{2}T/;

function normalizePhoneInput(value: string) {
  const trimmed = value.trim();
  const normalizedSeparators = trimmed.replace(/[\s\-().]/g, "");
  if (normalizedSeparators.startsWith("00")) return `+${normalizedSeparators.slice(2)}`;
  return normalizedSeparators;
}

function toNationalNumber(normalizedPhone: string, countryCode: string) {
  if (!normalizedPhone.startsWith(`+${countryCode}`)) return null;
  return `0${normalizedPhone.slice(countryCode.length + 1)}`;
}

function isValidDutchPhone(nationalPhone: string) {
  return /^0\d{9}$/.test(nationalPhone);
}

function isValidBelgianPhone(nationalPhone: string) {
  return /^0\d{8,9}$/.test(nationalPhone);
}

function isValidGermanPhone(nationalPhone: string) {
  return /^0\d{6,14}$/.test(nationalPhone);
}

function isValidUkPhone(nationalPhone: string) {
  return /^0(?:7\d{9}|[123]\d{9,10})$/.test(nationalPhone);
}

function isSupportedCountryPhoneValid(value: string) {
  const normalizedPhone = normalizePhoneInput(value);
  if (!normalizedPhone) return false;
  if (/^\+/.test(normalizedPhone)) {
    const normalizedNl = toNationalNumber(normalizedPhone, "31");
    if (normalizedNl) return isValidDutchPhone(normalizedNl);

    const normalizedBe = toNationalNumber(normalizedPhone, "32");
    if (normalizedBe) return isValidBelgianPhone(normalizedBe);

    const normalizedDe = toNationalNumber(normalizedPhone, "49");
    if (normalizedDe) return isValidGermanPhone(normalizedDe);

    const normalizedUk = toNationalNumber(normalizedPhone, "44");
    if (normalizedUk) return isValidUkPhone(normalizedUk);

    return true;
  }

  if (!/^0\d+$/.test(normalizedPhone)) return true;

  return (
    isValidDutchPhone(normalizedPhone) ||
    isValidBelgianPhone(normalizedPhone) ||
    isValidGermanPhone(normalizedPhone) ||
    isValidUkPhone(normalizedPhone)
  );
}

function truncateMessagePreview(preview?: string | null) {
  const normalizedPreview = preview ?? "";
  if (normalizedPreview.length <= MESSAGE_PREVIEW_MAX_LENGTH) {
    return normalizedPreview;
  }
  return `${normalizedPreview.slice(0, MESSAGE_PREVIEW_MAX_LENGTH)}…`;
}

function resolveInboundReceivedAt(message: StoredConversationMessage) {
  if (ISO_LIKE_TIMESTAMP_REGEX.test(message.at)) {
    const parsed = new Date(message.at);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed;
    }
  }

  const timestampFromId = Number(message.id.replace(/^m_/, "").split("_")[0] ?? Number.NaN);
  if (Number.isFinite(timestampFromId)) {
    const parsedFromId = new Date(timestampFromId);
    if (!Number.isNaN(parsedFromId.getTime())) {
      return parsedFromId;
    }
  }
  return new Date();
}

function getMessageTimestamp(message: StoredConversationMessage | null) {
  if (!message) return null;

  if (ISO_LIKE_TIMESTAMP_REGEX.test(message.at)) {
    const parsed = new Date(message.at);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed;
    }
  }

  const timestampFromId = Number(message.id.replace(/^m_/, "").split("_")[0] ?? Number.NaN);
  if (!Number.isFinite(timestampFromId)) return null;
  const parsedFromId = new Date(timestampFromId);
  if (Number.isNaN(parsedFromId.getTime())) return null;
  return parsedFromId;
}

function getThreadLatestMessageTimestamp(thread: StoredConversation) {
  const lastMessage = thread.messages[thread.messages.length - 1] ?? null;
  return getMessageTimestamp(lastMessage);
}

function formatConversationListUpdatedLabel(thread: StoredConversation, nowTimestamp: number) {
  const latestMessageTimestamp = getThreadLatestMessageTimestamp(thread);
  if (!latestMessageTimestamp) return thread.updatedAt;

  const now = new Date(nowTimestamp);
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterdayStart = new Date(todayStart);
  yesterdayStart.setDate(yesterdayStart.getDate() - 1);

  if (latestMessageTimestamp >= todayStart) {
    return new Intl.DateTimeFormat("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(latestMessageTimestamp);
  }

  if (latestMessageTimestamp >= yesterdayStart) {
    return "yesterday";
  }

  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(latestMessageTimestamp).replaceAll("/", "-");
}

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
    .filter((line) => line.length > 0)
    .map((line) => line.replace(/^[-•*]\s+/, "").replace(/^\d+\.\s+/, "").trim())
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
            className="w-full bg-transparent text-sm mobile-no-zoom outline-none"
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

function AddRepairModal({
  mode = "create",
  initialValues,
  stageOptions,
  repairLabel,
  onClose,
  onSubmit
}: {
  mode?: "create" | "edit";
  initialValues: NewRepairFormValues;
  stageOptions: string[];
  repairLabel: string;
  onClose: () => void;
  onSubmit: (payload: NewRepairFormValues) => void;
}) {
  const [formValues, setFormValues] = useState<NewRepairFormValues>(initialValues);
  const [hasTriedSubmit, setHasTriedSubmit] = useState(false);
  const [isPhoneFieldTouched, setIsPhoneFieldTouched] = useState(false);
  const selectOptions = useMemo(
    () => (stageOptions.includes(formValues.repairStage) ? stageOptions : [...stageOptions, formValues.repairStage]),
    [formValues.repairStage, stageOptions]
  );
  const normalizedPhone = normalizePhoneInput(formValues.customerPhone);
  const isPhoneValid = isSupportedCountryPhoneValid(formValues.customerPhone);
  const showPhoneError = Boolean(normalizedPhone) && !isPhoneValid && (hasTriedSubmit || isPhoneFieldTouched);
  const canSubmit = normalizedPhone && isPhoneValid && formValues.repairTitle.trim();
  const isEditMode = mode === "edit";

  return (
    <ModalShell
      title={isEditMode ? `Edit ${repairLabel}` : `New ${repairLabel}`}
      onClose={onClose}
      maxWidthClassName="max-w-2xl"
      closeLabel="Close repair dialog"
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
            type="submit"
            form="repair-form"
            className={clsx(
              "rounded-xl px-5 py-2 text-sm font-semibold text-white",
              canSubmit ? "bg-[#2fb2a3] hover:bg-[#2a9f91]" : "cursor-not-allowed bg-slate-400"
            )}
            disabled={!canSubmit}
          >
            {isEditMode ? `Save ${repairLabel}` : `Create ${repairLabel}`}
          </button>
        </>
      )}
    >
      <form
        id="repair-form"
        className="space-y-5"
        onSubmit={(event) => {
          event.preventDefault();
          setHasTriedSubmit(true);
          if (!canSubmit) return;
          onSubmit({
            ...formValues,
            customerPhone: formValues.customerPhone.trim()
          });
        }}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="repair-customer-first-name" className="mb-2 block text-sm font-medium text-slate-700">
              First name
            </label>
            <input
              id="repair-customer-first-name"
              maxLength={FIRST_NAME_MAX_LENGTH}
              className="w-full rounded-xl border border-[#bfc9d8] bg-white px-3 py-2 text-sm mobile-no-zoom outline-none ring-0 focus:border-[#30b5a5]"
              placeholder="e.g. John"
              value={formValues.customerFirstName}
              onChange={(event) =>
                setFormValues((prev) => ({
                  ...prev,
                  customerFirstName: event.target.value.slice(0, FIRST_NAME_MAX_LENGTH)
                }))
              }
            />
          </div>
          <div>
            <label htmlFor="repair-customer-last-name" className="mb-2 block text-sm font-medium text-slate-700">
              Last name
            </label>
            <input
              id="repair-customer-last-name"
              maxLength={LAST_NAME_MAX_LENGTH}
              className="w-full rounded-xl border border-[#bfc9d8] bg-white px-3 py-2 text-sm mobile-no-zoom outline-none ring-0 focus:border-[#30b5a5]"
              placeholder="e.g. Doe"
              value={formValues.customerLastName}
              onChange={(event) =>
                setFormValues((prev) => ({
                  ...prev,
                  customerLastName: event.target.value.slice(0, LAST_NAME_MAX_LENGTH)
                }))
              }
            />
          </div>
        </div>
        <div>
          <label htmlFor="repair-customer-phone" className="mb-2 block text-sm font-medium text-slate-700">
            Customer phone *
          </label>
          <input
            id="repair-customer-phone"
            className={clsx(
              "w-full rounded-xl border bg-white px-3 py-2 text-sm mobile-no-zoom outline-none ring-0",
              showPhoneError ? "border-red-400 focus:border-red-500" : "border-[#bfc9d8] focus:border-[#30b5a5]"
            )}
            placeholder="+31 6 12345678"
            value={formValues.customerPhone}
            onChange={(event) => setFormValues((prev) => ({ ...prev, customerPhone: event.target.value }))}
            onBlur={() => setIsPhoneFieldTouched(true)}
            aria-invalid={showPhoneError}
          />
          {showPhoneError ? (
            <p className="mt-1 text-sm text-red-600">Please enter a valid phone number.</p>
          ) : null}
        </div>
        <div>
          <label htmlFor="repair-asset" className="mb-2 block text-sm font-medium text-slate-700">
            Device / asset
          </label>
          <input
            id="repair-asset"
            maxLength={ASSET_NAME_MAX_LENGTH}
            className="w-full rounded-xl border border-[#bfc9d8] bg-white px-3 py-2 text-sm mobile-no-zoom outline-none ring-0 focus:border-[#30b5a5]"
            placeholder="e.g. iPhone 14 Pro"
            value={formValues.assetName}
            onChange={(event) =>
              setFormValues((prev) => ({ ...prev, assetName: event.target.value.slice(0, ASSET_NAME_MAX_LENGTH) }))
            }
          />
        </div>
        <div>
          <label htmlFor="repair-title" className="mb-2 block text-sm font-medium text-slate-700">
            {repairLabel} title *
          </label>
          <input
            id="repair-title"
            maxLength={REPAIR_TITLE_MAX_LENGTH}
            className="w-full rounded-xl border border-[#bfc9d8] bg-white px-3 py-2 text-sm mobile-no-zoom outline-none ring-0 focus:border-[#30b5a5]"
            placeholder="e.g. Screen replacement"
            value={formValues.repairTitle}
            onChange={(event) =>
              setFormValues((prev) => ({ ...prev, repairTitle: event.target.value.slice(0, REPAIR_TITLE_MAX_LENGTH) }))
            }
          />
        </div>
        <div>
          <label htmlFor="repair-description" className="mb-2 block text-sm font-medium text-slate-700">
            Description
          </label>
          <textarea
            id="repair-description"
            className="w-full rounded-xl border border-[#bfc9d8] bg-white px-3 py-2 text-sm mobile-no-zoom outline-none ring-0 focus:border-[#30b5a5]"
            placeholder="Describe the issue and any diagnostics."
            value={formValues.description}
            onChange={(event) => setFormValues((prev) => ({ ...prev, description: event.target.value }))}
          />
        </div>

        <div>
          <label htmlFor="repair-stage" className="mb-2 block text-sm font-medium text-slate-700">
            Stage
          </label>
          <select
            id="repair-stage"
            className="w-full rounded-xl border border-[#bfc9d8] bg-white px-3 py-2 text-sm mobile-no-zoom outline-none ring-0 focus:border-[#30b5a5]"
            value={formValues.repairStage}
            onChange={(event) =>
              setFormValues((prev) => ({ ...prev, repairStage: event.target.value as StoredRepair["stage"] }))
            }
          >
            {selectOptions.map((stageName) => (
              <option key={stageName}>{stageName}</option>
            ))}
          </select>
        </div>
      </form>
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

function TemplateMessageModal({
  templates,
  selectedTemplateId,
  variableValues,
  onClose,
  onSelectTemplate,
  onVariableChange,
  onSend,
}: {
  templates: StoredTemplate[];
  selectedTemplateId: string;
  variableValues: string[];
  onClose: () => void;
  onSelectTemplate: (templateId: string) => void;
  onVariableChange: (index: number, value: string) => void;
  onSend: () => void;
}) {
  const selectedTemplate = templates.find((template) => template.id === selectedTemplateId) ?? null;
  const preview = selectedTemplate ? fillTemplateBody(selectedTemplate, variableValues) : "";
  const hasMissingVariables = selectedTemplate
    ? (selectedTemplate.variables ?? []).some((_, index) => !(variableValues[index] ?? "").trim())
    : true;

  return (
    <ModalShell
      title="Send template message"
      onClose={onClose}
      maxWidthClassName="max-w-2xl"
      closeLabel="Close template message dialog"
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
            onClick={onSend}
            disabled={!selectedTemplate || hasMissingVariables}
            className="rounded-xl bg-[#2fb2a3] px-5 py-2 text-sm font-semibold text-white hover:bg-[#2a9f91] disabled:cursor-not-allowed disabled:bg-[#9fd8d2] disabled:text-white/90"
          >
            Send template
          </button>
        </>
      )}
    >
      <div className="space-y-4">
        <p className="text-sm text-slate-700">
          This conversation is outside Meta&rsquo;s 24-hour reply window. You can only send a template message to restart the conversation.
        </p>

        {templates.length === 0 ? (
          <p className="rounded-xl border border-dashed border-[#cdd5e2] bg-white px-3 py-4 text-sm text-slate-500">
            No templates available.
          </p>
        ) : (
          <>
            <div>
              <label htmlFor="template-message-selector" className="mb-2 block text-sm font-medium text-slate-700">
                Template
              </label>
              <select
                id="template-message-selector"
                className="w-full rounded-xl border border-[#bfc9d8] bg-white px-3 py-2 text-sm mobile-no-zoom outline-none ring-0 focus:border-[#30b5a5]"
                value={selectedTemplateId}
                onChange={(event) => onSelectTemplate(event.target.value)}
              >
                {templates.map((template) => (
                  <option key={template.id} value={template.id}>
                    {template.name}
                  </option>
                ))}
              </select>
            </div>

            {(selectedTemplate?.variables ?? []).length > 0 ? (
              <div className="space-y-3">
                <h3 className="text-base font-semibold text-slate-800">Variables</h3>
                {(selectedTemplate?.variables ?? []).map((variable, index) => (
                  <div key={variable.id} className="space-y-1">
                    <label className="block text-sm font-medium text-slate-700">
                      {variable.name || variable.label || variable.key || `Variable ${index + 1}`}
                    </label>
                    <input
                      type="text"
                      value={variableValues[index] ?? ""}
                      onChange={(event) => onVariableChange(index, event.target.value)}
                      className="w-full rounded-xl border border-[#bfc9d8] bg-white px-3 py-2 text-sm outline-none focus:border-[#30b5a5]"
                    />
                  </div>
                ))}
                {hasMissingVariables ? (
                  <p className="text-sm font-medium text-amber-700">Fill in all variables before sending this template.</p>
                ) : null}
              </div>
            ) : null}

            <div>
              <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Template preview</h3>
              <div className="mt-2 rounded-lg border border-[#d7dce3] bg-[#f8fafc] p-3">
                <div className="text-sm leading-6 text-slate-700">{preview}</div>
                {(selectedTemplate?.buttons ?? []).length > 0 ? (
                  <div className="mt-3 flex flex-wrap gap-2 border-t border-[#d7dce3] pt-3">
                    {selectedTemplate?.buttons?.map((button) => (
                      <span
                        key={button.id}
                        className="inline-flex items-center rounded-full border border-[#b8d8ff] bg-[#eef6ff] px-3 py-1 text-xs font-semibold text-[#285b9b]"
                      >
                        {button.text.trim() || "Button"}
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>
            </div>
          </>
        )}
      </div>
    </ModalShell>
  );
}

function ConversationListRow({
  thread,
  updatedAtLabel,
  isSelected,
  repairs,
  isMobileSwipeEnabled,
  onOpenConversation,
  onToggleConversationOpenState,
}: {
  thread: StoredConversation;
  updatedAtLabel: string;
  isSelected: boolean;
  repairs: StoredRepair[];
  isMobileSwipeEnabled: boolean;
  onOpenConversation: () => void;
  onToggleConversationOpenState: () => void;
}) {
  const { swipeHandlers, swipeStyle } = useMobileRowSwipe({
    enabled: isMobileSwipeEnabled,
    onSwipeOpen: onOpenConversation,
    maxPreviewOffsetRatio: 0.3,
  });

  return (
    <div
      onClick={onOpenConversation}
      onKeyDown={(event) => {
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        onOpenConversation();
      }}
      role="button"
      tabIndex={0}
      className={`relative w-full rounded-xl border p-3 text-left transition-all duration-200 ${
        isSelected
          ? "shadow-[0_0_0_1px_var(--border-strong)]"
          : "hover:bg-white/5"
      }`}
      style={{
        borderColor: isSelected ? "var(--border-strong)" : "var(--border)",
        background: "var(--surface-1)",
        ...swipeStyle,
      }}
      {...swipeHandlers}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="text-base font-semibold leading-tight text-white">
          {thread.customerName || thread.customerPhone}
        </span>
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-slate-500">{updatedAtLabel}</span>
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onToggleConversationOpenState();
            }}
            onMouseDown={(event) => event.stopPropagation()}
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-transparent p-0 text-slate-500 transition hover:bg-white/5 hover:text-slate-400"
            aria-label={`${thread.open ? "Close" : "Reopen"} conversation with ${thread.customerName || thread.customerPhone}`}
            title={thread.open ? "Close conversation" : "Reopen conversation"}
            data-swipe-ignore="true"
          >
            {thread.open ? <X className="h-3 w-3" /> : <RotateCcw className="h-3 w-3" />}
          </button>
        </div>
      </div>
      <p className="mt-1 text-sm text-slate-300 leading-tight">{truncateMessagePreview(thread.preview)}</p>
      <p className="mt-1 text-xs italic text-slate-500 leading-tight">
        {thread.linkedRepairId
          ? `🔗 ${
              repairs.find((r) => r.id === thread.linkedRepairId)?.title ??
              "Repair linked"
            }`
          : "No repair linked"}
      </p>
    </div>
  );
}

function ConversationsPageContent() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const requestedThreadId = searchParams.get("threadId");
  const requestedThreadOpenSource = searchParams.get("open");
  const shouldOpenRequestedThreadOnce = requestedThreadOpenSource === "repair";
  const repairLabel = useTenantRepairLabel();

  const [threads, setThreads] = useState<StoredConversation[]>(() =>
    readStoredConversations(defaultConversations)
  );
  const [repairs, setRepairs] = useState<StoredRepair[]>(() =>
    readStoredRepairs(defaultRepairs)
  );
  const [repairHistory, setRepairHistory] = useState<StoredRepairHistoryItem[]>(() =>
    readStoredRepairHistory()
  );
  const [workflowStages, setWorkflowStages] = useState<StoredWorkflowStage[]>(() =>
    readStoredWorkflowStages(defaultWorkflowStages)
  );
  const [templates, setTemplates] = useState<StoredTemplate[]>(() =>
    readStoredTemplates(defaultStoredTemplates)
  );
  const [selectedThreadId, setSelectedThreadId] = useState<string>("");
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
  const [isTemplateMessageModalOpen, setIsTemplateMessageModalOpen] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [templateVariableValues, setTemplateVariableValues] = useState<string[]>([]);
  const [metaWindowResetByThreadId, setMetaWindowResetByThreadId] = useState<Record<string, number>>({});
  const [nowTimestamp, setNowTimestamp] = useState(() => Date.now());
  const processedInboundIdsRef = useRef<Set<string>>(new Set());
  const hasPrimedInboundMessageIdsRef = useRef(false);
  const [showRepairPanel, setShowRepairPanel] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"open" | "closed">("open");
  const [sortDirection, setSortDirection] = useState<"newest" | "oldest">("newest");
  const [isMobileRepairDrawerOpen, setIsMobileRepairDrawerOpen] = useState(false);
  const [listCollapsed, setListCollapsed] = useState(false);
  const [mobileActivePane, setMobileActivePane] = useState<"list" | "chat">(
    "list"
  );
  const [isMobileViewport, setIsMobileViewport] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia("(max-width: 767px)").matches;
  });
  const [isClientMounted, setIsClientMounted] = useState(false);
  const [linkModal, setLinkModal] = useState<LinkModalState>({
    open: false,
    threadId: null,
  });
  const [createRepairThreadId, setCreateRepairThreadId] = useState<string | null>(null);
  const [editingRepairId, setEditingRepairId] = useState<string | null>(null);
  const [isMessageInputFocused, setIsMessageInputFocused] = useState(false);
  const sessionState = useSession();
  const session = sessionState?.data;
  const activeUsername = session?.user?.name?.trim() || "User";
  const messageWindowRef = useRef<HTMLDivElement | null>(null);
  const threadListParentRef = useRef<HTMLDivElement | null>(null);
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const messageInputRef = useRef<HTMLTextAreaElement | null>(null);
  const touchStartRef = useRef<TouchGesture | null>(null);
  const repairDrawerTouchStartRef = useRef<TouchGesture | null>(null);
  const hasHandledInitialLinkedConversationRef = useRef(false);

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
    const refreshRepairHistory = () => setRepairHistory(readStoredRepairHistory());
    refreshRepairHistory();
    window.addEventListener("repair-history:changed", refreshRepairHistory);
    window.addEventListener("storage", refreshRepairHistory);
    return () => {
      window.removeEventListener("repair-history:changed", refreshRepairHistory);
      window.removeEventListener("storage", refreshRepairHistory);
    };
  }, []);

  useEffect(() => {
    const refreshTemplates = () => setTemplates(readStoredTemplates(defaultStoredTemplates));
    refreshTemplates();
    window.addEventListener("templates:changed", refreshTemplates);
    window.addEventListener("storage", refreshTemplates);
    return () => {
      window.removeEventListener("templates:changed", refreshTemplates);
      window.removeEventListener("storage", refreshTemplates);
    };
  }, []);

  useEffect(() => {
    const intervalId = window.setInterval(() => setNowTimestamp(Date.now()), 60_000);
    return () => window.clearInterval(intervalId);
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
          const nextMessages: StoredConversationMessage[] = thread.messages.map(
            (message): StoredConversationMessage => {
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
            }
          );

          return threadChanged ? { ...thread, messages: nextMessages } : thread;
        })
      );
    };

    flushScheduledTemplates();
    const intervalId = window.setInterval(flushScheduledTemplates, 30_000);
    return () => window.clearInterval(intervalId);
  }, [updateThreads]);

  useEffect(() => {
    const handleConversationNavClick = () => {
      setListCollapsed(false);
      setSelectedThreadId("");
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
    if (hasHandledInitialLinkedConversationRef.current) return;

    if (!requestedThreadId || !shouldOpenRequestedThreadOnce) {
      hasHandledInitialLinkedConversationRef.current = true;
      return;
    }

    const linkedThread = threads.find((thread) => thread.id === requestedThreadId);
    if (!linkedThread) {
      hasHandledInitialLinkedConversationRef.current = true;
      return;
    }

    setSelectedThreadId(linkedThread.id);
    setStatusFilter(linkedThread.open ? "open" : "closed");

    if (isMobileViewport) {
      setMobileActivePane("chat");
      setListCollapsed(false);
      setIsMobileRepairDrawerOpen(false);
    }

    hasHandledInitialLinkedConversationRef.current = true;
    router.replace(pathname, { scroll: false });
  }, [isMobileViewport, pathname, requestedThreadId, router, shouldOpenRequestedThreadOnce, threads]);

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
  const shouldShowCameraButton = !isMessageInputFocused && message.length === 0;

  const linkedRepair = selectedThread
    ? repairs.find((repair) => repair.id === selectedThread.linkedRepairId) ?? null
    : null;
  const activeTemplates = useMemo(
    () => templates.filter((template) => template.active),
    [templates]
  );
  const linkedRepairHistory = useMemo(
    () => (linkedRepair ? repairHistory.filter((item) => item.repairId === linkedRepair.id) : []),
    [linkedRepair, repairHistory]
  );
  const stageOptions = useMemo(() => workflowStages.filter((stage) => !stage.isHidden).map((stage) => stage.name), [workflowStages]);
  const initialStage = useMemo(
    () => workflowStages.find((stage) => stage.isStart && !stage.isHidden)?.name ?? stageOptions[0] ?? "New",
    [stageOptions, workflowStages]
  );
  const createRepairThread = useMemo(
    () => (createRepairThreadId ? threads.find((thread) => thread.id === createRepairThreadId) ?? null : null),
    [createRepairThreadId, threads]
  );
  const editingRepair = useMemo(
    () => (editingRepairId ? repairs.find((repair) => repair.id === editingRepairId) ?? null : null),
    [editingRepairId, repairs]
  );
  const lastCustomerMessage = useMemo(() => {
    if (!selectedThread) return null;
    for (let index = selectedThread.messages.length - 1; index >= 0; index -= 1) {
      const candidate = selectedThread.messages[index];
      if (candidate?.role === "customer") {
        return candidate;
      }
    }
    return null;
  }, [selectedThread]);
  const isOutsideMetaWindow = useMemo(() => {
    const lastIncomingAt = getMessageTimestamp(lastCustomerMessage);
    const lastInboundTimestamp = lastIncomingAt?.getTime() ?? 0;
    const manualResetTimestamp = selectedThread ? metaWindowResetByThreadId[selectedThread.id] ?? 0 : 0;
    const referenceTimestamp = Math.max(lastInboundTimestamp, manualResetTimestamp);
    if (referenceTimestamp <= 0) return false;
    return nowTimestamp - referenceTimestamp > 24 * 60 * 60 * 1000;
  }, [lastCustomerMessage, metaWindowResetByThreadId, nowTimestamp, selectedThread]);
  const createRepairInitialValues = useMemo<NewRepairFormValues>(() => ({
    customerFirstName: "",
    customerLastName: "",
    customerPhone: createRepairThread?.customerPhone ?? "+31 ",
    assetName: "",
    repairTitle: "",
    description: "",
    repairStage: initialStage
  }), [createRepairThread?.customerPhone, initialStage]);

  const visibleThreads = useMemo(() => {
    const getComparableTimestamp = (thread: StoredConversation) => {
      const latestMessageTimestamp = getThreadLatestMessageTimestamp(thread);
      if (latestMessageTimestamp) return latestMessageTimestamp.getTime();

      const updatedAtTimestamp = new Date(thread.updatedAt).getTime();
      if (!Number.isNaN(updatedAtTimestamp)) return updatedAtTimestamp;

      const createdAtTimestamp = thread.createdAt ? new Date(thread.createdAt).getTime() : Number.NaN;
      if (!Number.isNaN(createdAtTimestamp)) return createdAtTimestamp;

      return 0;
    };

    const sortThreads = (left: StoredConversation, right: StoredConversation) => {
      const leftTimestamp = getComparableTimestamp(left);
      const rightTimestamp = getComparableTimestamp(right);

      if (leftTimestamp !== rightTimestamp) {
        return sortDirection === "newest"
          ? rightTimestamp - leftTimestamp
          : leftTimestamp - rightTimestamp;
      }

      return sortDirection === "newest"
        ? right.customerName.localeCompare(left.customerName)
        : left.customerName.localeCompare(right.customerName);
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
  const visibleThreadIndexById = useMemo(
    () => new Map(visibleThreads.map((thread, index) => [thread.id, index])),
    [visibleThreads]
  );
  const {
    totalSize: threadListTotalSize,
    virtualItems: threadVirtualItems,
    scrollToIndex: scrollThreadListToIndex,
  } = useFixedSizeVirtualList({
    count: visibleThreads.length,
    scrollRef: threadListParentRef,
    itemSize: 104,
    overscan: 8,
  });

  useEffect(() => {
    if (!selectedThreadId) return;

    const selectedThreadInAll = threads.find((thread) => thread.id === selectedThreadId);
    const selectedThreadIsHiddenByStatusFilter = Boolean(
      selectedThreadInAll && selectedThreadInAll.open !== (statusFilter === "open")
    );
    if (selectedThreadIsHiddenByStatusFilter) return;
    if (visibleThreads.some((thread) => thread.id === selectedThreadId)) return;
    if (selectedThreadInAll) return;

    setSelectedThreadId("");
  }, [selectedThreadId, statusFilter, threads, visibleThreads]);

  useEffect(() => {
    if (!messageWindowRef.current) return;
    messageWindowRef.current.scrollTop = messageWindowRef.current.scrollHeight;
  }, [selectedThreadId, selectedThread?.messages.length]);

  useEffect(() => {
    if (!selectedThreadId) return;
    const selectedIndex = visibleThreadIndexById.get(selectedThreadId);
    if (selectedIndex === undefined) return;
    scrollThreadListToIndex(selectedIndex);
  }, [scrollThreadListToIndex, selectedThreadId, visibleThreadIndexById]);

  useEffect(() => {
    setIsClientMounted(true);
  }, []);

  useEffect(() => {
    const mobileViewportQuery = window.matchMedia("(max-width: 767px)");
    const handleViewportChange = (event: MediaQueryListEvent) => setIsMobileViewport(event.matches);
    setIsMobileViewport(mobileViewportQuery.matches);
    mobileViewportQuery.addEventListener("change", handleViewportChange);

    return () => {
      mobileViewportQuery.removeEventListener("change", handleViewportChange);
    };
  }, []);

  useEffect(() => {
    const enableSwipeMenu = isMobileViewport && mobileActivePane === "list" && !isMobileRepairDrawerOpen;
    window.dispatchEvent(
      new CustomEvent("mobile-menu:gesture-context", {
        detail: { enabled: enableSwipeMenu }
      })
    );

    return () => {
      window.dispatchEvent(
        new CustomEvent("mobile-menu:gesture-context", {
          detail: { enabled: false }
        })
      );
    };
  }, [isMobileRepairDrawerOpen, isMobileViewport, mobileActivePane]);

  const updateConversationOpenState = useCallback((threadId: string, open: boolean) => {
    updateThreads((prev) =>
      prev.map((thread) => (thread.id === threadId ? { ...thread, open } : thread))
    );
  }, [updateThreads]);

  const reopenConversation = useCallback((threadId: string) => {
    updateConversationOpenState(threadId, true);
    setStatusFilter("open");
    setSelectedThreadId(threadId);
    setMobileActivePane("chat");
    setIsMobileRepairDrawerOpen(false);
  }, [updateConversationOpenState]);

  const sendMessage = ({ closeConversation = false }: { closeConversation?: boolean } = {}) => {
    if (!selectedThread || !message.trim()) return;

    updateThreads((prev) =>
      prev.map((thread) =>
        thread.id === selectedThread.id
          ? {
              ...thread,
              preview: message.trim(),
              updatedAt: "Now",
              open: closeConversation ? false : thread.open,
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

  const openTemplateMessageModal = useCallback(() => {
    const defaultTemplate = activeTemplates[0];
    if (!defaultTemplate) {
      setSelectedTemplateId("");
      setTemplateVariableValues([]);
      setIsTemplateMessageModalOpen(true);
      return;
    }

    setSelectedTemplateId(defaultTemplate.id);
    setTemplateVariableValues(
      (defaultTemplate.variables ?? []).map((variable) =>
        variable.mode === "manual" ? variable.manualValue ?? "" : ""
      )
    );
    setIsTemplateMessageModalOpen(true);
  }, [activeTemplates]);

  const handleTemplateSelectionChange = useCallback((templateId: string) => {
    const template = activeTemplates.find((item) => item.id === templateId);
    setSelectedTemplateId(templateId);
    setTemplateVariableValues(
      (template?.variables ?? []).map((variable) =>
        variable.mode === "manual" ? variable.manualValue ?? "" : ""
      )
    );
  }, [activeTemplates]);

  const handleTemplateVariableChange = useCallback((index: number, value: string) => {
    setTemplateVariableValues((prev) => {
      const nextValues = [...prev];
      nextValues[index] = value;
      return nextValues;
    });
  }, []);

  const sendTemplateMessage = useCallback(() => {
    if (!selectedThread) return;
    const selectedTemplate = activeTemplates.find((item) => item.id === selectedTemplateId);
    if (!selectedTemplate) return;
    const hasMissingVariables = (selectedTemplate.variables ?? []).some(
      (_, index) => !(templateVariableValues[index] ?? "").trim()
    );
    if (hasMissingVariables) return;

    const templatePreview = fillTemplateBody(selectedTemplate, templateVariableValues);
    const composedTemplateMessage = buildTemplateMessageWithButtons(
      templatePreview,
      selectedTemplate.buttons
    );

    updateThreads((prev) =>
      prev.map((thread) =>
        thread.id === selectedThread.id
          ? {
              ...thread,
              preview: templatePreview,
              updatedAt: "Now",
              messages: [
                ...thread.messages,
                {
                  id: `m_${Date.now()}`,
                  role: "agent",
                  text: composedTemplateMessage,
                  at: "Now",
                },
              ],
            }
          : thread
      )
    );

    setIsTemplateMessageModalOpen(false);
    setMetaWindowResetByThreadId((prev) => ({
      ...prev,
      [selectedThread.id]: Date.now(),
    }));
  }, [activeTemplates, selectedTemplateId, selectedThread, templateVariableValues, updateThreads]);

  const handleConversationStatusButtonClick = () => {
    if (!selectedThread) return;
    if (selectedThread.open) {
      updateConversationOpenState(selectedThread.id, false);
      return;
    }

    reopenConversation(selectedThread.id);
  };

  const handleQuickToggleConversation = useCallback((
    threadId: string,
    shouldOpen: boolean,
    options?: { fromListRowCloseButton?: boolean }
  ) => {
    if (shouldOpen) {
      reopenConversation(threadId);
      return;
    }

    const isMobileViewport =
      typeof window !== "undefined" && window.matchMedia("(max-width: 767px)").matches;
    const shouldStayInListViewOnMobile =
      isMobileViewport && options?.fromListRowCloseButton === true;

    updateConversationOpenState(threadId, false);
    if (selectedThreadId === threadId) {
      const willMoveOutOfFilteredList = statusFilter === "open";
      if (willMoveOutOfFilteredList) {
        if (!shouldStayInListViewOnMobile) {
          setSelectedThreadId("");
          setMobileActivePane("chat");
        } else {
          setMobileActivePane("list");
        }
        setIsMobileRepairDrawerOpen(false);
      }
    }
  }, [reopenConversation, selectedThreadId, statusFilter, updateConversationOpenState]);

  const cancelScheduledTemplateMessage = useCallback((threadId: string, messageId: string) => {
    updateThreads((prev) =>
      prev.map((thread) => {
        if (thread.id !== threadId) return thread;

        let didUpdate = false;
        const messages: StoredConversationMessage[] = thread.messages.map(
          (message): StoredConversationMessage => {
            if (message.id !== messageId || !message.scheduledForIso || message.scheduledStatus === "cancelled") {
              return message;
            }

            didUpdate = true;
            return {
              ...message,
              scheduledStatus: "cancelled" as const
            };
          }
        );

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
    setCreateRepairThreadId(threadId);
  };

  const handleCreateRepairFromThread = (payload: NewRepairFormValues) => {
    if (!createRepairThreadId) return;
    const thread = threads.find((item) => item.id === createRepairThreadId);
    if (!thread) return;

    const customerFirstName = payload.customerFirstName.trim();
    const customerLastName = payload.customerLastName.trim();
    const customerName = `${customerFirstName} ${customerLastName}`.trim();
    const resolvedCustomerName = customerName || thread.customerName || payload.customerPhone;
    const newRepair: StoredRepair = {
      id: `repair_${Date.now()}`,
      title: payload.repairTitle,
      description: payload.description,
      customerName: resolvedCustomerName,
      customerFirstName,
      customerLastName,
      customerPhone: payload.customerPhone,
      assetName: payload.assetName,
      stage: payload.repairStage,
      priority: "Medium",
      status: "Open",
    };

    setRepairs((prev) => {
      const updated = [newRepair, ...prev];
      writeStoredRepairs(updated);
      return updated;
    });
    setRepairHistory((prev) => {
      const updated = appendRepairCreatedHistoryEntry({
        historyItems: prev,
        repairId: newRepair.id,
        initialStage: newRepair.stage,
        actor: { type: "user", name: activeUsername }
      });
      writeStoredRepairHistory(updated);
      return updated;
    });

    updateThreads((prev) =>
      prev.map((item) =>
        item.id === createRepairThreadId
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
    setCreateRepairThreadId(null);
  };

  const toFormValues = (repair: StoredRepair): NewRepairFormValues => ({
    customerFirstName: repair.customerFirstName ?? "",
    customerLastName: repair.customerLastName ?? "",
    customerPhone: repair.customerPhone,
    assetName: repair.assetName,
    repairTitle: repair.title,
    description: repair.description,
    repairStage: repair.stage
  });

  const handleEditRepair = (repairId: string, payload: NewRepairFormValues) => {
    const repairBeforeEdit = repairs.find((repair) => repair.id === repairId);
    if (!repairBeforeEdit) return;

    const customerFirstName = payload.customerFirstName.trim();
    const customerLastName = payload.customerLastName.trim();
    const customerName = `${customerFirstName} ${customerLastName}`.trim();
    const resolvedCustomerName = customerName || repairBeforeEdit.customerName || payload.customerPhone;

    const updatedRepairs = repairs.map((repair) =>
      repair.id === repairId
        ? {
            ...repair,
            title: payload.repairTitle,
            description: payload.description,
            customerName: resolvedCustomerName,
            customerFirstName,
            customerLastName,
            customerPhone: payload.customerPhone,
            assetName: payload.assetName,
            stage: payload.repairStage
          }
        : repair
    );
    setRepairs(updatedRepairs);
    writeStoredRepairs(updatedRepairs);

    updateThreads((prev) =>
      prev.map((thread) =>
        thread.linkedRepairId === repairId
          ? {
              ...thread,
              customerName: resolvedCustomerName,
              customerPhone: payload.customerPhone
            }
          : thread
      )
    );
    setEditingRepairId(null);
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
              open: thread.open,
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
      historyItems: repairHistory,
      repairId,
      stageName,
      options
    });
    setRepairs(result.repairs);
    writeStoredRepairs(result.repairs);
    setRepairHistory(result.historyItems);
    writeStoredRepairHistory(result.historyItems);
    updateThreads(() => result.conversations);
  }, [repairHistory, repairs, threads, updateThreads]);

  useEffect(() => {
    if (hasPrimedInboundMessageIdsRef.current) return;
    threads.forEach((thread) => {
      thread.messages.forEach((message) => {
        if (message.role === "customer") {
          processedInboundIdsRef.current.add(message.id);
        }
      });
    });
    hasPrimedInboundMessageIdsRef.current = true;
  }, [threads]);

  useEffect(() => {
    const tenantId = getLocalTenantId();
    const repository = new LocalWorkflowActionRepository(workflowStages);
    const activeTenantName = getImpersonatingTenant() ?? "AutoGarage De Vries";
    const tenantSettings = readTenantSettings(activeTenantName);

    threads.forEach((thread) => {
      const lastMessage = thread.messages[thread.messages.length - 1];
      if (!lastMessage || lastMessage.role !== "customer") return;
      if (processedInboundIdsRef.current.has(lastMessage.id)) return;
      processedInboundIdsRef.current.add(lastMessage.id);

      const cooldownState = readBusinessHoursCooldownForConversation(thread.id, activeTenantName);
      const cooldownWindowMs = getCooldownWindowMs(tenantSettings.businessHours);
      const receivedAt = resolveInboundReceivedAt(lastMessage);
      const autoReplyDecision = shouldSendBusinessHoursAutoReply({
        settings: tenantSettings.businessHours,
        receivedAt,
        isInsideCooldownWindow: (replyType: BusinessHoursReplyType) => {
          const lastSentIso = cooldownState[replyType];
          if (!lastSentIso) return false;
          const elapsedMs = receivedAt.getTime() - new Date(lastSentIso).getTime();
          return elapsedMs < cooldownWindowMs;
        }
      });

      if (autoReplyDecision.shouldSend) {
        updateThreads((prev) =>
          prev.map((candidate) => {
            if (candidate.id !== thread.id) return candidate;

            return {
              ...candidate,
              preview: autoReplyDecision.message,
              updatedAt: "Now",
              messages: [
                ...candidate.messages,
                {
                  id: `m_${Date.now()}_auto`,
                  role: "agent",
                  text: autoReplyDecision.message,
                  at: "Now"
                }
              ]
            };
          })
        );

        writeBusinessHoursCooldownForConversation({
          conversationId: thread.id,
          replyType: autoReplyDecision.replyType,
          sentAtIso: receivedAt.toISOString(),
          tenantName: activeTenantName
        });
      }

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
          updateRepairStage(linkedRepairId, targetStage.name, {
            actor: { type: "workflow" }
          });
        }
      }
    });
  }, [repairs, threads, updateRepairStage, updateThreads, workflowStages]);

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

  return (
    <div
      className={`fixed inset-x-0 bottom-0 top-[69px] overflow-hidden md:static md:-mx-10 md:-my-8 md:h-[calc(100vh-69px)] md:grid md:gap-0 md:transition-[grid-template-columns] md:duration-300 ${
        listCollapsed ? "grid-cols-[88px_1fr]" : "grid-cols-[380px_1fr]"
      }`}
      style={{ background: "var(--bg)" }}
    >
      <aside
        className={`absolute inset-y-0 left-0 right-0 z-20 flex min-h-0 h-full flex-col border-r transform transition-transform duration-300 ease-out md:static md:z-auto md:transform-none md:transition-none ${
          mobileActivePane === "chat"
            ? "pointer-events-none -translate-x-full md:pointer-events-auto"
            : "pointer-events-auto translate-x-0"
        }`}
        style={{
          borderColor: "var(--border)",
          background: "var(--surface-2)",
        }}
      >
        <div
          className={`min-h-0 flex flex-1 flex-col transition-opacity duration-200 ${
            listCollapsed ? "pointer-events-none opacity-0" : "opacity-100"
          }`}
        >
          <div className="p-4">
            <h1 className="text-2xl font-semibold text-white">Conversations</h1>
            <div className="mt-3 flex items-center gap-2.5">
              <label
                className="flex min-h-10 flex-1 items-center gap-2.5 rounded-xl border px-3.5 py-2 text-slate-400"
                style={{
                  borderColor: "var(--border)",
                  background: "var(--surface-1)",
                }}
              >
                <Search className="h-[18px] w-[18px] shrink-0" />
                <input
                  className="w-full bg-transparent text-sm mobile-no-zoom leading-5 outline-none placeholder:text-slate-400"
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
                className="inline-flex h-10 w-10 items-center justify-center rounded-xl border text-slate-300 hover:bg-white/5"
                style={{ borderColor: "var(--border)", background: "var(--surface-1)" }}
                aria-label={
                  sortDirection === "newest"
                    ? "Sort by oldest first"
                    : "Sort by newest first"
                }
              >
                <ArrowUpDown className="h-[18px] w-[18px]" />
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

          <div
            ref={threadListParentRef}
            className="subtle-scrollbar min-h-0 flex-1 overflow-y-auto px-3 pb-3"
            style={{ background: "#000000" }}
          >
            {visibleThreads.length === 0 ? (
              <p className="rounded-xl border border-dashed border-[#2f3c52] px-3 py-4 text-sm text-slate-400">
                No {statusFilter} conversations found.
              </p>
            ) : (
                <div
                  className="relative"
                  style={{ height: `${threadListTotalSize}px` }}
                >
                {threadVirtualItems.map((virtualRow) => {
                  const thread = visibleThreads[virtualRow.index];
                  if (!thread) return null;

                  return (
                    <div
                      key={thread.id}
                      className="absolute left-0 top-0 w-full pb-2"
                      style={{ transform: `translateY(${virtualRow.start}px)` }}
                    >
                      <ConversationListRow
                        thread={thread}
                        updatedAtLabel={formatConversationListUpdatedLabel(thread, nowTimestamp)}
                        isSelected={selectedThreadId === thread.id}
                        repairs={repairs}
                        isMobileSwipeEnabled={isMobileViewport}
                        onOpenConversation={() => {
                          setSelectedThreadId(thread.id);
                          setMobileActivePane("chat");
                          setIsMobileRepairDrawerOpen(false);
                        }}
                        onToggleConversationOpenState={() => {
                          handleQuickToggleConversation(thread.id, !thread.open, {
                            fromListRowCloseButton: thread.open,
                          });
                        }}
                      />
                    </div>
                  );
                })}
              </div>
            )}
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
        className={`absolute inset-y-0 left-0 right-0 z-30 grid min-h-0 h-full min-w-0 overflow-hidden transform transition-transform duration-300 ease-out md:static md:z-auto md:transform-none md:transition-none ${
          mobileActivePane === "list"
            ? "pointer-events-none translate-x-full md:pointer-events-auto"
            : "pointer-events-auto translate-x-0"
        } ${
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
                className="sticky top-0 z-30 flex items-center justify-between border-b px-4 py-3 md:px-5"
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
                  <div className="flex items-center gap-2 md:hidden">
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
                      <div className="flex items-center gap-2">
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
                        <button
                          type="button"
                          onClick={() => createRepairFromThread(selectedThread.id)}
                          className="inline-flex items-center gap-2 rounded-xl border border-[#253149] bg-[#111a2b] px-3 py-2 text-sm font-semibold text-slate-300"
                        >
                          Create {repairLabel}
                        </button>
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={handleConversationStatusButtonClick}
                      className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-[#253149] bg-[#111a2b] text-slate-300 transition-colors hover:bg-[#182236]"
                      aria-label={selectedThread.open ? "Close conversation" : "Reopen conversation"}
                    >
                      {selectedThread.open ? <X className="h-4 w-4" /> : <RotateCcw className="h-4 w-4" />}
                    </button>
                  </div>
                  <div className="hidden items-center gap-2 md:flex">
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
                      <div className="flex items-center gap-2">
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
                        <button
                          type="button"
                          onClick={() => createRepairFromThread(selectedThread.id)}
                          className="inline-flex items-center gap-2 rounded-xl border border-[#253149] bg-[#111a2b] px-3 py-2 text-sm font-semibold text-slate-300"
                        >
                          Create {repairLabel}
                        </button>
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={handleConversationStatusButtonClick}
                      className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-[#253149] bg-[#111a2b] text-slate-300 transition-colors hover:bg-[#182236]"
                      aria-label={selectedThread.open ? "Close conversation" : "Reopen conversation"}
                    >
                      {selectedThread.open ? <X className="h-4 w-4" /> : <RotateCcw className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
              </header>

              <div
                ref={messageWindowRef}
                className="subtle-scrollbar flex-1 space-y-3 overflow-y-auto px-3 pb-4 pt-3 md:p-4"
              >
                {selectedThread.messages.map((msg) => {
                  const parsedMessage = parseTemplateMessageContent(msg.text);
                  const hasTemplateButtons = parsedMessage.buttons.length > 0;
                  const isCancelledScheduledTemplate = msg.scheduledStatus === "cancelled";

                  return (
                    <div
                      key={msg.id}
                      className={`max-w-[72%] min-w-0 rounded-2xl px-4 py-3 text-base ${
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
                      <div className="whitespace-pre-wrap break-words [overflow-wrap:anywhere]">{parsedMessage.body}</div>
                      {hasTemplateButtons ? (
                        <div className="mt-2 flex max-w-full flex-wrap gap-1.5">
                          {parsedMessage.buttons.map((buttonText, buttonIndex) => (
                            <span
                              key={`${msg.id}-template-button-${buttonText}-${buttonIndex}`}
                              className="inline-flex max-w-full rounded-full border border-slate-300/90 bg-slate-200/80 px-2 py-0.5 text-[11px] font-medium leading-5 text-slate-700 break-words [overflow-wrap:anywhere]"
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
                  {isOutsideMetaWindow ? (
                    <button
                      type="button"
                      onClick={openTemplateMessageModal}
                      className="flex h-11 flex-1 items-center rounded-xl border border-[#253149] bg-[#0d1728] px-3 text-left text-sm text-slate-400"
                    >
                      Send template message
                    </button>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => setShowQuickReplyPicker(true)}
                        className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-[#253149] bg-[#111a2b] text-slate-300 hover:bg-[#182236]"
                        aria-label="Select quick reply"
                      >
                        <MessageSquareText className="h-4 w-4" />
                      </button>
                      <textarea
                        ref={messageInputRef}
                        className="input chat-input flex-1 resize-none transition-all"
                        placeholder="Type a message..."
                        value={message}
                        onChange={(event) => {
                          const nextValue = event.target.value;
                          setMessage(nextValue.trim().length === 0 ? "" : nextValue);
                        }}
                        onFocus={() => setIsMessageInputFocused(true)}
                        onBlur={() => setIsMessageInputFocused(false)}
                        rows={1}
                        style={{ minHeight: "44px", maxHeight: "88px" }}
                      />
                      {shouldShowCameraButton ? (
                        <button
                          type="button"
                          onClick={() => imageInputRef.current?.click()}
                          className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-[#253149] bg-[#111a2b] text-slate-300 hover:bg-[#182236]"
                          aria-label="Upload or capture image"
                        >
                          <Camera className="h-4 w-4" />
                        </button>
                      ) : null}
                    </>
                  )}
                  {isOutsideMetaWindow ? null : (
                    <button
                      type="button"
                      onClick={() => sendMessage()}
                      className="inline-flex h-11 w-14 items-center justify-center rounded-xl border border-[#2ae0d0] bg-[#25d3c4] text-[#022a36] shadow-[0_6px_18px_rgba(37,211,196,0.45)] transition-all hover:-translate-y-0.5 hover:bg-[#33decf] hover:shadow-[0_10px_20px_rgba(37,211,196,0.55)]"
                      aria-label="Send message"
                    >
                      <Send className="h-4 w-4" />
                    </button>
                  )}
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
          ) : (
            <div className="flex h-full items-center justify-center p-6">
              <p className="text-sm text-slate-400">
                Select a conversation to view messages.
              </p>
            </div>
          )}
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
              historyItems={linkedRepairHistory}
              itemLabel={repairLabel}
              onClose={() => setShowRepairPanel(false)}
              onEdit={() => setEditingRepairId(linkedRepair.id)}
              onStageChange={(stageName, options) =>
                updateRepairStage(linkedRepair.id, stageName, {
                  ...options,
                  actor: { type: "user", name: activeUsername }
                })
              }
              className="relative h-full min-h-0 pl-6 pr-5 py-5"
            />
          </div>
        ) : null}
      </section>

      {showMobileRepairDrawer && linkedRepair && isClientMounted
        ? createPortal(
            <div
              className={`fixed inset-0 z-[120] bg-[#02050d]/55 transition-opacity duration-300 md:hidden ${
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
                  historyItems={linkedRepairHistory}
                  itemLabel={repairLabel}
                  mobileDrawerHeader
                  onClose={() => setIsMobileRepairDrawerOpen(false)}
                  onEdit={() => setEditingRepairId(linkedRepair.id)}
                  onStageChange={(stageName, options) =>
                    updateRepairStage(linkedRepair.id, stageName, {
                      ...options,
                      actor: { type: "user", name: activeUsername }
                    })
                  }
                  className="h-full min-h-0 max-w-full overflow-hidden px-4 py-4"
                />
              </div>
            </div>,
            document.body
          )
        : null}

      {linkModal.open && linkModal.threadId ? (
        <LinkRepairModal
          repairs={repairs.filter((repair) => repair.status === "Open")}
          repairLabel={repairLabel}
          onClose={() => setLinkModal({ open: false, threadId: null })}
          onSelect={(repairId) => linkRepairToThread(linkModal.threadId!, repairId)}
          onCreate={() => createRepairFromThread(linkModal.threadId!)}
        />
      ) : null}
      {createRepairThread ? (
        <AddRepairModal
          initialValues={createRepairInitialValues}
          stageOptions={stageOptions}
          repairLabel={repairLabel}
          onClose={() => setCreateRepairThreadId(null)}
          onSubmit={handleCreateRepairFromThread}
        />
      ) : null}
      {editingRepair ? (
        <AddRepairModal
          mode="edit"
          initialValues={toFormValues(editingRepair)}
          stageOptions={stageOptions}
          repairLabel={repairLabel}
          onClose={() => setEditingRepairId(null)}
          onSubmit={(values) => handleEditRepair(editingRepair.id, values)}
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
      {isTemplateMessageModalOpen ? (
        <TemplateMessageModal
          templates={activeTemplates}
          selectedTemplateId={selectedTemplateId}
          variableValues={templateVariableValues}
          onClose={() => setIsTemplateMessageModalOpen(false)}
          onSelectTemplate={handleTemplateSelectionChange}
          onVariableChange={handleTemplateVariableChange}
          onSend={sendTemplateMessage}
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

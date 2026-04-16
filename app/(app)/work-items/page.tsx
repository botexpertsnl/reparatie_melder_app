"use client";

import { Suspense, useEffect, useMemo, useRef, useState, type TouchEvent } from "react";
import { useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { ArrowUpDown, Plus, Search, SlidersHorizontal, MoreHorizontal, Pencil, Trash2, X } from "lucide-react";
import clsx from "clsx";
import { ModalShell } from "@/components/ui/modal-shell";
import { defaultRepairs, readStoredRepairs, writeStoredRepairs, type StoredRepair } from "@/lib/repair-store";
import { RepairDetailsPanel } from "@/components/repairs/repair-details-panel";
import {
  defaultWorkflowStages,
  filterVisibleWorkflowStages,
  readStoredWorkflowStages,
  type StoredWorkflowStage
} from "@/lib/workflow-stage-store";
import {
  defaultConversations,
  readStoredConversations,
  writeStoredConversations,
  type StoredConversation
} from "@/lib/conversation-store";
import { pluralizeLabel, useTenantRepairLabel } from "@/lib/use-tenant-terminology";
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
import { defaultStoredTemplates, readStoredTemplates, type StoredTemplate } from "@/lib/template-store";
import {
  buildScheduledSendAtIso,
  buildTemplateMessageWithButtons,
  buildTemplateVariableDefaults,
  fillTemplateBody,
  resolveStageTemplateAutomation,
  stageTransitionHasModalFlow
} from "@/lib/repair-stage-transition";
import { useMobileRowSwipe } from "@/lib/use-mobile-row-swipe";
import { useFixedSizeVirtualList } from "@/lib/use-fixed-size-virtual-list";

type RepairItem = StoredRepair;
const UNKNOWN_STAGE = "Unknown";
const SELECTED_REPAIR_STORAGE_KEY = "statusflow.selected-repair-id";
type MobileRepairSortMode = "latest-change" | "latest-stage-assignment";

type NewRepairFormValues = {
  customerFirstName: string;
  customerLastName: string;
  customerPhone: string;
  assetName: string;
  repairTitle: string;
  description: string;
  repairStage: RepairItem["stage"];
};

const initialFormValues: NewRepairFormValues = {
  customerFirstName: "",
  customerLastName: "",
  customerPhone: "+31 ",
  assetName: "",
  repairTitle: "",
  description: "",
  repairStage: "New"
};

const FIRST_NAME_MAX_LENGTH = 25;
const LAST_NAME_MAX_LENGTH = 25;
const REPAIR_TITLE_MAX_LENGTH = 50;
const ASSET_NAME_MAX_LENGTH = 50;

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

function splitCustomerName(repair: RepairItem) {
  const storedFirstName = repair.customerFirstName?.trim() ?? "";
  const storedLastName = repair.customerLastName?.trim() ?? "";
  if (storedFirstName || storedLastName) {
    return {
      customerFirstName: storedFirstName.slice(0, FIRST_NAME_MAX_LENGTH),
      customerLastName: storedLastName.slice(0, LAST_NAME_MAX_LENGTH)
    };
  }

  const fullName = repair.customerName.trim();
  if (!fullName) {
    return { customerFirstName: "", customerLastName: "" };
  }
  const [firstName, ...lastNameParts] = fullName.split(/\s+/);
  return {
    customerFirstName: (firstName ?? "").slice(0, FIRST_NAME_MAX_LENGTH),
    customerLastName: lastNameParts.join(" ").slice(0, LAST_NAME_MAX_LENGTH)
  };
}

function normalizeStageToken(value: string) {
  return value.trim().toLowerCase().replace(/[\s_-]+/g, "_");
}

function resolveStageFilterFromQuery(
  stageQueryParam: string | null,
  workflowStages: StoredWorkflowStage[],
  filterStages: string[]
) {
  if (!stageQueryParam) return null;
  const normalizedTarget = normalizeStageToken(stageQueryParam);
  const stageByNormalizedName = new Map(
    workflowStages.map((stage) => [normalizeStageToken(stage.name), stage.name])
  );
  const stageByNormalizedKey = new Map(
    workflowStages.map((stage) => [normalizeStageToken(stage.key), stage.name])
  );
  const allFilterStagesByNormalizedName = new Map(
    filterStages.map((stageName) => [normalizeStageToken(stageName), stageName])
  );

  return (
    stageByNormalizedKey.get(normalizedTarget) ??
    stageByNormalizedName.get(normalizedTarget) ??
    allFilterStagesByNormalizedName.get(normalizedTarget) ??
    null
  );
}

function LinkConversationModal({
  conversations,
  linkedConversation,
  onClose,
  onSelect,
  onUnlink
}: {
  conversations: StoredConversation[];
  linkedConversation: StoredConversation | null;
  onClose: () => void;
  onSelect: (threadId: string) => void;
  onUnlink?: () => void;
}) {
  const [query, setQuery] = useState("");
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(linkedConversation?.id ?? null);
  const filtered = conversations.filter((thread) =>
    `${thread.customerName} ${thread.customerPhone} ${thread.preview}`.toLowerCase().includes(query.toLowerCase())
  );

  useEffect(() => {
    setSelectedThreadId(linkedConversation?.id ?? null);
  }, [linkedConversation]);

  return (
    <ModalShell
      title={linkedConversation ? "Change linked conversation" : "Link conversation"}
      onClose={onClose}
      maxWidthClassName="max-w-xl"
      closeLabel="Close link conversation dialog"
      footer={(
        <>
          {linkedConversation && onUnlink ? (
            <button
              type="button"
              onClick={onUnlink}
              className="mr-auto rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-100"
            >
              Unlink
            </button>
          ) : null}
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-[#d0d6e0] bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => selectedThreadId && onSelect(selectedThreadId)}
            className={clsx(
              "rounded-xl px-5 py-2 text-sm font-semibold text-white",
              selectedThreadId ? "bg-[#2fb2a3] hover:bg-[#2a9f91]" : "cursor-not-allowed bg-slate-400"
            )}
            disabled={!selectedThreadId}
          >
            {linkedConversation ? "Save" : "Link"}
          </button>
        </>
      )}
    >
      <div className="space-y-4">
          <label className="flex items-center gap-2 rounded-xl border border-[#bfc9d8] bg-white px-3 py-2">
            <Search className="h-4 w-4 text-slate-500" />
            <input
              className="w-full bg-transparent text-sm outline-none"
              placeholder="Search conversations..."
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>

          <div className="space-y-2">
            {filtered.map((thread) => (
              <button
                key={thread.id}
                type="button"
                onClick={() => setSelectedThreadId(thread.id)}
                className={clsx(
                  "w-full rounded-xl border bg-white p-3 text-left hover:bg-slate-50",
                  selectedThreadId === thread.id
                    ? "border-[#2fb2a3] ring-2 ring-[#2fb2a3]/20"
                    : "border-[#cdd5e2]"
                )}
              >
                <div className="flex items-center justify-between">
                  <div className="font-semibold text-slate-800">{thread.customerName || thread.customerPhone}</div>
                  <span className="rounded-full bg-slate-200 px-2 py-0.5 text-xs text-slate-600">
                    {thread.open ? "Open" : "Closed"}
                  </span>
                </div>
                <div className="mt-1 text-sm text-slate-600">{thread.customerPhone}</div>
                <div className="truncate text-sm text-slate-500">{thread.preview}</div>
              </button>
            ))}
            {filtered.length === 0 ? (
              <div className="rounded-xl border border-dashed border-[#bfc9d8] bg-white px-3 py-4 text-center text-sm text-slate-500">
                No conversations found.
              </div>
            ) : null}
          </div>
      </div>
    </ModalShell>
  );
}

function normalizeRepairStage(stage: string, validStageNames: Set<string>) {
  return validStageNames.has(stage) ? stage : UNKNOWN_STAGE;
}

function matchesRepairSearch(repair: RepairItem, query: string) {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return true;
  return `${repair.title} ${repair.description} ${repair.customerName} ${repair.customerPhone} ${repair.assetName} ${repair.stage}`
    .toLowerCase()
    .includes(normalizedQuery);
}

function toTimestamp(value?: string) {
  if (!value) return 0;
  const timestamp = Date.parse(value);
  return Number.isNaN(timestamp) ? 0 : timestamp;
}

function StageBadge({
  stage,
  stageColor,
  compact = false
}: {
  stage: RepairItem["stage"];
  stageColor?: string;
  compact?: boolean;
}) {
  const badgeSizeClass = compact
    ? "px-1.5 py-0.5 text-[11px] md:px-2 md:text-xs"
    : "px-2 py-0.5 text-xs md:px-3 md:py-1 md:text-sm";

  if (stage === UNKNOWN_STAGE) {
    return (
      <span className={clsx("inline-flex rounded-xl border border-slate-600 bg-slate-700/20 font-semibold text-slate-300", badgeSizeClass)}>
        {stage}
      </span>
    );
  }

  if (!stageColor) {
    return (
      <span className={clsx("inline-flex rounded-xl border border-blue-500/40 bg-blue-500/10 font-semibold text-blue-300", badgeSizeClass)}>
        {stage}
      </span>
    );
  }

  return (
    <span
      className={clsx("inline-flex rounded-xl font-semibold", badgeSizeClass)}
      style={{
        color: stageColor,
        border: `1px solid ${stageColor}66`,
        backgroundColor: `${stageColor}1A`
      }}
    >
      {stage}
    </span>
  );
}

function StageIndicatorDot({
  stage,
  stageColor
}: {
  stage: RepairItem["stage"];
  stageColor?: string;
}) {
  if (stage === UNKNOWN_STAGE) {
    return <span className="inline-flex h-2.5 w-2.5 rounded-full bg-slate-400 shadow-[0_0_0_1px_rgba(15,23,42,0.45)]" aria-hidden="true" />;
  }

  if (!stageColor) {
    return <span className="inline-flex h-2.5 w-2.5 rounded-full bg-blue-400 shadow-[0_0_0_1px_rgba(15,23,42,0.45)]" aria-hidden="true" />;
  }

  return (
    <span
      className="inline-flex h-2.5 w-2.5 rounded-full shadow-[0_0_0_1px_rgba(15,23,42,0.45)]"
      style={{ backgroundColor: stageColor }}
      aria-hidden="true"
    />
  );
}

function RepairListRow({
  repair,
  isSelected,
  stageColorByName,
  isMobileSwipeEnabled,
  openMenuId,
  onOpenRepair,
  onToggleMenu,
  onEditRepair,
  onDeleteRepair,
}: {
  repair: RepairItem;
  isSelected: boolean;
  stageColorByName: Map<string, string>;
  isMobileSwipeEnabled: boolean;
  openMenuId: string | null;
  onOpenRepair: () => void;
  onToggleMenu: () => void;
  onEditRepair: () => void;
  onDeleteRepair: () => void;
}) {
  const { swipeHandlers, swipeStyle } = useMobileRowSwipe({
    enabled: isMobileSwipeEnabled,
    onSwipeOpen: onOpenRepair,
  });

  return (
    <button
      type="button"
      onClick={onOpenRepair}
      className={clsx(
        "relative w-full rounded-xl border p-3 text-left transition-all duration-200",
        isSelected
          ? "shadow-[0_0_0_1px_var(--border-strong)]"
          : "hover:bg-white/5"
      )}
      style={{
        borderColor: isSelected ? "var(--border-strong)" : "var(--border)",
        background: "var(--surface-1)",
        ...swipeStyle,
      }}
      {...swipeHandlers}
    >
      <div className="grid grid-cols-[1rem_minmax(0,1fr)_auto] items-center gap-2.5 sm:grid-cols-[minmax(10.5rem,13rem)_minmax(0,1fr)_minmax(0,11rem)_auto] sm:gap-4">
        <div className="min-w-0">
          <div className="flex w-full items-center">
            <span className="sm:hidden">
              <StageIndicatorDot stage={repair.stage} stageColor={stageColorByName.get(repair.stage)} />
            </span>
            <span className="hidden sm:inline-flex">
              <StageBadge stage={repair.stage} stageColor={stageColorByName.get(repair.stage)} compact />
            </span>
          </div>
        </div>
        <div className="min-w-0">
          <div className="truncate text-base font-semibold leading-tight text-white">{repair.title}</div>
          <div className="mt-1 truncate text-sm text-slate-500">{repair.assetName} · {repair.description}</div>
          <div className="mt-1 min-w-0 overflow-hidden text-ellipsis whitespace-nowrap text-xs font-medium text-white sm:hidden">
            {repair.customerName}
          </div>
        </div>
        <div className="hidden min-w-0 overflow-hidden text-left text-xs font-medium text-white text-ellipsis whitespace-nowrap sm:block sm:text-sm">
          {repair.customerName}
        </div>
        <div className="relative flex items-center" data-action-menu="true">
          <button
            data-action-menu="true"
            data-swipe-ignore="true"
            className="rounded-md p-2 text-slate-400 transition-colors hover:bg-slate-800/70"
            onClick={(event) => {
              event.stopPropagation();
              onToggleMenu();
            }}
          >
            <MoreHorizontal className="h-5 w-5" />
          </button>
          {openMenuId === repair.id ? (
            <div
              data-action-menu="true"
              className="absolute right-0 top-12 z-10 w-32 rounded-xl border border-[#d7dce3] bg-[#f4f6fa] p-1 text-left shadow-xl"
            >
              <button
                type="button"
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-700 hover:bg-slate-200"
                onClick={(event) => {
                  event.stopPropagation();
                  onEditRepair();
                }}
              >
                <Pencil className="h-4 w-4" />
                Edit
              </button>
              <button
                type="button"
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-red-500 hover:bg-red-50"
                onClick={(event) => {
                  event.stopPropagation();
                  onDeleteRepair();
                }}
              >
                <Trash2 className="h-4 w-4" />
                Delete
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </button>
  );
}

function AddRepairModal({
  mode,
  initialValues,
  stageOptions,
  repairLabel,
  onClose,
  onSubmit
}: {
  mode: "create" | "edit";
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
  const canSubmit =
    normalizedPhone &&
    isPhoneValid &&
    formValues.repairTitle.trim();

  return (
    <ModalShell
      title={mode === "create" ? `New ${repairLabel}` : `Edit ${repairLabel}`}
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
            {mode === "create" ? `Create ${repairLabel}` : `Save ${repairLabel}`}
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
                className="w-full rounded-xl border border-[#bfc9d8] bg-white px-3 py-2 text-sm outline-none ring-0 focus:border-[#30b5a5]"
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
                className="w-full rounded-xl border border-[#bfc9d8] bg-white px-3 py-2 text-sm outline-none ring-0 focus:border-[#30b5a5]"
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
                "w-full rounded-xl border bg-white px-3 py-2 text-sm outline-none ring-0",
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
              className="w-full rounded-xl border border-[#bfc9d8] bg-white px-3 py-2 text-sm outline-none ring-0 focus:border-[#30b5a5]"
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
              className="w-full rounded-xl border border-[#bfc9d8] bg-white px-3 py-2 text-sm outline-none ring-0 focus:border-[#30b5a5]"
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
              className="w-full rounded-xl border border-[#bfc9d8] bg-white px-3 py-2 text-sm outline-none ring-0 focus:border-[#30b5a5]"
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
              className="w-full rounded-xl border border-[#bfc9d8] bg-white px-3 py-2 text-sm outline-none ring-0 focus:border-[#30b5a5]"
              value={formValues.repairStage}
              onChange={(event) =>
                setFormValues((prev) => ({ ...prev, repairStage: event.target.value as RepairItem["stage"] }))
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

function WorkItemsPageContent() {
  const repairLabel = useTenantRepairLabel();
  const repairLabelPlural = pluralizeLabel(repairLabel);
  const searchParams = useSearchParams();
  const repairIdParam = searchParams.get("repairId");
  const stageParam = searchParams.get("stage");

  const [workflowStages, setWorkflowStages] = useState<StoredWorkflowStage[]>(() =>
    readStoredWorkflowStages(defaultWorkflowStages)
  );
  const visibleWorkflowStages = useMemo(() => filterVisibleWorkflowStages(workflowStages), [workflowStages]);
  const stageNames = useMemo(() => new Set(workflowStages.map((stage) => stage.name)), [workflowStages]);
  const stageColorByName = useMemo(
    () => new Map(workflowStages.map((stage) => [stage.name, stage.color])),
    [workflowStages]
  );
  const stageOptions = useMemo(() => visibleWorkflowStages.map((stage) => stage.name), [visibleWorkflowStages]);
  const initialStage = useMemo(
    () => visibleWorkflowStages.find((stage) => stage.isStart)?.name ?? visibleWorkflowStages[0]?.name ?? UNKNOWN_STAGE,
    [visibleWorkflowStages]
  );

  const [repairs, setRepairs] = useState<RepairItem[]>(() => {
    const stagesAtLoad = readStoredWorkflowStages(defaultWorkflowStages);
    const stageNamesAtLoad = new Set(stagesAtLoad.map((stage) => stage.name));
    return readStoredRepairs(defaultRepairs).map((repair) => ({
      ...repair,
      stage: normalizeRepairStage(repair.stage, stageNamesAtLoad)
    }));
  });
  const [isAddRepairOpen, setIsAddRepairOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStageFilters, setSelectedStageFilters] = useState<string[]>([]);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [editingRepairId, setEditingRepairId] = useState<string | null>(null);
  const [deletingRepairId, setDeletingRepairId] = useState<string | null>(null);
  const [selectedRepairId, setSelectedRepairId] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    return window.localStorage.getItem(SELECTED_REPAIR_STORAGE_KEY);
  });
  const [conversations, setConversations] = useState<StoredConversation[]>(() =>
    readStoredConversations(defaultConversations)
  );
  const [repairHistory, setRepairHistory] = useState<StoredRepairHistoryItem[]>(() => readStoredRepairHistory());
  const [templates, setTemplates] = useState<StoredTemplate[]>(() => readStoredTemplates(defaultStoredTemplates));
  const [isLinkConversationOpen, setIsLinkConversationOpen] = useState(false);
  const [unlinkConfirmationRepairId, setUnlinkConfirmationRepairId] = useState<string | null>(null);
  const [isMobileRepairDrawerOpen, setIsMobileRepairDrawerOpen] = useState(false);
  const [isMobileViewport, setIsMobileViewport] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia("(max-width: 767px)").matches;
  });
  const [areMobileFiltersOpen, setAreMobileFiltersOpen] = useState(() => {
    if (typeof window === "undefined") return true;
    return !window.matchMedia("(max-width: 767px)").matches;
  });
  const [mobileSortMode, setMobileSortMode] = useState<MobileRepairSortMode | null>(null);
  const [pendingTemplateStageChange, setPendingTemplateStageChange] = useState<{
    repairId: string;
    stage: StoredWorkflowStage;
    template: StoredTemplate;
    variableValues: string[];
  } | null>(null);
  const [pendingStageConfirmation, setPendingStageConfirmation] = useState<{
    repairId: string;
    nextStage: string;
  } | null>(null);
  const repairDrawerTouchStartRef = useRef<{ x: number; y: number } | null>(null);
  const repairsListParentRef = useRef<HTMLDivElement | null>(null);
  const sessionState = useSession();
  const session = sessionState?.data;
  const activeUsername = session?.user?.name?.trim() || "User";

  const editingRepair = repairs.find((repair) => repair.id === editingRepairId) ?? null;
  const deletingRepair = repairs.find((repair) => repair.id === deletingRepairId) ?? null;
  const selectedRepair = useMemo(
    () => repairs.find((repair) => repair.id === selectedRepairId) ?? null,
    [repairs, selectedRepairId]
  );
  const selectedRepairConversation = useMemo(
    () =>
      selectedRepair ? conversations.find((thread) => thread.linkedRepairId === selectedRepair.id) ?? null : null,
    [conversations, selectedRepair]
  );
  const pendingStageSourceRepair = useMemo(
    () =>
      pendingStageConfirmation ? repairs.find((repair) => repair.id === pendingStageConfirmation.repairId) ?? null : null,
    [pendingStageConfirmation, repairs]
  );
  const repairsInFilterScope = useMemo(
    () => repairs.filter((repair) => matchesRepairSearch(repair, searchQuery)),
    [repairs, searchQuery]
  );
  const selectedRepairHistory = useMemo(
    () => (selectedRepair ? repairHistory.filter((item) => item.repairId === selectedRepair.id) : []),
    [repairHistory, selectedRepair]
  );
  const stageCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const repair of repairsInFilterScope) {
      counts.set(repair.stage, (counts.get(repair.stage) ?? 0) + 1);
    }
    return counts;
  }, [repairsInFilterScope]);
  const filterStages = useMemo(() => {
    const stageNamesFromRepairs = Array.from(stageCounts.entries())
      .filter(([, count]) => count > 0)
      .map(([stageName]) => stageName)
      .filter((stageName) => !visibleWorkflowStages.some((stage) => stage.name === stageName));
    const visibleConfiguredStages = visibleWorkflowStages
      .map((stage) => stage.name)
      .filter((stageName) => (stageCounts.get(stageName) ?? 0) > 0);
    return [...visibleConfiguredStages, ...stageNamesFromRepairs];
  }, [stageCounts, visibleWorkflowStages]);

  useEffect(() => {
    writeStoredRepairs(repairs);
  }, [repairs]);

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
    setRepairs((prev) => prev.map((repair) => ({ ...repair, stage: normalizeRepairStage(repair.stage, stageNames) })));
  }, [stageNames]);

  useEffect(() => {
    if (!repairIdParam) return;
    if (selectedRepairId === repairIdParam) return;

    const targetRepairExists = repairs.some((repair) => repair.id === repairIdParam);
    if (!targetRepairExists) return;

    const selectedRepairStillExists = selectedRepairId
      ? repairs.some((repair) => repair.id === selectedRepairId)
      : false;

    if (selectedRepairStillExists) return;

    setSelectedRepairId(repairIdParam);
  }, [repairIdParam, repairs, selectedRepairId]);

  useEffect(() => {
    if (!selectedRepairId) {
      window.localStorage.removeItem(SELECTED_REPAIR_STORAGE_KEY);
      return;
    }

    window.localStorage.setItem(SELECTED_REPAIR_STORAGE_KEY, selectedRepairId);
  }, [selectedRepairId]);

  useEffect(() => {
    if (!selectedRepairId) return;
    const selectedRepairStillExists = repairs.some((repair) => repair.id === selectedRepairId);
    if (!selectedRepairStillExists) {
      setSelectedRepairId(null);
    }
  }, [repairs, selectedRepairId]);

  useEffect(() => {
    const mobileViewportQuery = window.matchMedia("(max-width: 767px)");
    const syncViewportMode = (matchesMobile: boolean) => {
      setIsMobileViewport(matchesMobile);
      if (!matchesMobile) {
        setIsMobileRepairDrawerOpen(false);
        setAreMobileFiltersOpen(true);
      }
    };

    syncViewportMode(mobileViewportQuery.matches);
    const handleViewportChange = (event: MediaQueryListEvent) => syncViewportMode(event.matches);
    mobileViewportQuery.addEventListener("change", handleViewportChange);

    return () => {
      mobileViewportQuery.removeEventListener("change", handleViewportChange);
    };
  }, []);

  useEffect(() => {
    if (!selectedRepair) {
      setIsMobileRepairDrawerOpen(false);
    }
  }, [selectedRepair]);

  useEffect(() => {
    const enableSwipeMenu = isMobileViewport && !isMobileRepairDrawerOpen;
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
  }, [isMobileRepairDrawerOpen, isMobileViewport]);

  useEffect(() => {
    const refreshConversations = () => setConversations(readStoredConversations(defaultConversations));
    refreshConversations();
    window.addEventListener("conversations:changed", refreshConversations);
    window.addEventListener("storage", refreshConversations);
    return () => {
      window.removeEventListener("conversations:changed", refreshConversations);
      window.removeEventListener("storage", refreshConversations);
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
    const handle = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest("[data-action-menu='true']")) return;
      setOpenMenuId(null);
    };
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, []);

  useEffect(() => {
    setSelectedStageFilters((prev) => prev.filter((stageName) => (stageCounts.get(stageName) ?? 0) > 0));
  }, [stageCounts]);

  useEffect(() => {
    if (!stageParam) return;
    const resolvedStageName = resolveStageFilterFromQuery(stageParam, workflowStages, filterStages);
    setSelectedStageFilters(resolvedStageName ? [resolvedStageName] : []);
  }, [filterStages, stageParam, workflowStages]);

  const activeStageFilters = useMemo(
    () =>
      filterStages.filter((stageName) => {
        const normalizedStage = stageName.trim().toLowerCase();
        return normalizedStage !== "completed" && normalizedStage !== "cancelled" && normalizedStage !== "canceled";
      }),
    [filterStages]
  );
  const filteredRepairs = useMemo(() => {
    return repairs.filter((repair) => {
      const matchesSearch = matchesRepairSearch(repair, searchQuery);
      const matchesStageFilter =
        selectedStageFilters.length === 0 || selectedStageFilters.includes(repair.stage);
      return matchesSearch && matchesStageFilter;
    });
  }, [repairs, searchQuery, selectedStageFilters]);
  const latestHistoryTimestampByRepairId = useMemo(() => {
    const map = new Map<string, number>();
    for (const item of repairHistory) {
      const timestamp = toTimestamp(item.atIso);
      const currentLatest = map.get(item.repairId) ?? 0;
      if (timestamp > currentLatest) {
        map.set(item.repairId, timestamp);
      }
    }
    return map;
  }, [repairHistory]);
  const latestAssignedStageTimestampByRepairId = useMemo(() => {
    const map = new Map<string, number>();
    for (const repair of repairs) {
      const latestCurrentStageAssignment = repairHistory.reduce((latest, item) => {
        if (item.repairId !== repair.id) return latest;
        if (item.toStage !== repair.stage) return latest;
        const timestamp = toTimestamp(item.atIso);
        return timestamp > latest ? timestamp : latest;
      }, 0);
      map.set(repair.id, latestCurrentStageAssignment);
    }
    return map;
  }, [repairHistory, repairs]);
  const mobileSortedRepairs = useMemo(() => {
    if (!mobileSortMode) return filteredRepairs;

    return [...filteredRepairs].sort((repairA, repairB) => {
      if (mobileSortMode === "latest-change") {
        const latestChangeA = Math.max(
          toTimestamp(repairA.updatedAt),
          toTimestamp(repairA.createdAt),
          latestHistoryTimestampByRepairId.get(repairA.id) ?? 0
        );
        const latestChangeB = Math.max(
          toTimestamp(repairB.updatedAt),
          toTimestamp(repairB.createdAt),
          latestHistoryTimestampByRepairId.get(repairB.id) ?? 0
        );
        return latestChangeB - latestChangeA;
      }

      const latestStageAssignedA = latestAssignedStageTimestampByRepairId.get(repairA.id) ?? 0;
      const latestStageAssignedB = latestAssignedStageTimestampByRepairId.get(repairB.id) ?? 0;
      return latestStageAssignedB - latestStageAssignedA;
    });
  }, [filteredRepairs, latestAssignedStageTimestampByRepairId, latestHistoryTimestampByRepairId, mobileSortMode]);
  const visibleRepairs = isMobileViewport ? mobileSortedRepairs : filteredRepairs;
  const filteredRepairIndexById = useMemo(
    () => new Map(visibleRepairs.map((repair, index) => [repair.id, index])),
    [visibleRepairs]
  );
  const {
    totalSize: repairsVirtualizerTotalSize,
    virtualItems: repairsVirtualItems,
    scrollToIndex: scrollRepairListToIndex
  } = useFixedSizeVirtualList({
    count: visibleRepairs.length,
    scrollRef: repairsListParentRef,
    itemSize: 96,
    overscan: 8,
  });

  const toggleStageFilter = (stageName: string) => {
    setSelectedStageFilters((prev) =>
      prev.includes(stageName) ? prev.filter((selected) => selected !== stageName) : [...prev, stageName]
    );
  };
  const selectActiveTaskFilters = () => {
    setSelectedStageFilters(activeStageFilters);
  };
  const clearAllStageFilters = () => {
    setSelectedStageFilters([]);
  };

  useEffect(() => {
    if (!selectedRepairId) return;
    const selectedIndex = filteredRepairIndexById.get(selectedRepairId);
    if (selectedIndex === undefined) return;
    scrollRepairListToIndex(selectedIndex);
  }, [filteredRepairIndexById, scrollRepairListToIndex, selectedRepairId]);

  const handleCreateRepair = (payload: NewRepairFormValues) => {
    const customerFirstName = payload.customerFirstName.trim();
    const customerLastName = payload.customerLastName.trim();
    const customerName = `${customerFirstName} ${customerLastName}`.trim();
    const newRepair = {
      id: `repair_${Date.now()}`,
      title: payload.repairTitle,
      description: payload.description,
      customerName,
      customerFirstName,
      customerLastName,
      customerPhone: payload.customerPhone,
      assetName: payload.assetName,
      stage: payload.repairStage,
      priority: "Medium" as const,
      status: "Open" as const
    };
    setRepairs((prev) => [newRepair, ...prev]);
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
    setSelectedRepairId(newRepair.id);
    runStageTransitionFromSave(newRepair.id, newRepair.stage, payload.repairStage, newRepair, true);
    setIsAddRepairOpen(false);
  };

  const handleEditRepair = (repairId: string, payload: NewRepairFormValues) => {
    const repairBeforeEdit = repairs.find((repair) => repair.id === repairId);
    if (!repairBeforeEdit) return;

    const customerFirstName = payload.customerFirstName.trim();
    const customerLastName = payload.customerLastName.trim();
    const customerName = `${customerFirstName} ${customerLastName}`.trim();
    const repairSnapshot: RepairItem = {
      ...repairBeforeEdit,
      title: payload.repairTitle,
      description: payload.description,
      customerName,
      customerFirstName,
      customerLastName,
      customerPhone: payload.customerPhone,
      assetName: payload.assetName
    };

    setRepairs((prev) =>
      prev.map((repair) =>
        repair.id === repairId
          ? {
              ...repairSnapshot,
              stage: repair.stage
            }
          : repair
      )
    );
    runStageTransitionFromSave(repairId, repairBeforeEdit.stage, payload.repairStage, repairSnapshot);
    setEditingRepairId(null);
  };

  const toFormValues = (repair: RepairItem): NewRepairFormValues => ({
    ...splitCustomerName(repair),
    customerPhone: repair.customerPhone,
    assetName: repair.assetName,
    repairTitle: repair.title,
    description: repair.description,
    repairStage: repair.stage
  });

  const availableConversations = useMemo(
    () => conversations.filter((thread) => !thread.linkedRepairId || thread.linkedRepairId === selectedRepairId),
    [conversations, selectedRepairId]
  );
  const unlinkConfirmationRepair = useMemo(
    () =>
      unlinkConfirmationRepairId
        ? repairs.find((repair) => repair.id === unlinkConfirmationRepairId) ?? null
        : null,
    [repairs, unlinkConfirmationRepairId]
  );

  const linkConversationToRepair = (threadId: string, repairId: string) => {
    const updated = conversations.map((thread) => {
      if (thread.id === threadId) return { ...thread, linkedRepairId: repairId };
      if (thread.linkedRepairId === repairId) return { ...thread, linkedRepairId: undefined };
      return thread;
    });
    setConversations(updated);
    writeStoredConversations(updated);
    setIsLinkConversationOpen(false);
  };

  const unlinkConversationFromRepair = (repairId: string) => {
    const updated = conversations.map((thread) =>
      thread.linkedRepairId === repairId ? { ...thread, linkedRepairId: undefined } : thread
    );
    setConversations(updated);
    writeStoredConversations(updated);
    setIsLinkConversationOpen(false);
    setUnlinkConfirmationRepairId(null);
  };

  const updateRepairStage = (repairId: string, stageName: string, options?: RepairStageChangeOptions) => {
    setSelectedRepairId(repairId);
    setRepairs((prevRepairs) => {
      const result = applyRepairStageChange({
        repairs: prevRepairs,
        conversations,
        historyItems: repairHistory,
        repairId,
        stageName,
        options: {
          ...options,
          actor: options?.actor ?? { type: "user", name: activeUsername }
        }
      });
      setConversations(result.conversations);
      writeStoredConversations(result.conversations);
      setRepairHistory(result.historyItems);
      writeStoredRepairHistory(result.historyItems);
      return result.repairs;
    });
  };

  const runStageTransitionFromSave = (
    repairId: string,
    previousStage: string,
    nextStage: string,
    repairSnapshot: RepairItem,
    isNewAssignment = false
  ) => {
    if (!isNewAssignment && previousStage === nextStage) return;

    if (stageTransitionHasModalFlow(nextStage, workflowStages, templates)) {
      const stageTemplateAutomation = resolveStageTemplateAutomation(nextStage, workflowStages, templates);
      if (!stageTemplateAutomation) return;
      setPendingTemplateStageChange({
        repairId,
        stage: stageTemplateAutomation.stage,
        template: stageTemplateAutomation.template,
        variableValues: buildTemplateVariableDefaults(stageTemplateAutomation.template, repairSnapshot)
      });
      return;
    }

    if (isNewAssignment) {
      updateRepairStage(repairId, nextStage);
      return;
    }

    setPendingStageConfirmation({ repairId, nextStage });
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

    if (Math.abs(deltaX) < minHorizontalSwipe || Math.abs(deltaY) > maxVerticalMovement || deltaX < 0) {
      return;
    }

    setIsMobileRepairDrawerOpen(false);
  };

  const handleRepairSelection = (repairId: string) => {
    setSelectedRepairId(repairId);
    if (isMobileViewport) {
      setIsMobileRepairDrawerOpen(true);
    }
  };

  return (
    <>
      <div
        className={`fixed inset-x-0 bottom-0 top-[69px] grid min-h-0 overflow-hidden transition-[grid-template-columns] duration-300 md:static md:-mx-10 md:-my-8 md:h-[calc(100vh-69px)] ${
          selectedRepair ? "grid-cols-[1fr] md:grid-cols-[1fr_380px]" : "grid-cols-[1fr]"
        }`}
        style={{ background: "var(--bg)" }}
      >
        <div className="flex min-h-0 h-full flex-col pb-0 pt-0 md:pb-8 md:pt-0">
          <div className="mb-5 space-y-4 px-4 py-4 md:mb-7 md:px-10 md:py-5">
            <div className="flex items-center justify-between gap-3">
              <h1 className="text-2xl font-semibold text-white">{repairLabelPlural}</h1>
              <div className="flex shrink-0">
                <button
                  onClick={() => setIsAddRepairOpen(true)}
                  className="inline-flex h-10 items-center justify-center gap-2 whitespace-nowrap rounded-xl bg-[var(--surface-3)] px-4 text-sm font-semibold text-[var(--text-primary)] md:h-11 md:gap-3 md:px-5"
                >
                  <Plus className="h-5 w-5" />
                  New {repairLabel}
                </button>
              </div>
            </div>
            <div className="space-y-4">
              <div className="flex items-center gap-2.5 md:block">
                <label
                  className="flex min-h-10 flex-1 items-center gap-2.5 rounded-xl border px-3.5 py-2 text-slate-400 md:h-11 md:max-w-56 md:gap-3 md:px-4 md:py-0 md:text-sm md:text-slate-300"
                  style={{ borderColor: "var(--border)", background: "var(--surface-1)" }}
                >
                  <Search className="h-[18px] w-[18px] shrink-0 text-slate-400 md:h-5 md:w-5 md:text-slate-500" />
                  <input
                    type="search"
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                    className="w-full bg-transparent text-sm leading-5 text-white outline-none placeholder:text-slate-400 md:placeholder:text-slate-500"
                    placeholder={`Search ${repairLabelPlural.toLowerCase()}...`}
                    aria-label={`Search ${repairLabelPlural.toLowerCase()}`}
                  />
                </label>
                <button
                  type="button"
                  onClick={() =>
                    setMobileSortMode((prev) =>
                      prev === "latest-change" ? "latest-stage-assignment" : "latest-change"
                    )
                  }
                  className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border text-slate-300 hover:bg-white/5 md:hidden"
                  style={{ borderColor: "var(--border)", background: "var(--surface-1)" }}
                  aria-label={
                    mobileSortMode === "latest-change"
                      ? "Sort by latest assigned stage"
                      : "Sort by latest change"
                  }
                >
                  <ArrowUpDown className="h-[18px] w-[18px]" />
                </button>
              </div>
              <div className="md:hidden">
                <button
                  type="button"
                  onClick={() => setAreMobileFiltersOpen((prev) => !prev)}
                  className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface-1)] px-3 text-xs font-semibold text-slate-200"
                >
                  <SlidersHorizontal className="h-3.5 w-3.5" />
                  {areMobileFiltersOpen ? "Close filters" : "Open filters"}
                </button>
              </div>
              <div
                className={clsx(
                  "flex items-start gap-2",
                  isMobileViewport && !areMobileFiltersOpen ? "hidden" : "flex"
                )}
              >
                <div className="flex flex-1 flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={selectActiveTaskFilters}
                    className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--surface-1)] px-3 py-1.5 text-xs font-medium text-slate-200 transition-colors hover:text-white"
                  >
                    Active tasks
                  </button>
                  {filterStages.map((stageName) => {
                    const isActive = selectedStageFilters.includes(stageName);
                    return (
                      <button
                        key={stageName}
                        type="button"
                        onClick={() => toggleStageFilter(stageName)}
                        className={clsx(
                          "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                          isActive ? "text-white" : "text-slate-300"
                        )}
                        style={{
                          borderColor: isActive
                            ? (stageColorByName.get(stageName) ?? "var(--text-primary)")
                            : "var(--border)",
                          background: isActive ? `${stageColorByName.get(stageName) ?? "#30b5a5"}24` : "var(--surface-1)"
                        }}
                      >
                        <span>{stageName}</span>
                        <span
                          className={clsx(
                            "rounded-full px-2 py-0.5 text-[11px]",
                            isActive ? "bg-white/20 text-white" : "bg-slate-700/70 text-slate-200"
                          )}
                        >
                          {stageCounts.get(stageName) ?? 0}
                        </span>
                      </button>
                    );
                  })}
                  {selectedStageFilters.length > 0 ? (
                    <button
                      type="button"
                      onClick={clearAllStageFilters}
                      className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-white/5 hover:text-slate-200"
                      aria-label="Clear selected labels"
                      title="Clear selected labels"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  ) : null}
                </div>
              </div>
            </div>
          </div>

          <section className="flex min-h-0 flex-1 flex-col overflow-hidden">
            <div
              ref={repairsListParentRef}
              className={`subtle-scrollbar min-h-0 flex-1 min-w-0 overflow-y-auto overflow-x-hidden border [touch-action:pan-y] [-webkit-overflow-scrolling:touch] ${
                selectedRepair ? "md:border-r-0" : ""
              }`}
              style={{ borderColor: "var(--border)", background: "#000000" }}
            >
              <div className="space-y-1 p-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] md:pb-3">
                {visibleRepairs.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-[#2f3c52] px-3 py-10 text-center text-sm text-slate-400">
                    No {repairLabelPlural.toLowerCase()} found for the current search and filters.
                  </div>
                ) : (
                  <div
                    className="relative"
                    style={{ height: `${repairsVirtualizerTotalSize}px` }}
                  >
                    {repairsVirtualItems.map((virtualRow) => {
                      const repair = visibleRepairs[virtualRow.index];
                      if (!repair) return null;

                      return (
                        <div
                          key={repair.id}
                          className="absolute left-0 top-0 w-full pb-1"
                          style={{ transform: `translateY(${virtualRow.start}px)` }}
                        >
                          <RepairListRow
                            repair={repair}
                            isSelected={selectedRepairId === repair.id}
                            stageColorByName={stageColorByName}
                            isMobileSwipeEnabled={isMobileViewport}
                            openMenuId={openMenuId}
                            onOpenRepair={() => handleRepairSelection(repair.id)}
                            onToggleMenu={() => setOpenMenuId((prev) => (prev === repair.id ? null : repair.id))}
                            onEditRepair={() => {
                              setEditingRepairId(repair.id);
                              setOpenMenuId(null);
                            }}
                            onDeleteRepair={() => {
                              setDeletingRepairId(repair.id);
                              setOpenMenuId(null);
                            }}
                          />
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </section>
        </div>

        {selectedRepair ? (
          <div
            className="relative hidden h-full min-h-0 overflow-hidden border-l md:block"
            style={{ borderColor: "var(--border)", background: "var(--surface-1)" }}
          >
            <RepairDetailsPanel
              repair={selectedRepair}
              historyItems={selectedRepairHistory}
              itemLabel={repairLabel}
              onClose={() => setSelectedRepairId(null)}
              onEdit={() => setEditingRepairId(selectedRepair.id)}
              onStageChange={(stageName, options) => updateRepairStage(selectedRepair.id, stageName, options)}
              onLinkChange={() => setIsLinkConversationOpen(true)}
              onLinkAriaLabel={selectedRepairConversation ? "Change linked conversation" : "Link conversation"}
              isLinkActive={Boolean(selectedRepairConversation)}
              useIconOnlyChangeLinkButton
              linkedConversationHref={
                selectedRepairConversation
                  ? `/conversations?threadId=${selectedRepairConversation.id}&open=repair`
                  : undefined
              }
              className="h-full min-h-0 py-5 pl-6 pr-5"
            />
          </div>
        ) : null}
      </div>

      {selectedRepair ? (
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
            style={{ borderColor: "var(--border)", background: "var(--surface-1)" }}
            onClick={(event) => event.stopPropagation()}
            onTouchStart={handleRepairDrawerTouchStart}
            onTouchEnd={handleRepairDrawerTouchEnd}
          >
            <div className="pointer-events-none absolute inset-y-0 -left-3 flex items-center">
              <span className="h-12 w-1 rounded-full bg-white/30" aria-hidden="true" />
            </div>
            <RepairDetailsPanel
              repair={selectedRepair}
              historyItems={selectedRepairHistory}
              itemLabel={repairLabel}
              mobileDrawerHeader
              onClose={() => setIsMobileRepairDrawerOpen(false)}
              onEdit={() => setEditingRepairId(selectedRepair.id)}
              onStageChange={(stageName, options) => updateRepairStage(selectedRepair.id, stageName, options)}
              onLinkChange={() => setIsLinkConversationOpen(true)}
              onLinkAriaLabel={selectedRepairConversation ? "Change linked conversation" : "Link conversation"}
              isLinkActive={Boolean(selectedRepairConversation)}
              useIconOnlyChangeLinkButton
              linkedConversationHref={
                selectedRepairConversation
                  ? `/conversations?threadId=${selectedRepairConversation.id}&open=repair`
                  : undefined
              }
              className="h-full min-h-0 max-w-full overflow-hidden px-4 py-4"
            />
          </div>
        </div>
      ) : null}

      {isAddRepairOpen ? (
        <AddRepairModal
          mode="create"
          initialValues={{ ...initialFormValues, repairStage: initialStage }}
          stageOptions={stageOptions}
          repairLabel={repairLabel}
          onClose={() => setIsAddRepairOpen(false)}
          onSubmit={handleCreateRepair}
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

      {deletingRepair ? (
        <ModalShell
          title="Delete repair"
          onClose={() => setDeletingRepairId(null)}
          maxWidthClassName="max-w-md"
          closeLabel="Close delete repair dialog"
          footer={(
            <>
              <button
                type="button"
                onClick={() => setDeletingRepairId(null)}
                className="rounded-xl border border-[#d0d6e0] bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  setRepairs((prev) => prev.filter((repair) => repair.id !== deletingRepair.id));
                  if (selectedRepairId === deletingRepair.id) setSelectedRepairId(null);
                  setDeletingRepairId(null);
                }}
                className="rounded-xl bg-red-500 px-5 py-2 text-sm font-semibold text-white hover:bg-red-600"
              >
                Delete
              </button>
            </>
          )}
        >
          <p className="text-sm text-slate-600">
            Are you sure you want to delete <span className="font-semibold">{deletingRepair.title}</span>?
          </p>
        </ModalShell>
      ) : null}

      {isLinkConversationOpen && selectedRepair ? (
        <LinkConversationModal
          conversations={availableConversations}
          linkedConversation={selectedRepairConversation}
          onClose={() => {
            setIsLinkConversationOpen(false);
            setUnlinkConfirmationRepairId(null);
          }}
          onSelect={(threadId) => linkConversationToRepair(threadId, selectedRepair.id)}
          onUnlink={() => setUnlinkConfirmationRepairId(selectedRepair.id)}
        />
      ) : null}

      {unlinkConfirmationRepair ? (
        <ModalShell
          title="Unlink conversation?"
          onClose={() => setUnlinkConfirmationRepairId(null)}
          maxWidthClassName="max-w-md"
          closeLabel="Close unlink confirmation dialog"
          footer={(
            <>
              <button
                type="button"
                onClick={() => setUnlinkConfirmationRepairId(null)}
                className="rounded-xl border border-[#d0d6e0] bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => unlinkConversationFromRepair(unlinkConfirmationRepair.id)}
                className="rounded-xl bg-red-500 px-5 py-2 text-sm font-semibold text-white hover:bg-red-600"
              >
                Unlink
              </button>
            </>
          )}
        >
          <p className="text-sm text-slate-600">
            Are you sure you want to unlink this conversation from the repair?
          </p>
        </ModalShell>
      ) : null}

      {pendingTemplateStageChange ? (
        <ModalShell
          title="Confirm template send"
          onClose={() => setPendingTemplateStageChange(null)}
          maxWidthClassName="max-w-2xl"
          closeLabel="Close template confirmation"
          footer={(
            <>
              <button
                type="button"
                onClick={() => setPendingTemplateStageChange(null)}
                className="rounded-xl border border-[#d0d6e0] bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  updateRepairStage(pendingTemplateStageChange.repairId, pendingTemplateStageChange.stage.name);
                  setPendingTemplateStageChange(null);
                }}
                className="rounded-xl border border-[#d0d6e0] bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
              >
                Not Send
              </button>
              <button
                type="button"
                onClick={() => {
                  const templatePreview = fillTemplateBody(
                    pendingTemplateStageChange.template,
                    pendingTemplateStageChange.variableValues
                  );
                  const hasEmptyVariableValues = (pendingTemplateStageChange.template.variables ?? []).some(
                    (_, index) => !(pendingTemplateStageChange.variableValues[index] ?? "").trim()
                  );
                  if (hasEmptyVariableValues) return;

                  updateRepairStage(pendingTemplateStageChange.repairId, pendingTemplateStageChange.stage.name, {
                    sentTemplateMessage: buildTemplateMessageWithButtons(
                      templatePreview,
                      pendingTemplateStageChange.template.buttons
                    ),
                    scheduledSendAtIso: buildScheduledSendAtIso(pendingTemplateStageChange.stage)
                  });
                  setPendingTemplateStageChange(null);
                }}
                disabled={(pendingTemplateStageChange.template.variables ?? []).some(
                  (_, index) => !(pendingTemplateStageChange.variableValues[index] ?? "").trim()
                )}
                className="rounded-xl bg-[#2fb2a3] px-5 py-2 text-sm font-semibold text-white hover:bg-[#2a9f91] disabled:cursor-not-allowed disabled:bg-[#9fd8d2] disabled:text-white/90"
              >
                Send template
              </button>
            </>
          )}
        >
          <p className="text-sm text-slate-700">
            Moving to <span className="font-semibold">{pendingTemplateStageChange.stage.name}</span> will send template{" "}
            <span className="font-semibold">{pendingTemplateStageChange.template.name}</span>{" "}
            {pendingTemplateStageChange.stage.templateSendDelayEnabled
              ? `after ${pendingTemplateStageChange.stage.templateSendDelayHours ?? 0} hour(s) and ${pendingTemplateStageChange.stage.templateSendDelayMinutes ?? 0} minute(s).`
              : "immediately."}
          </p>

          {(pendingTemplateStageChange.template.variables ?? []).length > 0 ? (
            <div className="mt-4 space-y-3">
              <h3 className="text-base font-semibold text-slate-800">Variables</h3>
              {(pendingTemplateStageChange.template.variables ?? []).map((variable, index) => (
                <div key={variable.id} className="space-y-1">
                  <label className="block text-sm font-medium text-slate-700">
                    {variable.name || variable.label || variable.key || `Variable ${index + 1}`}
                  </label>
                  <input
                    type="text"
                    value={pendingTemplateStageChange.variableValues[index] ?? ""}
                    onChange={(event) =>
                      setPendingTemplateStageChange((prev) => {
                        if (!prev) return prev;
                        const nextValues = [...prev.variableValues];
                        nextValues[index] = event.target.value;
                        return { ...prev, variableValues: nextValues };
                      })
                    }
                    className="w-full rounded-xl border border-[#bfc9d8] bg-white px-3 py-2 text-sm outline-none focus:border-[#30b5a5]"
                  />
                </div>
              ))}
              {(pendingTemplateStageChange.template.variables ?? []).some(
                (_, index) => !(pendingTemplateStageChange.variableValues[index] ?? "").trim()
              ) ? (
                <p className="text-sm font-medium text-amber-700">Fill in all variables before sending this template.</p>
              ) : null}
            </div>
          ) : null}

          <div className="mt-4">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Template preview</h3>
            <div className="mt-2 rounded-lg border border-[#d7dce3] bg-[#f8fafc] p-3">
              <div className="text-sm leading-6 text-slate-700">
                {fillTemplateBody(pendingTemplateStageChange.template, pendingTemplateStageChange.variableValues)}
              </div>
              {(pendingTemplateStageChange.template.buttons ?? []).length > 0 ? (
                <div className="mt-3 flex flex-wrap gap-2 border-t border-[#d7dce3] pt-3">
                  {(pendingTemplateStageChange.template.buttons ?? []).map((button) => {
                    const normalizedType = button.type.toUpperCase();
                    const isQuickReply = normalizedType === "QUICK_REPLY";
                    return (
                      <span
                        key={button.id}
                        className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ${isQuickReply ? "border-[#b8d8ff] bg-[#eef6ff] text-[#285b9b]" : "border-[#b8e8e2] bg-[#ecfbf8] text-[#16786b]"}`}
                      >
                        {button.text.trim() || "Button"}
                      </span>
                    );
                  })}
                </div>
              ) : null}
            </div>
          </div>
        </ModalShell>
      ) : null}

      {pendingStageConfirmation ? (
        <ModalShell
          title="Change workflow stage?"
          onClose={() => setPendingStageConfirmation(null)}
          maxWidthClassName="max-w-lg"
          closeLabel="Close stage change confirmation"
          footer={(
            <>
              <button
                type="button"
                onClick={() => setPendingStageConfirmation(null)}
                className="rounded-xl border border-[#d0d6e0] bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  updateRepairStage(pendingStageConfirmation.repairId, pendingStageConfirmation.nextStage);
                  setPendingStageConfirmation(null);
                }}
                className="rounded-xl bg-[#2fb2a3] px-5 py-2 text-sm font-semibold text-white hover:bg-[#2a9f91]"
              >
                Confirm
              </button>
            </>
          )}
        >
          {pendingStageSourceRepair ? (
            <div className="mb-3 flex items-center gap-2">
              <StageBadge
                stage={pendingStageSourceRepair.stage}
                stageColor={stageColorByName.get(pendingStageSourceRepair.stage)}
              />
              <span className="text-sm text-slate-900">→</span>
              <StageBadge
                stage={pendingStageConfirmation.nextStage}
                stageColor={stageColorByName.get(pendingStageConfirmation.nextStage)}
              />
            </div>
          ) : null}
          <p className="text-sm text-slate-700">
            Are you sure you want to move this repair to another workflow stage?
          </p>
        </ModalShell>
      ) : null}
    </>
  );
}

function WorkItemsPageFallback() {
  return (
    <div
      className="-mx-5 -my-6 flex h-[calc(100dvh-69px)] items-center justify-center md:-mx-10 md:-my-8 md:h-[calc(100vh-69px)]"
      style={{ background: "var(--bg)" }}
    >
      <div className="text-sm text-slate-400">Loading work items...</div>
    </div>
  );
}

export default function WorkItemsPage() {
  return (
    <Suspense fallback={<WorkItemsPageFallback />}>
      <WorkItemsPageContent />
    </Suspense>
  );
}

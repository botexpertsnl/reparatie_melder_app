import { getActiveTenantName } from "@/lib/tenant-settings-store";
import type { BusinessHoursReplyType } from "@/lib/business-hours";

type CooldownEntry = {
  inside?: string;
  outside?: string;
};

type CooldownByConversation = Record<string, CooldownEntry>;
type CooldownByTenant = Record<string, CooldownByConversation>;

const STORAGE_KEY = "statusflow.business-hours-cooldown";

function readAllCooldowns(): CooldownByTenant {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as CooldownByTenant;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writeAllCooldowns(payload: CooldownByTenant) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
}

export function readBusinessHoursCooldownForConversation(conversationId: string, tenantName = getActiveTenantName()) {
  const all = readAllCooldowns();
  return all[tenantName]?.[conversationId] ?? {};
}

export function writeBusinessHoursCooldownForConversation(params: {
  conversationId: string;
  replyType: BusinessHoursReplyType;
  sentAtIso: string;
  tenantName?: string;
}) {
  const tenantName = params.tenantName ?? getActiveTenantName();
  const all = readAllCooldowns();
  const tenantEntries = all[tenantName] ?? {};
  const existingEntry = tenantEntries[params.conversationId] ?? {};

  const updated: CooldownEntry = {
    ...existingEntry,
    [params.replyType]: params.sentAtIso
  };

  writeAllCooldowns({
    ...all,
    [tenantName]: {
      ...tenantEntries,
      [params.conversationId]: updated
    }
  });
}

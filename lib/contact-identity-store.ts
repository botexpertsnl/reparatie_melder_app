import { getActiveTenantName } from "@/lib/tenant-settings-store";
import type { StoredConversation } from "@/lib/conversation-store";
import type { StoredRepair } from "@/lib/repair-store";

export type ContactIdentity = {
  id: string;
  tenantName: string;
  displayName: string;
  phoneNumber: string;
  normalizedPhone: string;
  createdAt: string;
  updatedAt: string;
  lastActivityAt: string;
};

const STORAGE_KEY = "statusflow.contact-identities";

export function normalizeContactPhone(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return "";
  const digits = trimmed.replace(/\D/g, "");
  if (!digits) return "";
  if (trimmed.startsWith("+")) return `+${digits}`;
  if (digits.startsWith("00")) return `+${digits.slice(2)}`;
  if (digits.startsWith("0")) return `+31${digits.slice(1)}`;
  return `+${digits}`;
}

export function readContactIdentities(): ContactIdentity[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "[]") as ContactIdentity[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function writeContactIdentities(items: ContactIdentity[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  window.dispatchEvent(new Event("contact-identities:changed"));
}

export function upsertContactIdentity(params: {
  displayName: string;
  phoneNumber: string;
  activityAt?: string;
  tenantName?: string;
}) {
  const tenantName = params.tenantName ?? getActiveTenantName();
  const normalizedPhone = normalizeContactPhone(params.phoneNumber);
  const now = new Date().toISOString();
  const identities = readContactIdentities();
  const existing = identities.find((item) => item.tenantName === tenantName && item.normalizedPhone === normalizedPhone);
  const identity: ContactIdentity = existing
    ? {
        ...existing,
        displayName: params.displayName.trim() || existing.displayName || params.phoneNumber,
        phoneNumber: params.phoneNumber.trim() || existing.phoneNumber,
        updatedAt: now,
        lastActivityAt: params.activityAt ?? existing.lastActivityAt
      }
    : {
        id: `contact_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        tenantName,
        displayName: params.displayName.trim() || params.phoneNumber,
        phoneNumber: params.phoneNumber.trim(),
        normalizedPhone,
        createdAt: now,
        updatedAt: now,
        lastActivityAt: params.activityAt ?? now
      };
  const updated = existing
    ? identities.map((item) => item.id === existing.id ? identity : item)
    : [...identities, identity];
  writeContactIdentities(updated);
  return identity;
}

export function getContactIdentityById(id?: string) {
  if (!id) return null;
  return readContactIdentities().find((item) => item.id === id) ?? null;
}

export function findContactIdentityByPhone(phoneNumber: string) {
  const normalizedPhone = normalizeContactPhone(phoneNumber);
  const tenantName = getActiveTenantName();
  return readContactIdentities().find((item) => item.tenantName === tenantName && item.normalizedPhone === normalizedPhone) ?? null;
}

export function parseRetentionPeriod(period: string) {
  const match = period.trim().toLowerCase().match(/^(\d+)\s+(week|weeks|month|months)$/);
  if (!match) return 14 * 24 * 60 * 60 * 1000;
  const amount = Number(match[1]);
  const days = match[2].startsWith("month") ? amount * 30 : amount * 7;
  return days * 24 * 60 * 60 * 1000;
}

export function removeExpiredContactIdentities(params: {
  retentionPeriod: string;
  protectedContactIds: Set<string>;
  now?: number;
}) {
  const tenantName = getActiveTenantName();
  const cutoff = (params.now ?? Date.now()) - parseRetentionPeriod(params.retentionPeriod);
  const identities = readContactIdentities();
  const retained = identities.filter((identity) => {
    if (identity.tenantName !== tenantName || params.protectedContactIds.has(identity.id)) return true;
    const lastActivity = new Date(identity.lastActivityAt).getTime();
    return Number.isNaN(lastActivity) || lastActivity >= cutoff;
  });
  if (retained.length !== identities.length) writeContactIdentities(retained);
  return new Set(identities.filter((item) => !retained.some((retainedItem) => retainedItem.id === item.id)).map((item) => item.id));
}

function latestConversationActivity(thread: StoredConversation) {
  const timestamps = [thread.updatedAt, thread.createdAt, ...thread.messages.map((message) => message.at)]
    .filter((value): value is string => Boolean(value))
    .map((value) => new Date(value).getTime())
    .filter((value) => !Number.isNaN(value));
  return timestamps.length > 0 ? new Date(Math.max(...timestamps)).toISOString() : new Date().toISOString();
}

export function migrateContactIdentityLinks(repairs: StoredRepair[], conversations: StoredConversation[]) {
  const tenantName = getActiveTenantName();
  const now = new Date().toISOString();
  const allIdentities = readContactIdentities();
  const tenantIdentities = allIdentities.filter((item) => item.tenantName === tenantName);
  const byPhone = new Map(tenantIdentities.map((item) => [item.normalizedPhone, item]));

  const ensureIdentity = (displayName: string, phoneNumber: string, activityAt: string) => {
    const normalizedPhone = normalizeContactPhone(phoneNumber);
    const existing = byPhone.get(normalizedPhone);
    if (existing) {
      const nextActivity = Math.max(new Date(existing.lastActivityAt).getTime() || 0, new Date(activityAt).getTime() || 0);
      existing.displayName = displayName.trim() || existing.displayName;
      existing.phoneNumber = phoneNumber.trim() || existing.phoneNumber;
      existing.lastActivityAt = new Date(nextActivity || Date.now()).toISOString();
      existing.updatedAt = now;
      return existing;
    }
    const identity: ContactIdentity = {
      id: `contact_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      tenantName,
      displayName: displayName.trim() || phoneNumber,
      phoneNumber: phoneNumber.trim(),
      normalizedPhone,
      createdAt: now,
      updatedAt: now,
      lastActivityAt: activityAt
    };
    byPhone.set(normalizedPhone, identity);
    tenantIdentities.push(identity);
    return identity;
  };

  const migratedConversations = conversations.map((thread) => {
    const identity = ensureIdentity(thread.customerName, thread.customerPhone, latestConversationActivity(thread));
    return {
      ...thread,
      contactIdentityId: identity.id,
      customerName: identity.displayName,
      customerPhone: identity.phoneNumber
    };
  });
  const migratedRepairs = repairs.map((repair) => {
    const identity = ensureIdentity(repair.customerName, repair.customerPhone, repair.updatedAt ?? repair.createdAt ?? now);
    return {
      ...repair,
      contactIdentityId: identity.id,
      customerName: identity.displayName,
      customerPhone: identity.phoneNumber
    };
  });

  writeContactIdentities([
    ...allIdentities.filter((item) => item.tenantName !== tenantName),
    ...tenantIdentities
  ]);
  return { repairs: migratedRepairs, conversations: migratedConversations, contacts: tenantIdentities };
}

import "server-only";
import { zernioFetch } from "@/lib/integrations/zernio/client";

const REQUIRED_EVENTS = [
  "message.received", "message.sent", "message.delivered", "message.read", "message.failed",
  "message.deleted", "conversation.started", "account.connected", "account.disconnected",
  "whatsapp.template.status_updated"
];

type ZernioWebhook = { _id?: string; id?: string; name?: string; url?: string; events?: string[]; isActive?: boolean };

export async function ensureZernioWebhook() {
  const baseUrl = process.env.APP_BASE_URL ?? process.env.NEXTAUTH_URL;
  const secret = process.env.ZERNIO_WEBHOOK_SECRET;
  if (!baseUrl) throw new Error("APP_BASE_URL or NEXTAUTH_URL is not configured");
  if (!secret) throw new Error("ZERNIO_WEBHOOK_SECRET is not configured");
  const url = new URL("/api/webhooks/zernio", baseUrl).toString();

  const listed = await zernioFetch<{ webhooks?: ZernioWebhook[]; data?: ZernioWebhook[] }>("/v1/webhooks/settings");
  const webhooks = listed.webhooks ?? listed.data ?? [];
  const existing = webhooks.find((item) => item.url === url);
  const payload = { name: "Reparatie Melder", url, secret, events: REQUIRED_EVENTS, isActive: true };

  if (existing?._id || existing?.id) {
    return zernioFetch<{ webhook?: ZernioWebhook; data?: ZernioWebhook }>("/v1/webhooks/settings", {
      method: "PUT",
      body: JSON.stringify({ _id: existing._id ?? existing.id, ...payload })
    });
  }
  return zernioFetch<{ webhook?: ZernioWebhook; data?: ZernioWebhook }>("/v1/webhooks/settings", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

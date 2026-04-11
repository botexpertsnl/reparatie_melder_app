import "server-only";
import { zernioFetch } from "@/lib/integrations/zernio/client";

export async function listZernioConversations(whatsappAccountId: string) {
  return zernioFetch<{ conversations: Array<{ id: string }> }>(`/v1/whatsapp/accounts/${whatsappAccountId}/conversations`);
}

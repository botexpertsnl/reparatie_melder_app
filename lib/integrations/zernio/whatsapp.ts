import "server-only";
import { zernioFetch } from "@/lib/integrations/zernio/client";

export async function sendZernioText(params: { whatsappAccountId: string; to: string; body: string }) {
  return zernioFetch<{ id: string }>(`/v1/whatsapp/accounts/${params.whatsappAccountId}/messages`, {
    method: "POST",
    body: JSON.stringify({ to: params.to, type: "text", text: { body: params.body } })
  });
}

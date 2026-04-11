import "server-only";
import { zernioFetch } from "@/lib/integrations/zernio/client";

export async function sendZernioTemplate(params: {
  whatsappAccountId: string;
  to: string;
  templateId: string;
  language: string;
  variables?: string[];
}) {
  return zernioFetch<{ id: string }>(`/v1/whatsapp/accounts/${params.whatsappAccountId}/messages`, {
    method: "POST",
    body: JSON.stringify({
      to: params.to,
      type: "template",
      template: {
        id: params.templateId,
        language: params.language,
        variables: params.variables ?? []
      }
    })
  });
}

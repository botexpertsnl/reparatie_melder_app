import "server-only";
import { zernioFetch } from "@/lib/integrations/zernio/client";

export type ZernioTemplate = {
  id: string;
  name: string;
  category: string;
  language: string;
  status?: string;
  components?: Array<Record<string, unknown>>;
};

type ZernioTemplateListResponse = {
  data?: { templates?: ZernioTemplate[] } | ZernioTemplate[];
  templates?: ZernioTemplate[];
};

export async function listZernioWhatsappTemplates(accountId: string) {
  return zernioFetch<ZernioTemplateListResponse>(
    `/v1/whatsapp/templates?accountId=${encodeURIComponent(accountId)}`
  );
}

export async function createZernioWhatsappTemplate(payload: {
  accountId: string;
  name: string;
  category: string;
  language: string;
  components: Array<Record<string, unknown>>;
}) {
  return zernioFetch<{ data?: ZernioTemplate; template?: ZernioTemplate; id?: string }>("/v1/whatsapp/templates", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

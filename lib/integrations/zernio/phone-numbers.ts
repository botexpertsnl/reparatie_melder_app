import "server-only";
import { zernioFetch } from "@/lib/integrations/zernio/client";

export type ZernioPhoneNumber = {
  id: string;
  displayNumber?: string;
  phoneNumber?: string;
  verified?: boolean;
  accountId?: string;
};

export async function listZernioPhoneNumbers() {
  return zernioFetch<{ data?: ZernioPhoneNumber[] }>("/v1/whatsapp/phone-numbers");
}

export async function verifyZernioPhoneNumber(phoneNumberId: string) {
  return zernioFetch<{ verified: boolean }>(`/v1/whatsapp/phone-numbers/${phoneNumberId}/verify`, {
    method: "POST"
  });
}

import "server-only";
import { zernioFetch } from "@/lib/integrations/zernio/client";

export type ZernioPhoneNumber = {
  id: string;
  displayNumber: string;
  verified: boolean;
};

export async function listZernioPhoneNumbers(accountId: string) {
  return zernioFetch<{ numbers: ZernioPhoneNumber[] }>(`/v1/accounts/${accountId}/phone-numbers`);
}

export async function verifyZernioPhoneNumber(accountId: string, phoneNumberId: string) {
  return zernioFetch<{ verified: boolean }>(`/v1/accounts/${accountId}/phone-numbers/${phoneNumberId}/verify`, {
    method: "POST"
  });
}

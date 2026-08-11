import "server-only";
import { zernioFetch } from "@/lib/integrations/zernio/client";

export type ZernioProfile = {
  _id: string;
  name: string;
  color?: string;
  isDefault?: boolean;
  isOverLimit?: boolean;
};

export async function listZernioProfiles() {
  return zernioFetch<{ profiles?: ZernioProfile[]; data?: { profiles?: ZernioProfile[] } }>(
    "/v1/profiles?includeOverLimit=true"
  );
}

import { NextRequest, NextResponse } from "next/server";
import { requireTenantContext } from "@/lib/multitenancy/tenant-context";
import { uploadZernioMedia } from "@/lib/integrations/zernio/inbox";
import { ZernioError } from "@/lib/integrations/zernio/client";

const MAX_FILE_SIZE = 25 * 1024 * 1024;
const ALLOWED_TYPES = new Set([
  "image/jpeg", "image/png", "video/mp4", "video/3gpp",
  "audio/mpeg", "audio/ogg", "audio/amr", "audio/aac",
  "application/pdf", "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint", "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "text/plain"
]);

export async function POST(request: NextRequest) {
  const ctx = await requireTenantContext();
  if (!ctx.tenantId) return NextResponse.json({ error: "Tenant required" }, { status: 403 });

  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "File is required" }, { status: 400 });
  if (file.size <= 0 || file.size > MAX_FILE_SIZE) return NextResponse.json({ error: "File must be between 1 byte and 25 MB" }, { status: 400 });
  if (!ALLOWED_TYPES.has(file.type)) return NextResponse.json({ error: "This file type is not supported by WhatsApp" }, { status: 415 });

  try {
    const uploaded = await uploadZernioMedia(file);
    return NextResponse.json({ data: uploaded });
  } catch (error) {
    if (error instanceof ZernioError) {
      const missingPublishingScope = error.message.includes("'publishing' resource group disabled");
      return NextResponse.json({
        error: missingPublishingScope
          ? "Images cannot be sent yet: update the Zernio API key in the Zernio dashboard and enable the Publishing permission, then replace ZERNIO_API_KEY in Vercel."
          : error.message
      }, { status: error.status >= 400 && error.status < 500 ? error.status : 502 });
    }
    return NextResponse.json({ error: "Media upload failed" }, { status: 500 });
  }
}

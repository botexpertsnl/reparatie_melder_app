import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const search = request.nextUrl.searchParams;
  const tenantId = search.get("state") ?? search.get("tenantId");
  const accountId = search.get("accountId");
  const profileId = search.get("profileId");
  const whatsappAccountId = search.get("whatsappAccountId") ?? accountId;
  const phoneNumberId = search.get("phoneNumberId");
  const phone = search.get("phone");

  if (!tenantId || !whatsappAccountId) {
    return NextResponse.json({ error: "Missing tenantId or whatsappAccountId" }, { status: 400 });
  }

  await prisma.tenantMessagingChannel.upsert({
    where: { provider_whatsappAccountId: { provider: "ZERNIO", whatsappAccountId } },
    update: {
      tenantId,
      zernioProfileId: profileId,
      zernioAccountId: accountId,
      whatsappAccountId,
      zernioPhoneNumberId: phoneNumberId,
      whatsappPhoneNumber: phone ?? "",
      connectionStatus: "CONNECTED",
      isActive: true
    },
    create: {
      tenantId,
      provider: "ZERNIO",
      displayName: "WhatsApp (ZERNIO)",
      zernioProfileId: profileId,
      zernioAccountId: accountId,
      whatsappAccountId,
      zernioPhoneNumberId: phoneNumberId,
      whatsappPhoneNumber: phone ?? "",
      connectionStatus: "CONNECTED",
      isActive: true
    }
  });

  return NextResponse.redirect(new URL("/settings/advanced?zernio=connected", request.url));
}

import "server-only";

const APP_BASE_URL = process.env.APP_BASE_URL ?? "http://localhost:3000";

export function createZernioConnectUrl(tenantId: string) {
  const callbackUrl = new URL("/api/whatsapp/zernio/callback", APP_BASE_URL);
  callbackUrl.searchParams.set("tenantId", tenantId);

  const connectUrl = new URL("https://console.zernio.com/oauth/whatsapp/connect");
  connectUrl.searchParams.set("redirect_uri", callbackUrl.toString());
  connectUrl.searchParams.set("state", tenantId);
  return connectUrl.toString();
}

import "server-only";

const ZERNIO_BASE_URL = process.env.ZERNIO_BASE_URL ?? "https://zernio.com/api";

export class ZernioError extends Error {
  constructor(message: string, readonly status: number, readonly payload: unknown) {
    super(message);
  }
}

function requireApiKey() {
  const apiKey = process.env.ZERNIO_API_KEY;
  if (!apiKey) throw new Error("ZERNIO_API_KEY is not configured");
  return apiKey;
}

export async function zernioFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const isMultipart = typeof FormData !== "undefined" && init?.body instanceof FormData;
  const response = await fetch(`${ZERNIO_BASE_URL}${path}`, {
    ...init,
    headers: {
      ...(!isMultipart ? { "Content-Type": "application/json" } : {}),
      Authorization: `Bearer ${requireApiKey()}`,
      ...init?.headers
    },
    cache: "no-store"
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const detail = payload && typeof payload === "object" && "error" in payload
      ? String((payload as { error?: unknown }).error ?? "Unknown Zernio error")
      : "Unknown Zernio error";
    throw new ZernioError(`ZERNIO API request failed: ${detail}`, response.status, payload);
  }
  return payload as T;
}

export async function zernioRawFetch(path: string, init?: RequestInit) {
  const response = await fetch(`${ZERNIO_BASE_URL}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${requireApiKey()}`, ...init?.headers },
    cache: "no-store"
  });
  if (!response.ok) throw new ZernioError("ZERNIO media request failed", response.status, null);
  return response;
}

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
  const response = await fetch(`${ZERNIO_BASE_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${requireApiKey()}`,
      ...init?.headers
    },
    cache: "no-store"
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) throw new ZernioError("ZERNIO API request failed", response.status, payload);
  return payload as T;
}

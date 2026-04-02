import "server-only";

const SPOTLER_BASE_URL = process.env.SPOTLER_BASE_URL ?? "https://developers.eazy.im";

export class SpotlerError extends Error {
  constructor(message: string, readonly status: number, readonly payload: unknown) {
    super(message);
  }
}

function requireApiKey() {
  const apiKey = process.env.SPOTLER_API_KEY;
  if (!apiKey) throw new Error("SPOTLER_API_KEY is not configured");
  return apiKey;
}

export async function spotlerFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${SPOTLER_BASE_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${requireApiKey()}`,
      ...init?.headers
    },
    cache: "no-store"
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) throw new SpotlerError("Spotler API request failed", response.status, payload);
  return payload as T;
}

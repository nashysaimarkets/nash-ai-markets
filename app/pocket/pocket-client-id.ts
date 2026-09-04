const CLIENT_ID_KEY = "pocket-ai-client-id-v1";

function createClientId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function getPocketClientId() {
  if (typeof window === "undefined") return "";
  try {
    const existing = window.localStorage.getItem(CLIENT_ID_KEY)?.trim() ?? "";
    if (/^[a-zA-Z0-9_-]{16,128}$/.test(existing)) return existing;
    const created = createClientId();
    window.localStorage.setItem(CLIENT_ID_KEY, created);
    return created;
  } catch {
    return "";
  }
}

export function pocketClientHeaders(): Record<string, string> {
  const clientId = getPocketClientId();
  return clientId ? { "x-pocket-client-id": clientId } : {};
}

export async function pocketClientCacheKey(kind: string, parts: string[]) {
  const bytes = new TextEncoder().encode(`${kind}\n${parts.join("\n---\n")}`);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

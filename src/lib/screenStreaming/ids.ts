const OWNER_KEY_STORAGE = "dex.screenStreaming.ownerKey";

export function createClientId(): string {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export function getOrCreateOwnerKey(): string {
  const existing = localStorage.getItem(OWNER_KEY_STORAGE);
  if (existing) return existing;
  const created = createClientId();
  localStorage.setItem(OWNER_KEY_STORAGE, created);
  return created;
}

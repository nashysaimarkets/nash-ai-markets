import { createHash } from "node:crypto";

// Short, process-local suppression only. This does not restore provider funding.
const blocked = new Map<string, number>();
const keyFor = (key: string) => createHash("sha256").update(key).digest("hex");
export const POCKET_CAPACITY_MESSAGE = "Chart analysis is unavailable because Pocket's AI service needs its credit balance restored. Your charts and saved results are safe. Retrying now will not fix this.";
export function capacityRetrySeconds(key = process.env.OPENAI_API_KEY ?? "", now = Date.now()) {
  const id = keyFor(key);
  const until = blocked.get(id) ?? 0;
  if (until <= now) { blocked.delete(id); return 0; }
  return Math.ceil((until - now) / 1000);
}
export function noteCapacityExhausted(key = process.env.OPENAI_API_KEY ?? "", now = Date.now()) {
  if (blocked.size >= 20) blocked.clear();
  blocked.set(keyFor(key), now + 60_000);
}

import { createHash, createHmac, timingSafeEqual } from "node:crypto";

const VERSION = "precision-receipt-v1";
const TTL = 15 * 60_000;
const MAX = 60_000;

/** Only exact, server-signed screenshot evidence is reusable. No shared image store. */
export function precisionReceiptKey(image: string, model: string, currentPrice: string | null, instructions: string) {
  return createHash("sha256").update(JSON.stringify([VERSION, image, model, currentPrice, instructions])).digest("hex");
}

export function signPrecisionReceipt(key: string, output: string, secret: string | undefined, now = Date.now()): string | null {
  if (!secret || output.length > 30_000) return null;
  const payload = Buffer.from(JSON.stringify({ version: VERSION, key, output, expires: now + TTL })).toString("base64url");
  const signature = createHmac("sha256", secret).update(`${VERSION}:${payload}`).digest("base64url");
  return `${payload}.${signature}`;
}

export function readPrecisionReceipt(receipts: unknown, key: string, secret: string | undefined, now = Date.now()): string | null {
  if (!secret || !Array.isArray(receipts)) return null;
  for (const token of receipts.slice(0, 10)) {
    if (typeof token !== "string" || token.length > MAX) continue;
    try {
      const parts = token.split(".");
      if (parts.length !== 2) continue;
      const expected = createHmac("sha256", secret).update(`${VERSION}:${parts[0]}`).digest();
      const supplied = Buffer.from(parts[1], "base64url");
      if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) continue;
      const record = JSON.parse(Buffer.from(parts[0], "base64url").toString("utf8"));
      if (record.version === VERSION && record.key === key && Number.isFinite(record.expires) && record.expires > now && record.expires <= now + TTL && typeof record.output === "string" && record.output.length <= 30_000) return record.output;
    } catch { /* Invalid or expired evidence requires a fresh read. */ }
  }
  return null;
}

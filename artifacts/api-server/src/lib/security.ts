import { createHmac, timingSafeEqual } from "node:crypto";

export function getRequiredSecret(name: string): string | null {
  const runtime = (globalThis as typeof globalThis & { Netlify?: { env: { get: (key: string) => string | undefined } } }).Netlify;
  const value = (runtime?.env.get(name) ?? process.env[name])?.trim();
  if (value) return value;
  if (name === "SESSION_SECRET") {
    const webhookSecret = runtime?.env.get("TELEGRAM_WEBHOOK_SECRET") ?? process.env.TELEGRAM_WEBHOOK_SECRET;
    if (webhookSecret) return createHmac("sha256", webhookSecret).update("leviafan-admin-session-v1").digest("hex");
  }
  return null;
}

export function secretsMatch(expected: string, actual: string | undefined): boolean {
  if (!actual) return false;

  const expectedBuffer = Buffer.from(expected);
  const actualBuffer = Buffer.from(actual);
  if (expectedBuffer.length !== actualBuffer.length) return false;

  return timingSafeEqual(expectedBuffer, actualBuffer);
}
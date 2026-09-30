import { timingSafeEqual } from "node:crypto";

export function getRequiredSecret(name: string): string | null {
  const value = process.env[name]?.trim();
  return value ? value : null;
}

export function secretsMatch(expected: string, actual: string | undefined): boolean {
  if (!actual) return false;

  const expectedBuffer = Buffer.from(expected);
  const actualBuffer = Buffer.from(actual);
  if (expectedBuffer.length !== actualBuffer.length) return false;

  return timingSafeEqual(expectedBuffer, actualBuffer);
}
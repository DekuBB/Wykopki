import assert from "node:assert/strict";
import test from "node:test";

const baseUrl = process.env.TEST_BASE_URL ?? "http://localhost:80";
const webhookSecret = process.env.TELEGRAM_WEBHOOK_SECRET;

function webhookHeaders(secret?: string): Record<string, string> {
  return {
    "Content-Type": "application/json",
    ...(secret ? { "X-Telegram-Bot-Api-Secret-Token": secret } : {}),
  };
}

test("protected admin API rejects anonymous requests", async () => {
  const response = await fetch(`${baseUrl}/api/users`);
  assert.equal(response.status, 401);
});

test("Telegram webhook rejects requests without the secret", async () => {
  assert.ok(webhookSecret, "TELEGRAM_WEBHOOK_SECRET must be configured for this test");
  const response = await fetch(`${baseUrl}/api/telegram/webhook`, {
    method: "POST",
    headers: webhookHeaders(),
    body: JSON.stringify({ update_id: 900001 }),
  });
  assert.equal(response.status, 401);
});

test("Telegram webhook rejects an invalid secret", async () => {
  assert.ok(webhookSecret, "TELEGRAM_WEBHOOK_SECRET must be configured for this test");
  const response = await fetch(`${baseUrl}/api/telegram/webhook`, {
    method: "POST",
    headers: webhookHeaders("invalid-secret"),
    body: JSON.stringify({ update_id: 900002 }),
  });
  assert.equal(response.status, 401);
});

test("Telegram webhook validates update ids and deduplicates retries", async () => {
  assert.ok(webhookSecret, "TELEGRAM_WEBHOOK_SECRET must be configured for this test");

  const invalidUpdate = await fetch(`${baseUrl}/api/telegram/webhook`, {
    method: "POST",
    headers: webhookHeaders(webhookSecret),
    body: JSON.stringify({}),
  });
  assert.equal(invalidUpdate.status, 400);

  const updateId = Date.now();
  const first = await fetch(`${baseUrl}/api/telegram/webhook`, {
    method: "POST",
    headers: webhookHeaders(webhookSecret),
    body: JSON.stringify({ update_id: updateId }),
  });
  assert.equal(first.status, 200);
  assert.deepEqual(await first.json(), { ok: true });

  const retry = await fetch(`${baseUrl}/api/telegram/webhook`, {
    method: "POST",
    headers: webhookHeaders(webhookSecret),
    body: JSON.stringify({ update_id: updateId }),
  });
  assert.equal(retry.status, 200);
  assert.deepEqual(await retry.json(), { ok: true, duplicate: true });
});
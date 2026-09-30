import { Router, type IRouter } from "express";
import { handleUpdate } from "../lib/botHandler";
import { logger } from "../lib/logger";
import { getRequiredSecret, secretsMatch } from "../lib/security";

const router: IRouter = Router();
const seenUpdates = new Map<number, number>();
const UPDATE_TTL_MS = 10 * 60 * 1000;
const MAX_SEEN_UPDATES = 5_000;

router.post("/telegram/webhook", async (req, res): Promise<void> => {
  const webhookSecret = getRequiredSecret("TELEGRAM_WEBHOOK_SECRET");
  if (!webhookSecret) {
    res.status(503).json({ error: "Telegram webhook is not configured" });
    return;
  }

  if (!secretsMatch(webhookSecret, req.get("X-Telegram-Bot-Api-Secret-Token"))) {
    logger.warn({ ip: req.ip }, "Rejected Telegram webhook request");
    res.status(401).json({ error: "Invalid webhook secret" });
    return;
  }

  const updateId = req.body?.update_id;
  if (!Number.isInteger(updateId) || updateId < 0) {
    res.status(400).json({ error: "Invalid Telegram update" });
    return;
  }

  const now = Date.now();
  for (const [id, seenAt] of seenUpdates) {
    if (now - seenAt > UPDATE_TTL_MS) seenUpdates.delete(id);
  }

  if (seenUpdates.has(updateId)) {
    res.json({ ok: true, duplicate: true });
    return;
  }

  seenUpdates.set(updateId, now);
  if (seenUpdates.size > MAX_SEEN_UPDATES) {
    const oldestId = seenUpdates.keys().next().value;
    if (typeof oldestId === "number") seenUpdates.delete(oldestId);
  }

  try {
    await handleUpdate(req.body);
  } catch (err) {
    seenUpdates.delete(updateId);
    logger.error({ err }, "Error handling Telegram update");
  }
  res.json({ ok: true });
});

export default router;

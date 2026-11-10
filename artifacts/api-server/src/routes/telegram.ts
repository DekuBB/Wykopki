import { Router, type IRouter } from "express";
import { handleUpdate } from "../lib/botHandler";
import { logger } from "../lib/logger";
import { getRequiredSecret, secretsMatch } from "../lib/security";

import { db, telegramUpdatesTable } from "@workspace/db";
import { eq, and, lt } from "drizzle-orm";
const router: IRouter = Router();
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

  const [claim] = await db.insert(telegramUpdatesTable).values({ id: String(updateId) }).onConflictDoUpdate({
    target: telegramUpdatesTable.id,
    set: { createdAt: new Date() },
    where: and(eq(telegramUpdatesTable.completed, false), lt(telegramUpdatesTable.createdAt, new Date(Date.now() - 120000))),
  }).returning();
  if (!claim) {
    const [existing] = await db.select().from(telegramUpdatesTable).where(eq(telegramUpdatesTable.id, String(updateId)));
    if (existing?.completed) { res.json({ ok: true, duplicate: true }); return; }
    res.status(503).json({ error: "Update is being processed" }); return;
  }

  try {
    await handleUpdate(req.body);
  } catch (err) {
    await db.delete(telegramUpdatesTable).where(eq(telegramUpdatesTable.id, String(updateId)));
    logger.error("Error handling Telegram update");
    res.status(500).json({ error: "Update failed" }); return;
  }
  await db.update(telegramUpdatesTable).set({ completed: true }).where(eq(telegramUpdatesTable.id, String(updateId)));
  res.json({ ok: true });
});

export default router;

import { siteUrl } from "../lib/siteUrl";
import { Router, type IRouter } from "express";
import { db, settingsTable } from "@workspace/db";
import {
  GetSettingsResponse,
  UpdateSettingsBody,
  UpdateSettingsResponse,
} from "@workspace/api-zod";
import { setWebhook, getBotToken } from "../lib/telegram";
import { logger } from "../lib/logger";
import { getRequiredSecret } from "../lib/security";

const router: IRouter = Router();

function serializeSettings(s: typeof settingsTable.$inferSelect) {
  return {
    ...s,
    // The bot token is write-only. The panel already treats an empty value as
    // "keep the current token", so there is no reason to send the secret back.
    botToken: null,
    updatedAt: s.updatedAt.toISOString(),
  };
}

async function getOrCreateSettings() {
  const rows = await db.select().from(settingsTable).limit(1);
  if (rows.length > 0) return rows[0];
  const [created] = await db
    .insert(settingsTable)
    .values({
      webhookUrl: `${siteUrl()}/api/telegram/webhook`,
      adminTelegramId: getRequiredSecret("ADMIN_TELEGRAM_ID"),
    })
    .returning();
  return created;
}

router.get("/settings", async (_req, res): Promise<void> => {
  const settings = await getOrCreateSettings();
  res.json(GetSettingsResponse.parse(serializeSettings(settings)));
});

router.put("/settings", async (req, res): Promise<void> => {
  const body = UpdateSettingsBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }

  if (body.data.adminTelegramId && !/^\d+$/.test(body.data.adminTelegramId.trim())) {
    res.status(400).json({ error: "Podaj numeryczny identyfikator konta administratora Telegram." }); return;
  }

  const existing = await getOrCreateSettings();

  const [settings] = await db
    .update(settingsTable)
    .set({
      botToken: body.data.botToken?.trim() ? body.data.botToken.trim() : existing.botToken,
      adminTelegramId: body.data.adminTelegramId !== undefined ? body.data.adminTelegramId : existing.adminTelegramId,
      welcomeMessage: body.data.welcomeMessage !== undefined ? body.data.welcomeMessage : existing.welcomeMessage,
      operatorUsername: body.data.operatorUsername !== undefined ? body.data.operatorUsername : existing.operatorUsername,
      rulesText: body.data.rulesText !== undefined ? body.data.rulesText : existing.rulesText,
      webhookUrl: body.data.webhookUrl !== undefined ? body.data.webhookUrl : existing.webhookUrl,
      orderConfirmationMessage: body.data.orderConfirmationMessage ?? existing.orderConfirmationMessage,
      bonusExchangeRate: body.data.bonusExchangeRate ?? existing.bonusExchangeRate,
      minPurchaseAmount: body.data.minPurchaseAmount ?? existing.minPurchaseAmount,
    })
    .returning();

  res.json(UpdateSettingsResponse.parse(serializeSettings(settings)));
});

// Dedicated endpoint: read webhookUrl from DB and apply it to Telegram
router.post("/settings/apply-webhook", async (req, res): Promise<void> => {
  const settings = await getOrCreateSettings();
  const token = settings.botToken ?? (await getBotToken());
  const webhookSecret = getRequiredSecret("TELEGRAM_WEBHOOK_SECRET");

  if (!token) {
    res.status(400).json({ error: "Bot token not configured" });
    return;
  }

  if (!webhookSecret) {
    res.status(503).json({ error: "Telegram webhook secret is not configured" });
    return;
  }

  if (!settings.webhookUrl) {
    res.status(400).json({ error: "Webhook URL not configured" });
    return;
  }

  // Ensure URL ends with /api/telegram/webhook
  let webhookUrl = settings.webhookUrl.trim();
  if (!webhookUrl.endsWith("/api/telegram/webhook")) {
    if (webhookUrl.endsWith("/")) {
      webhookUrl = webhookUrl + "api/telegram/webhook";
    } else {
      webhookUrl = webhookUrl + "/api/telegram/webhook";
    }
    // Save corrected URL back to DB
    await db.update(settingsTable).set({ webhookUrl }).returning();
  }

  try {
    const result = await setWebhook(token, webhookUrl, webhookSecret) as { ok: boolean; description?: string };
    if (!result.ok) {
      req.log.error({ result }, "Telegram rejected webhook");
      res.status(400).json({ error: result.description ?? "Telegram rejected webhook" });
      return;
    }
    logger.info({ webhookUrl }, "Webhook applied successfully");
    res.json({ ok: true, webhookUrl });
  } catch (err) {
    logger.error({ err }, "Failed to apply webhook");
    res.status(500).json({ error: "Failed to contact Telegram API" });
  }
});

export default router;

import { Router, type IRouter, type Request, type Response } from "express";
import { db, usersTable, settingsTable } from "@workspace/db";
import { sendMessage, getBotToken } from "../lib/telegram";
import { logger } from "../lib/logger";
import { z } from "zod/v4";

const router: IRouter = Router();

const BroadcastBody = z.object({
  message: z.string().min(1).max(4000),
  parseMode: z.enum(["HTML", "Markdown"]).optional().default("HTML"),
});

router.post("/broadcast", async (req: Request, res: Response): Promise<void> => {
  const body = BroadcastBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }

  const settings = await db.select().from(settingsTable).limit(1);
  const token = settings[0]?.botToken ?? await getBotToken();
  if (!token) {
    res.status(400).json({ error: "Bot token not configured" });
    return;
  }

  const users = await db.select({ telegramId: usersTable.telegramId }).from(usersTable);

  let sent = 0;
  let failed = 0;
  for (const u of users) {
    try {
      await sendMessage(token, {
        chat_id: u.telegramId,
        text: body.data.message,
        parse_mode: body.data.parseMode,
      });
      sent++;
      // Rate limit: Telegram allows ~30 msgs/sec to different users
      await new Promise((r) => setTimeout(r, 50));
    } catch {
      failed++;
    }
  }

  logger.info({ sent, failed, total: users.length }, "Broadcast complete");
  res.json({ ok: true, sent, failed, total: users.length });
});

export default router;

import { siteUrl } from "../lib/siteUrl";
import { z } from "zod/v4";
import { Router, type IRouter, type Request, type Response } from "express";
import { desc, eq } from "drizzle-orm";
import { db, ordersTable } from "@workspace/db";
import { ObjectStorageService } from "../lib/objectStorage";
import { getBotToken, sendPhoto, sendLocation, sendMessage } from "../lib/telegram";

function escapeHtml(value: string) { return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }
const router: IRouter = Router();
const objectStorage = new ObjectStorageService();

function serializeOrder(o: typeof ordersTable.$inferSelect) {
  return {
    ...o,
    amountPln: parseFloat(o.amountPln),
    createdAt: o.createdAt.toISOString(),
    updatedAt: o.updatedAt.toISOString(),
    fulfilledAt: o.fulfilledAt ? o.fulfilledAt.toISOString() : null,
  };
}

function parseId(raw: unknown): number | null {
  const n = parseInt(String(raw), 10);
  return isNaN(n) ? null : n;
}

router.get("/orders", async (_req, res: Response): Promise<void> => {
  const orders = await db
    .select()
    .from(ordersTable)
    .orderBy(desc(ordersTable.createdAt));
  res.json(orders.map(serializeOrder));
});

router.get("/orders/:id", async (req: Request, res: Response): Promise<void> => {
  const id = parseId(req.params["id"]);
  if (id === null) { res.status(400).json({ error: "Invalid order id" }); return; }

  const [order] = await db.select().from(ordersTable).where(eq(ordersTable.id, id));
  if (!order) { res.status(404).json({ error: "Order not found" }); return; }
  res.json(serializeOrder(order));
});

router.get("/orders/:id/fulfill-upload-url", async (req: Request, res: Response): Promise<void> => {
  const id = parseId(req.params["id"]);
  if (id === null) { res.status(400).json({ error: "Invalid order id" }); return; }

  const [order] = await db.select().from(ordersTable).where(eq(ordersTable.id, id));
  if (!order) { res.status(404).json({ error: "Order not found" }); return; }

  try {
    const uploadURL = await objectStorage.getObjectEntityUploadURL();
    const objectPath = objectStorage.normalizeObjectEntityPath(uploadURL);
    res.json({ uploadUrl: uploadURL, objectPath });
  } catch (err) {
    req.log.error({ err }, "Failed to get upload URL");
    res.status(500).json({ error: "Storage error" });
  }
});

router.post("/orders/:id/fulfill", async (req: Request, res: Response): Promise<void> => {
  const id = parseId(req.params["id"]);
  if (id === null) { res.status(400).json({ error: "Invalid order id" }); return; }

  const [order] = await db.select().from(ordersTable).where(eq(ordersTable.id, id));
  if (!order) { res.status(404).json({ error: "Order not found" }); return; }
  if (order.status === "fulfilled") {
    res.status(400).json({ error: "Order already fulfilled" });
    return;
  }

  const { fulfillmentPhotoPath, fulfillmentGps, fulfillmentNote } = req.body as {
    fulfillmentPhotoPath?: string;
    fulfillmentGps?: string;
    fulfillmentNote?: string;
  };

  if (fulfillmentGps) {
    try {
      z.object({ lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180) }).parse(JSON.parse(fulfillmentGps));
    } catch { res.status(400).json({ error: "Podaj prawidłowe współrzędne GPS" }); return; }
  }
  if (fulfillmentPhotoPath) {
    try { await objectStorage.downloadObject(await objectStorage.getObjectEntityFile(fulfillmentPhotoPath)); }
    catch { res.status(400).json({ error: "Prześlij zdjęcie ponownie" }); return; }
  }

  // Notify customer via Telegram
  try {
    const token = await getBotToken();
    if (!token) { res.status(503).json({ error: "Bot nie jest skonfigurowany" }); return; }
    {
      const chatId = order.telegramId;

      const caption =
        `Twoje zamowienie #${order.id} zostalo zrealizowane!\n\n` +
        `Produkt: <b>${escapeHtml(order.productName)}</b>\n` +
        `Dzielnica: <b>${escapeHtml(order.districtName)}</b>` +
        (fulfillmentNote ? `\n\n<i>${escapeHtml(fulfillmentNote)}</i>` : "");

      await sendMessage(token, { chat_id: chatId, text: caption, parse_mode: "HTML" });

      if (fulfillmentGps) {
        try {
          const { lat, lng } = JSON.parse(fulfillmentGps) as { lat: number; lng: number };
          await sendLocation(token, { chat_id: chatId, latitude: lat, longitude: lng });
        } catch { /* ignore GPS parse errors */ }
      }

      if (fulfillmentPhotoPath) {
        const baseUrl = siteUrl();
        const photoUrl = `${baseUrl}/api/storage${fulfillmentPhotoPath}`;
        await sendPhoto(token, {
          chat_id: chatId,
          photo: photoUrl,
          caption: "Zdjecie skrytki",
        });
      }
    }
  } catch (e) {
    req.log.warn("Failed to send fulfillment to customer");
    res.status(502).json({ error: "Nie udało się dostarczyć zamówienia do Telegrama. Zamówienie pozostaje oczekujące." }); return;
  }

  await db
    .update(ordersTable)
    .set({
      status: "fulfilled",
      fulfillmentPhotoPath: fulfillmentPhotoPath ?? null,
      fulfillmentGps: fulfillmentGps ?? null,
      fulfillmentNote: fulfillmentNote ?? null,
      fulfilledAt: new Date(),
    })
    .where(eq(ordersTable.id, id));

  res.json({ ok: true });
});

export default router;

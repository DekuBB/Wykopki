import { Router, type IRouter, type Request, type Response } from "express";
import { desc, eq } from "drizzle-orm";
import { db, ordersTable } from "@workspace/db";
import { ObjectStorageService } from "../lib/objectStorage";
import { getBotToken, sendPhoto, sendLocation, sendMessage } from "../lib/telegram";

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

  // Notify customer via Telegram
  try {
    const token = await getBotToken();
    if (token) {
      const chatId = order.telegramId;

      const caption =
        `Twoje zamowienie #${order.id} zostalo zrealizowane!\n\n` +
        `Produkt: <b>${order.productName}</b>\n` +
        `Dzielnica: <b>${order.districtName}</b>` +
        (fulfillmentNote ? `\n\n<i>${fulfillmentNote}</i>` : "");

      await sendMessage(token, { chat_id: chatId, text: caption, parse_mode: "HTML" });

      if (fulfillmentGps) {
        try {
          const { lat, lng } = JSON.parse(fulfillmentGps) as { lat: number; lng: number };
          await sendLocation(token, { chat_id: chatId, latitude: lat, longitude: lng });
        } catch { /* ignore GPS parse errors */ }
      }

      if (fulfillmentPhotoPath) {
        const domain = (process.env.REPLIT_DOMAINS ?? "").split(",")[0]?.trim();
        const baseUrl = domain ? `https://${domain}` : "";
        const photoUrl = `${baseUrl}/api/storage${fulfillmentPhotoPath}`;
        await sendPhoto(token, {
          chat_id: chatId,
          photo: photoUrl,
          caption: "Zdjecie skrytki",
        }).catch((e: unknown) => req.log.warn({ e }, "Failed to send fulfillment photo"));
      }
    }
  } catch (e) {
    req.log.warn({ e }, "Failed to send fulfillment to customer");
  }

  res.json({ ok: true });
});

export default router;

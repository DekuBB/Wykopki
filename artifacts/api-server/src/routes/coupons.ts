import { Router, type IRouter, type Request, type Response } from "express";
import { eq, desc } from "drizzle-orm";
import { db, couponsTable } from "@workspace/db";
import { z } from "zod/v4";

const router: IRouter = Router();

const CreateCouponBody = z.object({
  code: z.string().min(2).max(32).toUpperCase(),
  valuePln: z.number().positive(),
  maxUses: z.number().int().positive().default(1),
});

function serializeCoupon(c: typeof couponsTable.$inferSelect) {
  return {
    ...c,
    valuePln: parseFloat(c.valuePln),
    createdAt: c.createdAt.toISOString(),
  };
}

router.get("/coupons", async (_req, res: Response): Promise<void> => {
  const coupons = await db.select().from(couponsTable).orderBy(desc(couponsTable.createdAt));
  res.json(coupons.map(serializeCoupon));
});

router.post("/coupons", async (req: Request, res: Response): Promise<void> => {
  const body = CreateCouponBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }
  const existing = await db.select().from(couponsTable).where(eq(couponsTable.code, body.data.code)).limit(1);
  if (existing.length > 0) {
    res.status(409).json({ error: "Kupon o takim kodzie juz istnieje" });
    return;
  }
  const [coupon] = await db.insert(couponsTable).values({
    code: body.data.code,
    valuePln: String(body.data.valuePln),
    maxUses: body.data.maxUses,
  }).returning();
  res.status(201).json(serializeCoupon(coupon));
});

router.patch("/coupons/:id/toggle", async (req: Request, res: Response): Promise<void> => {
  const id = parseInt(String(req.params["id"]), 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const [coupon] = await db.select().from(couponsTable).where(eq(couponsTable.id, id));
  if (!coupon) { res.status(404).json({ error: "Not found" }); return; }
  const [updated] = await db.update(couponsTable).set({ isActive: !coupon.isActive }).where(eq(couponsTable.id, id)).returning();
  res.json(serializeCoupon(updated));
});

router.delete("/coupons/:id", async (req: Request, res: Response): Promise<void> => {
  const id = parseInt(String(req.params["id"]), 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  await db.delete(couponsTable).where(eq(couponsTable.id, id));
  res.sendStatus(204);
});

export default router;

import { Router, type IRouter } from "express";
import { db, categoriesTable, productsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { z } from "zod/v4";
const router: IRouter = Router();
const bodySchema = z.object({ name: z.string().trim().min(1).max(100), emoji: z.string().max(16).nullable().optional(), isActive: z.boolean().default(true) });
router.get("/categories", async (_req, res) => { res.json(await db.select().from(categoriesTable).orderBy(categoriesTable.name)); });
router.post("/categories", async (req, res) => {
  const body = bodySchema.safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: "Podaj nazwę kategorii" }); return; }
  const [category] = await db.insert(categoriesTable).values(body.data).returning();
  res.status(201).json(category);
});
router.put("/categories/:id", async (req, res) => {
  const body = bodySchema.safeParse(req.body); const id = Number(req.params.id);
  if (!body.success || !Number.isSafeInteger(id) || id <= 0) { res.status(400).json({ error: "Nieprawidłowa kategoria" }); return; }
  const [category] = await db.update(categoriesTable).set(body.data).where(eq(categoriesTable.id, id)).returning();
  if (!category) { res.status(404).json({ error: "Kategoria nie istnieje" }); return; }
  res.json(category);
});
router.delete("/categories/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isSafeInteger(id) || id <= 0) { res.sendStatus(400); return; }
  await db.transaction(async tx => {
    await tx.update(productsTable).set({ categoryId: null }).where(eq(productsTable.categoryId, id));
    await tx.delete(categoriesTable).where(eq(categoriesTable.id, id));
  });
  res.sendStatus(204);
});
export default router;

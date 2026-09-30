import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, productsTable } from "@workspace/db";
import {
  ListProductsResponse,
  CreateProductBody,
  UpdateProductParams,
  UpdateProductBody,
  UpdateProductResponse,
  DeleteProductParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

function serializeProduct(p: typeof productsTable.$inferSelect) {
  return {
    ...p,
    pricePln: parseFloat(p.pricePln),
    weightGrams: p.weightGrams ? parseFloat(p.weightGrams) : null,
    createdAt: p.createdAt.toISOString(),
  };
}

router.get("/products", async (_req, res): Promise<void> => {
  const products = await db
    .select()
    .from(productsTable)
    .orderBy(productsTable.cityId, productsTable.name);
  res.json(ListProductsResponse.parse(products.map(serializeProduct)));
});

router.post("/products", async (req, res): Promise<void> => {
  const body = CreateProductBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }

  const [product] = await db
    .insert(productsTable)
    .values({
      cityId: body.data.cityId,
      name: body.data.name,
      emoji: body.data.emoji ?? null,
      pricePln: String(body.data.pricePln),
      weightGrams: body.data.weightGrams != null ? String(body.data.weightGrams) : null,
      isActive: body.data.isActive ?? true,
    })
    .returning();

  res.status(201).json(serializeProduct(product));
});

router.put("/products/:id", async (req, res): Promise<void> => {
  const params = UpdateProductParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const body = UpdateProductBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }

  const [product] = await db
    .update(productsTable)
    .set({
      cityId: body.data.cityId,
      name: body.data.name,
      emoji: body.data.emoji ?? null,
      pricePln: String(body.data.pricePln),
      weightGrams: body.data.weightGrams != null ? String(body.data.weightGrams) : null,
      isActive: body.data.isActive ?? true,
    })
    .where(eq(productsTable.id, params.data.id))
    .returning();

  if (!product) {
    res.status(404).json({ error: "Product not found" });
    return;
  }

  res.json(UpdateProductResponse.parse(serializeProduct(product)));
});

router.delete("/products/:id", async (req, res): Promise<void> => {
  const params = DeleteProductParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  await db.delete(productsTable).where(eq(productsTable.id, params.data.id));
  res.sendStatus(204);
});

export default router;

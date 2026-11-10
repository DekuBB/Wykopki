import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, productPhotosTable, productsTable } from "@workspace/db";
import { z } from "zod/v4";
import { ObjectStorageService } from "../lib/objectStorage";

const router: IRouter = Router();
const objectStorage = new ObjectStorageService();

const CreatePhotoBody = z.object({
  productId: z.number().int().positive(),
  objectPath: z.string().regex(/^\/objects\/[a-f0-9-]{36}\.(jpg|png|webp)$/),
  caption: z.string().optional(),
});

function serializePhoto(p: typeof productPhotosTable.$inferSelect) {
  const baseUrl = "";
  return {
    ...p,
    createdAt: p.createdAt.toISOString(),
    servingUrl: `${baseUrl}/api/storage${p.objectPath}`,
  };
}

router.get("/product-photos/:productId", async (req, res): Promise<void> => {
  const productId = parseInt(req.params.productId, 10);
  if (isNaN(productId)) {
    res.status(400).json({ error: "Invalid productId" });
    return;
  }
  const photos = await db
    .select()
    .from(productPhotosTable)
    .where(eq(productPhotosTable.productId, productId))
    .orderBy(productPhotosTable.createdAt);
  res.json(photos.map(serializePhoto));
});

router.post("/product-photos", async (req, res): Promise<void> => {
  const body = CreatePhotoBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }
  const [product] = await db.select().from(productsTable).where(eq(productsTable.id, body.data.productId));
  if (!product) { res.status(404).json({ error: "Produkt nie istnieje" }); return; }
  await objectStorage.downloadObject(await objectStorage.getObjectEntityFile(body.data.objectPath));
  const [photo] = await db
    .insert(productPhotosTable)
    .values({
      productId: body.data.productId,
      objectPath: body.data.objectPath,
      caption: body.data.caption ?? null,
    })
    .returning();
  res.status(201).json(serializePhoto(photo));
});

router.delete("/product-photos/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  await db.delete(productPhotosTable).where(eq(productPhotosTable.id, id));
  res.sendStatus(204);
});

// Presigned upload URL for product photos
router.post("/product-photos/upload-url", async (req, res): Promise<void> => {
  const { name, size, contentType } = req.body as { name?: string; size?: number; contentType?: string };
  if (!name || !contentType) {
    res.status(400).json({ error: "name and contentType are required" });
    return;
  }
  try {
    const uploadURL = await objectStorage.getObjectEntityUploadURL();
    const normalized = objectStorage.normalizeObjectEntityPath(uploadURL);
    res.json({ uploadURL, objectPath: normalized });
  } catch (err) {
    req.log.error({ err }, "Failed to get upload URL");
    res.status(500).json({ error: "Storage error" });
  }
});

export default router;

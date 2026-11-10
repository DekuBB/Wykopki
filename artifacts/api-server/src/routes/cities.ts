import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, citiesTable, productsTable, districtsTable } from "@workspace/db";
import {
  ListCitiesResponse,
  CreateCityBody,
  UpdateCityParams,
  UpdateCityBody,
  UpdateCityResponse,
  DeleteCityParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

function serializeCity(c: typeof citiesTable.$inferSelect) {
  return {
    ...c,
    createdAt: c.createdAt.toISOString(),
  };
}

router.get("/cities", async (_req, res): Promise<void> => {
  const cities = await db
    .select()
    .from(citiesTable)
    .orderBy(citiesTable.name);
  res.json(ListCitiesResponse.parse(cities.map(serializeCity)));
});

router.post("/cities", async (req, res): Promise<void> => {
  const body = CreateCityBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }

  const [city] = await db
    .insert(citiesTable)
    .values({
      name: body.data.name,
      emoji: body.data.emoji ?? null,
      imageUrl: body.data.imageUrl ?? null,
      isActive: body.data.isActive ?? true,
    })
    .returning();

  res.status(201).json(serializeCity(city));
});

router.put("/cities/:id", async (req, res): Promise<void> => {
  const params = UpdateCityParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const body = UpdateCityBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }

  const [city] = await db
    .update(citiesTable)
    .set({
      name: body.data.name,
      emoji: body.data.emoji ?? null,
      imageUrl: body.data.imageUrl ?? null,
      isActive: body.data.isActive ?? true,
    })
    .where(eq(citiesTable.id, params.data.id))
    .returning();

  if (!city) {
    res.status(404).json({ error: "City not found" });
    return;
  }

  res.json(UpdateCityResponse.parse(serializeCity(city)));
});

router.delete("/cities/:id", async (req, res): Promise<void> => {
  const params = DeleteCityParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [product] = await db.select({ id: productsTable.id }).from(productsTable).where(eq(productsTable.cityId, params.data.id)).limit(1);
  const [district] = await db.select({ id: districtsTable.id }).from(districtsTable).where(eq(districtsTable.cityId, params.data.id)).limit(1);
  if (product || district) { res.status(409).json({ error: "Najpierw usuń lub przenieś produkty i dzielnice tego miasta." }); return; }
  await db.delete(citiesTable).where(eq(citiesTable.id, params.data.id));
  res.sendStatus(204);
});

export default router;

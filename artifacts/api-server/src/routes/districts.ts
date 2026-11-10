import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, districtsTable, citiesTable } from "@workspace/db";
import {
  ListDistrictsResponse,
  CreateDistrictBody,
  UpdateDistrictParams,
  UpdateDistrictBody,
  UpdateDistrictResponse,
  DeleteDistrictParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

function serializeDistrict(d: typeof districtsTable.$inferSelect) {
  return {
    ...d,
    createdAt: d.createdAt.toISOString(),
  };
}

router.get("/districts", async (_req, res): Promise<void> => {
  const districts = await db
    .select()
    .from(districtsTable)
    .orderBy(districtsTable.cityId, districtsTable.name);
  res.json(ListDistrictsResponse.parse(districts.map(serializeDistrict)));
});

router.post("/districts", async (req, res): Promise<void> => {
  const body = CreateDistrictBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }

  const [city] = await db.select().from(citiesTable).where(eq(citiesTable.id, body.data.cityId));
  if (!city) { res.status(400).json({ error: "Wybierz istniejące miasto" }); return; }
  const [district] = await db
    .insert(districtsTable)
    .values({
      cityId: body.data.cityId,
      name: body.data.name,
      isActive: body.data.isActive ?? true,
    })
    .returning();

  res.status(201).json(serializeDistrict(district));
});

router.put("/districts/:id", async (req, res): Promise<void> => {
  const params = UpdateDistrictParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const body = UpdateDistrictBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }

  const [city] = await db.select().from(citiesTable).where(eq(citiesTable.id, body.data.cityId));
  if (!city) { res.status(400).json({ error: "Wybierz istniejące miasto" }); return; }
  const [district] = await db
    .update(districtsTable)
    .set({
      cityId: body.data.cityId,
      name: body.data.name,
      isActive: body.data.isActive ?? true,
    })
    .where(eq(districtsTable.id, params.data.id))
    .returning();

  if (!district) {
    res.status(404).json({ error: "District not found" });
    return;
  }

  res.json(UpdateDistrictResponse.parse(serializeDistrict(district)));
});

router.delete("/districts/:id", async (req, res): Promise<void> => {
  const params = DeleteDistrictParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  await db.delete(districtsTable).where(eq(districtsTable.id, params.data.id));
  res.sendStatus(204);
});

export default router;

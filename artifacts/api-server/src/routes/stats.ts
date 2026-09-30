import { Router, type IRouter } from "express";
import { db, usersTable, ordersTable } from "@workspace/db";
import { sql, gte } from "drizzle-orm";
import { GetStatsResponse } from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/stats", async (_req, res): Promise<void> => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [totalUsersResult] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(usersTable);

  const [totalOrdersResult] = await db
    .select({
      count: sql<number>`count(*)::int`,
      revenue: sql<number>`coalesce(sum(amount_pln::numeric), 0)::float`,
    })
    .from(ordersTable);

  const [todayOrdersResult] = await db
    .select({
      count: sql<number>`count(*)::int`,
      revenue: sql<number>`coalesce(sum(amount_pln::numeric), 0)::float`,
    })
    .from(ordersTable)
    .where(gte(ordersTable.createdAt, today));

  const [activeUsersResult] = await db
    .select({ count: sql<number>`count(distinct user_id)::int` })
    .from(ordersTable);

  const topCitiesRaw = await db
    .select({
      cityId: ordersTable.cityId,
      cityName: ordersTable.cityName,
      orderCount: sql<number>`count(*)::int`,
    })
    .from(ordersTable)
    .groupBy(ordersTable.cityId, ordersTable.cityName)
    .orderBy(sql`count(*) desc`)
    .limit(5);

  const recentOrdersRaw = await db
    .select()
    .from(ordersTable)
    .orderBy(sql`created_at desc`)
    .limit(10);

  res.json(
    GetStatsResponse.parse({
      totalUsers: totalUsersResult.count,
      totalOrders: totalOrdersResult.count,
      totalRevenuePln: totalOrdersResult.revenue,
      activeUsers: activeUsersResult.count,
      todayOrders: todayOrdersResult.count,
      todayRevenuePln: todayOrdersResult.revenue,
      topCities: topCitiesRaw,
      recentOrders: recentOrdersRaw.map((o) => ({
        ...o,
        amountPln: parseFloat(o.amountPln),
        createdAt: o.createdAt.toISOString(),
      })),
    })
  );
});

export default router;

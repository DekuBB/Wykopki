import { and, eq, gte, sql } from "drizzle-orm";
import {
  db,
  settingsTable,
  couponsTable,
  ordersTable,
  usersTable,
} from "@workspace/db";

export interface BalanceOrderInput {
  telegramId: string;
  requestKey?: string;
  cityId: number;
  cityName: string;
  productId: number;
  productName: string;
  amountPln: string;
  districtId: number;
  districtName: string;
}

export async function createBalanceOrder(
  input: BalanceOrderInput,
): Promise<{ order: typeof ordersTable.$inferSelect; newBalance: number } | null> {
  return db.transaction(async (tx) => {
    if (input.requestKey) {
      const [existing] = await tx.select().from(ordersTable).where(and(eq(ordersTable.requestKey, input.requestKey), eq(ordersTable.telegramId, input.telegramId)));
      if (existing) {
        const [user] = await tx.select().from(usersTable).where(eq(usersTable.telegramId, input.telegramId));
        return { order: existing, newBalance: Number(user.balance) };
      }
    }
    const [settings] = await tx.select().from(settingsTable).limit(1);
    if (Number(input.amountPln) < (settings?.minPurchaseAmount ?? 0)) return null;
    const [debitedUser] = await tx
      .update(usersTable)
      .set({
        balance: sql`${usersTable.balance} - ${input.amountPln}`,
        purchaseCount: sql`${usersTable.purchaseCount} + 1`,
      })
      .where(
        and(
          eq(usersTable.telegramId, input.telegramId),
          gte(usersTable.balance, input.amountPln),
        ),
      )
      .returning();

    if (!debitedUser) return null;

    const [order] = await tx
      .insert(ordersTable)
      .values({
        requestKey: input.requestKey ?? null,
        userId: debitedUser.id,
        telegramId: input.telegramId,
        cityId: input.cityId,
        cityName: input.cityName,
        productId: input.productId,
        productName: input.productName,
        districtId: input.districtId,
        districtName: input.districtName,
        amountPln: input.amountPln,
        paymentMethod: "balance",
        paymentStatus: "paid",
        paidAt: new Date(),
        status: "pending",
      })
      .returning();

    return {
      order,
      newBalance: parseFloat(debitedUser.balance),
    };
  });
}

export async function exchangeBonusesForBalance(
  telegramId: string,
  bonusAmount: number,
  rate: number,
): Promise<boolean> {
  const pln = bonusAmount / rate;
  const [updated] = await db
    .update(usersTable)
    .set({
      bonuses: sql`${usersTable.bonuses} - ${bonusAmount}`,
      balance: sql`${usersTable.balance} + ${pln}`,
    })
    .where(
      and(
        eq(usersTable.telegramId, telegramId),
        gte(usersTable.bonuses, String(bonusAmount)),
      ),
    )
    .returning({ id: usersTable.id });

  return Boolean(updated);
}

export async function redeemCouponForUser(
  telegramId: string,
  code: string,
): Promise<number | null> {
  return db.transaction(async (tx) => {
    const [coupon] = await tx
      .update(couponsTable)
      .set({
        usedCount: sql`${couponsTable.usedCount} + 1`,
      })
      .where(
        and(
          eq(couponsTable.code, code),
          eq(couponsTable.isActive, true),
          sql`${couponsTable.usedCount} < ${couponsTable.maxUses}`,
        ),
      )
      .returning();

    if (!coupon) return null;

    const [updatedUser] = await tx
      .update(usersTable)
      .set({
        balance: sql`${usersTable.balance} + ${coupon.valuePln}`,
      })
      .where(eq(usersTable.telegramId, telegramId))
      .returning({ id: usersTable.id });

    if (!updatedUser) {
      throw new Error("Coupon redemption user not found");
    }

    return parseFloat(coupon.valuePln);
  });
}
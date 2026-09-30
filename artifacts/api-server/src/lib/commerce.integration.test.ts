import assert from "node:assert/strict";
import test from "node:test";
import { and, eq } from "drizzle-orm";
import {
  db,
  citiesTable,
  couponsTable,
  districtsTable,
  ordersTable,
  productsTable,
  usersTable,
} from "@workspace/db";
import {
  createBalanceOrder,
  redeemCouponForUser,
} from "./commerce";

test("balance purchase is atomic and coupon use is limited", async () => {
  const suffix = `${Date.now()}_${Math.floor(Math.random() * 1_000_000)}`;
  const telegramId = `test_${suffix}`;
  const couponCode = `TEST_${suffix}`.slice(0, 32).toUpperCase();

  const [city] = await db
    .insert(citiesTable)
    .values({ name: `Test city ${suffix}`, isActive: true })
    .returning();
  const [product] = await db
    .insert(productsTable)
    .values({
      cityId: city.id,
      name: `Test product ${suffix}`,
      pricePln: "7.00",
      isActive: true,
    })
    .returning();
  const [district] = await db
    .insert(districtsTable)
    .values({ cityId: city.id, name: `Test district ${suffix}`, isActive: true })
    .returning();
  const [user] = await db
    .insert(usersTable)
    .values({
      telegramId,
      referralCode: `ref_${suffix}`,
      balance: "10.00",
    })
    .returning();
  await db.insert(couponsTable).values({
    code: couponCode,
    valuePln: "5.00",
    maxUses: 1,
  });

  try {
    const firstOrder = await createBalanceOrder({
      telegramId,
      cityId: city.id,
      cityName: city.name,
      productId: product.id,
      productName: product.name,
      amountPln: product.pricePln,
      districtId: district.id,
      districtName: district.name,
    });
    assert.ok(firstOrder);
    assert.equal(firstOrder.newBalance, 3);

    const secondOrder = await createBalanceOrder({
      telegramId,
      cityId: city.id,
      cityName: city.name,
      productId: product.id,
      productName: product.name,
      amountPln: product.pricePln,
      districtId: district.id,
      districtName: district.name,
    });
    assert.equal(secondOrder, null);

    const firstCoupon = await redeemCouponForUser(telegramId, couponCode);
    assert.equal(firstCoupon, 5);
    const secondCoupon = await redeemCouponForUser(telegramId, couponCode);
    assert.equal(secondCoupon, null);

    const [updatedUser] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, user.id));
    assert.equal(updatedUser.balance, "8.00");
    assert.equal(updatedUser.purchaseCount, 1);

    const [coupon] = await db
      .select()
      .from(couponsTable)
      .where(eq(couponsTable.code, couponCode));
    assert.equal(coupon.usedCount, 1);
  } finally {
    await db.delete(ordersTable).where(eq(ordersTable.telegramId, telegramId));
    await db.delete(couponsTable).where(eq(couponsTable.code, couponCode));
    await db.delete(usersTable).where(eq(usersTable.id, user.id));
    await db.delete(productsTable).where(eq(productsTable.id, product.id));
    await db.delete(districtsTable).where(eq(districtsTable.id, district.id));
    await db.delete(citiesTable).where(eq(citiesTable.id, city.id));
  }
});
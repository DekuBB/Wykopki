import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import test from "node:test";
import { eq } from "drizzle-orm";
import {
  db,
  ordersTable,
  settingsTable,
  usersTable,
} from "@workspace/db";

const baseUrl = process.env.TEST_BASE_URL ?? "http://localhost:80";

async function getConfiguredBotToken(): Promise<string | null> {
  const environmentToken = process.env.TELEGRAM_BOT_TOKEN?.trim();
  if (environmentToken) return environmentToken;
  const [settings] = await db
    .select({ botToken: settingsTable.botToken })
    .from(settingsTable)
    .limit(1);
  return settings?.botToken ?? null;
}

function makeInitData(botToken: string, telegramId: number): string {
  const params = new URLSearchParams({
    auth_date: String(Math.floor(Date.now() / 1000)),
    query_id: `test-${telegramId}`,
    user: JSON.stringify({
      id: telegramId,
      first_name: "Mini App Test",
      username: `mini_app_${telegramId}`,
    }),
  });
  const dataCheckString = [...params.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");
  const secretKey = createHmac("sha256", "WebAppData")
    .update(botToken)
    .digest();
  const hash = createHmac("sha256", secretKey)
    .update(dataCheckString)
    .digest("hex");
  params.set("hash", hash);
  return params.toString();
}

test("Telegram Mini App authenticates and places an internal-balance order", async (t) => {
  const botToken = await getConfiguredBotToken();
  if (!botToken) {
    t.skip("Telegram bot token is not configured in the development environment");
    return;
  }

  const telegramId = Date.now();
  let userId: number | null = null;

  try {
    const sessionResponse = await fetch(`${baseUrl}/api/telegram/app/session`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ initData: makeInitData(botToken, telegramId) }),
    });
    assert.equal(sessionResponse.status, 200);
    const session = (await sessionResponse.json()) as {
      user: { id: number; telegramId: string };
      initDataValidated: boolean;
    };
    assert.equal(session.initDataValidated, true);
    assert.equal(session.user.telegramId, String(telegramId));
    userId = session.user.id;

    const setCookie = sessionResponse.headers.get("set-cookie");
    assert.ok(setCookie);
    const cookie = setCookie.split(";")[0];

    const catalogResponse = await fetch(`${baseUrl}/api/telegram/app/catalog`, {
      headers: { Cookie: cookie },
    });
    assert.equal(catalogResponse.status, 200);
    const catalog = (await catalogResponse.json()) as {
      products: Array<{ id: number; cityId: number; pricePln: number }>;
      districts: Array<{ id: number; cityId: number }>;
    };
    const product = catalog.products[0];
    assert.ok(product);
    const district = catalog.districts.find((item) => item.cityId === product.cityId);
    assert.ok(district);

    await db
      .update(usersTable)
      .set({ balance: "100.00" })
      .where(eq(usersTable.id, userId));

    const orderResponse = await fetch(`${baseUrl}/api/telegram/app/orders`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookie,
      },
      body: JSON.stringify({
        productId: product.id,
        districtId: district.id,
      }),
    });
    assert.equal(orderResponse.status, 201);
    const order = (await orderResponse.json()) as {
      telegramId: string;
      paymentMethod: string;
      paymentStatus: string;
      amountPln: number;
    };
    assert.equal(order.telegramId, String(telegramId));
    assert.equal(order.paymentMethod, "balance");
    assert.equal(order.paymentStatus, "paid");
    assert.equal(order.amountPln, product.pricePln);
  } finally {
    if (userId !== null) {
      await db.delete(ordersTable).where(eq(ordersTable.telegramId, String(telegramId)));
      await db.delete(usersTable).where(eq(usersTable.id, userId));
    }
  }
});

test("Telegram Mini App catalog requires a customer session", async () => {
  const response = await fetch(`${baseUrl}/api/telegram/app/catalog`);
  assert.equal(response.status, 401);
});
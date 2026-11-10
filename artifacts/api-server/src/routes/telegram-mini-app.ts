import { createHmac, randomBytes } from "node:crypto";
import { Router, type IRouter, type NextFunction, type Request, type Response } from "express";
import jwt from "jsonwebtoken";
import { and, desc, eq } from "drizzle-orm";
import {
  CreateTelegramMiniAppOrderBody,
  CreateTelegramMiniAppSessionBody,
} from "@workspace/api-zod";
import {
  citiesTable,
  db,
  districtsTable,
  ordersTable,
  productsTable,
  settingsTable,
  usersTable,
  type User,
} from "@workspace/db";
import { createBalanceOrder } from "../lib/commerce";
import { getBotToken } from "../lib/telegram";
import { getRequiredSecret, secretsMatch } from "../lib/security";
import { z } from "zod/v4";

const router: IRouter = Router();
const SESSION_COOKIE = "telegram_session";
const MAX_INIT_DATA_AGE_SECONDS = 24 * 60 * 60;

const TelegramWebAppUser = z.object({
  id: z.number().int().positive(),
  username: z.string().optional(),
  first_name: z.string().optional(),
});

type TelegramSessionPayload = {
  role: "telegram-user";
  userId: number;
  telegramId: string;
};

function serializeUser(user: User) {
  return {
    ...user,
    balance: parseFloat(user.balance),
    discountPercent: parseFloat(user.discountPercent),
    bonuses: parseFloat(user.bonuses),
    createdAt: user.createdAt.toISOString(),
  };
}

function serializeOrder(order: typeof ordersTable.$inferSelect) {
  return {
    ...order,
    amountPln: parseFloat(order.amountPln),
    createdAt: order.createdAt.toISOString(),
    updatedAt: order.updatedAt.toISOString(),
    fulfilledAt: order.fulfilledAt ? order.fulfilledAt.toISOString() : null,
    paidAt: order.paidAt ? order.paidAt.toISOString() : null,
  };
}

async function getConfiguredBotToken(): Promise<string | null> {
  const environmentToken = await getBotToken();
  if (environmentToken) return environmentToken;

  const [settings] = await db
    .select({ botToken: settingsTable.botToken })
    .from(settingsTable)
    .limit(1);
  return settings?.botToken ?? null;
}

export function validateTelegramInitData(
  initData: string,
  botToken: string,
): { telegramUser: z.infer<typeof TelegramWebAppUser> } | null {
  const params = new URLSearchParams(initData);
  const hash = params.get("hash");
  const authDate = Number(params.get("auth_date"));
  const userJson = params.get("user");

  if (!hash || !Number.isInteger(authDate) || !userJson) return null;

  const now = Math.floor(Date.now() / 1000);
  if (authDate > now + 60 || now - authDate > MAX_INIT_DATA_AGE_SECONDS) {
    return null;
  }

  const dataCheckString = [...params.entries()]
    .filter(([key]) => key !== "hash")
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");

  const secretKey = createHmac("sha256", "WebAppData")
    .update(botToken)
    .digest();
  const calculatedHash = createHmac("sha256", secretKey)
    .update(dataCheckString)
    .digest("hex");

  if (!secretsMatch(calculatedHash, hash)) return null;

  try {
    const telegramUser = TelegramWebAppUser.parse(JSON.parse(userJson));
    return { telegramUser };
  } catch {
    return null;
  }
}

async function telegramCustomerAuth(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const jwtSecret = getRequiredSecret("SESSION_SECRET");
  if (!jwtSecret) {
    res.status(503).json({ error: "Customer authentication is not configured" });
    return;
  }

  const token = req.cookies?.[SESSION_COOKIE];
  if (!token) {
    res.status(401).json({ error: "Telegram customer session required" });
    return;
  }

  try {
    const payload = jwt.verify(token, jwtSecret);
    if (
      typeof payload !== "object" ||
      payload.role !== "telegram-user" ||
      typeof payload.userId !== "number" ||
      typeof payload.telegramId !== "string"
    ) {
      res.status(401).json({ error: "Invalid Telegram customer session" });
      return;
    }

    const [user] = await db
      .select()
      .from(usersTable)
      .where(
        and(
          eq(usersTable.id, payload.userId),
          eq(usersTable.telegramId, payload.telegramId),
        ),
      );
    if (!user) {
      res.status(401).json({ error: "Telegram customer session expired" });
      return;
    }

    res.locals.telegramUser = user;
    next();
  } catch {
    res.status(401).json({ error: "Invalid Telegram customer session" });
  }
}

router.post("/telegram/app/session", async (req: Request, res: Response): Promise<void> => {
  const body = CreateTelegramMiniAppSessionBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }

  const botToken = await getConfiguredBotToken();
  if (!botToken) {
    res.status(503).json({ error: "Telegram bot authentication is not configured" });
    return;
  }

  const validated = validateTelegramInitData(body.data.initData, botToken);
  if (!validated) {
    res.status(401).json({ error: "Invalid or expired Telegram init data" });
    return;
  }

  const { telegramUser } = validated;
  const telegramId = String(telegramUser.id);
  const referralCode = `tg_${telegramId}_${randomBytes(5).toString("hex")}`;
  const [user] = await db
    .insert(usersTable)
    .values({
      telegramId,
      username: telegramUser.username ?? null,
      firstName: telegramUser.first_name ?? null,
      referralCode,
    })
    .onConflictDoUpdate({
      target: usersTable.telegramId,
      set: {
        username: telegramUser.username ?? null,
        firstName: telegramUser.first_name ?? null,
      },
    })
    .returning();

  const jwtSecret = getRequiredSecret("SESSION_SECRET");
  if (!jwtSecret) {
    res.status(503).json({ error: "Customer authentication is not configured" });
    return;
  }

  const sessionToken = jwt.sign(
    {
      role: "telegram-user",
      userId: user.id,
      telegramId,
    } satisfies TelegramSessionPayload,
    jwtSecret,
    { expiresIn: "24h" },
  );

  res.cookie(SESSION_COOKIE, sessionToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 24 * 60 * 60 * 1000,
  });
  res.json({ user: serializeUser(user), initDataValidated: true });
});

router.use("/telegram/app", telegramCustomerAuth);

router.get("/telegram/app/catalog", async (_req, res: Response): Promise<void> => {
  const [cities, products, districts] = await Promise.all([
    db.select().from(citiesTable).where(eq(citiesTable.isActive, true)).orderBy(citiesTable.name),
    db.select().from(productsTable).where(eq(productsTable.isActive, true)).orderBy(productsTable.name),
    db.select().from(districtsTable).where(eq(districtsTable.isActive, true)).orderBy(districtsTable.name),
  ]);
  const activeCityIds = new Set(cities.map((city) => city.id));

  res.json({
    cities: cities.map((city) => ({
      ...city,
      createdAt: city.createdAt.toISOString(),
    })),
    products: products
      .filter((product) => activeCityIds.has(product.cityId))
      .map((product) => ({
        ...product,
        pricePln: parseFloat(product.pricePln),
        weightGrams: product.weightGrams === null ? null : parseFloat(product.weightGrams),
        createdAt: product.createdAt.toISOString(),
      })),
    districts: districts
      .filter((district) => activeCityIds.has(district.cityId))
      .map((district) => ({
        ...district,
        createdAt: district.createdAt.toISOString(),
      })),
  });
});

router.get("/telegram/app/account", async (_req, res: Response): Promise<void> => {
  const user = res.locals.telegramUser as User;
  const orders = await db
    .select()
    .from(ordersTable)
    .where(eq(ordersTable.telegramId, user.telegramId))
    .orderBy(desc(ordersTable.createdAt))
    .limit(50);

  res.json({
    user: serializeUser(user),
    orders: orders.map(serializeOrder),
  });
});

router.post("/telegram/app/orders", async (req: Request, res: Response): Promise<void> => {
  const body = CreateTelegramMiniAppOrderBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }

  const user = res.locals.telegramUser as User;
  const [product] = await db
    .select()
    .from(productsTable)
    .where(
      and(
        eq(productsTable.id, body.data.productId),
        eq(productsTable.isActive, true),
      ),
    );
  if (!product) {
    res.status(400).json({ error: "Product is not available" });
    return;
  }

  const [city] = await db
    .select()
    .from(citiesTable)
    .where(
      and(
        eq(citiesTable.id, product.cityId),
        eq(citiesTable.isActive, true),
      ),
    );
  const [district] = await db
    .select()
    .from(districtsTable)
    .where(
      and(
        eq(districtsTable.id, body.data.districtId),
        eq(districtsTable.cityId, product.cityId),
        eq(districtsTable.isActive, true),
      ),
    );
  if (!city || !district) {
    res.status(400).json({ error: "District is not available for this product" });
    return;
  }

  const paymentResult = await createBalanceOrder({
    telegramId: user.telegramId,
    cityId: city.id,
    cityName: city.name,
    productId: product.id,
    productName: product.name,
    amountPln: product.pricePln,
    districtId: district.id,
    districtName: district.name,
  });
  if (!paymentResult) {
    res.status(409).json({ error: "Insufficient balance or purchase conflict" });
    return;
  }

  res.status(201).json(serializeOrder(paymentResult.order));
});

export default router;
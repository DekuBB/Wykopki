import { db, botSessionsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

export interface BotSession {
  state:
    | "home"
    | "buy:city"
    | "buy:product"
    | "buy:district"
    | "buy:payment"
    | "topup"
    | "topup:amount"
    | "opinion"
    | "exchange:waiting"
    | "coupon:waiting";
  selectedCityId?: number;
  selectedCityName?: string;
  selectedProductId?: number;
  selectedProductName?: string;
  selectedProductPrice?: number;
  selectedDistrictId?: number;
  selectedDistrictName?: string;
  lastMessageId?: number;
}

export async function getSession(telegramId: string): Promise<BotSession> {
  const [row] = await db.select().from(botSessionsTable).where(eq(botSessionsTable.telegramId, telegramId));
  if (!row || Date.now() - row.updatedAt.getTime() > 86400000) return { state: "home" };
  return row.data as BotSession;
}
export async function setSession(telegramId: string, session: BotSession): Promise<void> {
  await db.insert(botSessionsTable).values({ telegramId, data: session }).onConflictDoUpdate({
    target: botSessionsTable.telegramId, set: { data: session, updatedAt: new Date() },
  });
}
export async function resetSession(telegramId: string): Promise<void> {
  await setSession(telegramId, { state: "home" });
}

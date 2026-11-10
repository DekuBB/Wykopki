import { db, settingsTable } from "@workspace/db";
import { getRequiredSecret } from "./security";
export async function isTelegramAdmin(telegramId: string): Promise<boolean> {
  const [settings] = await db.select({ adminId: settingsTable.adminTelegramId }).from(settingsTable).limit(1);
  const configured = settings?.adminId?.trim() || getRequiredSecret("ADMIN_TELEGRAM_ID");
  return !!configured && configured === telegramId;
}

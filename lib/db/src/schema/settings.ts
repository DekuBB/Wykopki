import { pgTable, text, serial, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const settingsTable = pgTable("bot_settings", {
  id: serial("id").primaryKey(),
  botToken: text("bot_token"),
  adminTelegramId: text("admin_telegram_id"),
  welcomeMessage: text("welcome_message"),
  operatorUsername: text("operator_username"),
  rulesText: text("rules_text"),
  webhookUrl: text("webhook_url"),
  orderConfirmationMessage: text("order_confirmation_message"),
  bonusExchangeRate: integer("bonus_exchange_rate").default(10),
  minPurchaseAmount: integer("min_purchase_amount").default(0),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertSettingsSchema = createInsertSchema(settingsTable).omit({ id: true, updatedAt: true });
export type InsertSettings = z.infer<typeof insertSettingsSchema>;
export type Settings = typeof settingsTable.$inferSelect;

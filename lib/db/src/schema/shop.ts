import { pgTable, serial, text, boolean, timestamp, jsonb } from "drizzle-orm/pg-core";

export const categoriesTable = pgTable("categories", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  emoji: text("emoji"),
  isActive: boolean("is_active").notNull().default(true),
});
export const botSessionsTable = pgTable("bot_sessions", {
  telegramId: text("telegram_id").primaryKey(),
  data: jsonb("data").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
export const telegramUpdatesTable = pgTable("telegram_updates", {
  id: text("id").primaryKey(),
  completed: boolean("completed").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

import { pgTable, text, serial, timestamp, integer, numeric } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const ordersTable = pgTable("orders", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  telegramId: text("telegram_id").notNull(),
  cityId: integer("city_id").notNull(),
  cityName: text("city_name").notNull(),
  productId: integer("product_id").notNull(),
  productName: text("product_name").notNull(),
  districtId: integer("district_id").notNull(),
  districtName: text("district_name").notNull(),
  amountPln: numeric("amount_pln", { precision: 10, scale: 2 }).notNull(),
  requestKey: text("request_key").unique(),
  paymentMethod: text("payment_method").notNull(),
  paymentStatus: text("payment_status").notNull().default("unpaid"),
  paidAt: timestamp("paid_at", { withTimezone: true }),
  status: text("status").notNull().default("pending"),
  fulfillmentPhotoPath: text("fulfillment_photo_path"),
  fulfillmentGps: text("fulfillment_gps"),
  fulfillmentNote: text("fulfillment_note"),
  fulfilledAt: timestamp("fulfilled_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertOrderSchema = createInsertSchema(ordersTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertOrder = z.infer<typeof insertOrderSchema>;
export type Order = typeof ordersTable.$inferSelect;

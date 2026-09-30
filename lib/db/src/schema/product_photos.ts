import { pgTable, text, serial, timestamp, integer } from "drizzle-orm/pg-core";

export const productPhotosTable = pgTable("product_photos", {
  id: serial("id").primaryKey(),
  productId: integer("product_id").notNull(),
  objectPath: text("object_path").notNull(),
  caption: text("caption"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type ProductPhoto = typeof productPhotosTable.$inferSelect;

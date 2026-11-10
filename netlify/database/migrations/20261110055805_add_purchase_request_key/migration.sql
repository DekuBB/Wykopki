ALTER TABLE "orders" ADD COLUMN "request_key" text;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_request_key_key" UNIQUE("request_key");
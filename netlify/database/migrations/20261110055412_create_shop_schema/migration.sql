CREATE TABLE "bot_users" (
	"id" serial PRIMARY KEY,
	"telegram_id" text NOT NULL UNIQUE,
	"username" text,
	"first_name" text,
	"balance" numeric(10,2) DEFAULT '0' NOT NULL,
	"discount_percent" numeric(5,2) DEFAULT '0' NOT NULL,
	"bonuses" numeric(10,2) DEFAULT '0' NOT NULL,
	"purchase_count" integer DEFAULT 0 NOT NULL,
	"referral_code" text NOT NULL,
	"referred_by_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cities" (
	"id" serial PRIMARY KEY,
	"name" text NOT NULL,
	"emoji" text,
	"image_url" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" serial PRIMARY KEY,
	"city_id" integer NOT NULL,
	"category_id" integer,
	"name" text NOT NULL,
	"emoji" text,
	"price_pln" numeric(10,2) NOT NULL,
	"weight_grams" numeric(10,2),
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "districts" (
	"id" serial PRIMARY KEY,
	"city_id" integer NOT NULL,
	"name" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "orders" (
	"id" serial PRIMARY KEY,
	"user_id" integer NOT NULL,
	"telegram_id" text NOT NULL,
	"city_id" integer NOT NULL,
	"city_name" text NOT NULL,
	"product_id" integer NOT NULL,
	"product_name" text NOT NULL,
	"district_id" integer NOT NULL,
	"district_name" text NOT NULL,
	"amount_pln" numeric(10,2) NOT NULL,
	"payment_method" text NOT NULL,
	"payment_status" text DEFAULT 'unpaid' NOT NULL,
	"paid_at" timestamp with time zone,
	"status" text DEFAULT 'pending' NOT NULL,
	"fulfillment_photo_path" text,
	"fulfillment_gps" text,
	"fulfillment_note" text,
	"fulfilled_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bot_settings" (
	"id" serial PRIMARY KEY,
	"bot_token" text,
	"admin_telegram_id" text,
	"welcome_message" text,
	"operator_username" text,
	"rules_text" text,
	"webhook_url" text,
	"order_confirmation_message" text,
	"bonus_exchange_rate" integer DEFAULT 10,
	"min_purchase_amount" integer DEFAULT 0,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product_photos" (
	"id" serial PRIMARY KEY,
	"product_id" integer NOT NULL,
	"object_path" text NOT NULL,
	"caption" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "coupons" (
	"id" serial PRIMARY KEY,
	"code" text NOT NULL UNIQUE,
	"value_pln" numeric(10,2) NOT NULL,
	"max_uses" integer DEFAULT 1 NOT NULL,
	"used_count" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bot_sessions" (
	"telegram_id" text PRIMARY KEY,
	"data" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "categories" (
	"id" serial PRIMARY KEY,
	"name" text NOT NULL UNIQUE,
	"emoji" text,
	"is_active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "telegram_updates" (
	"id" text PRIMARY KEY,
	"completed" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

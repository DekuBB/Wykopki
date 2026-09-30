# GuaKamole Shop Bot

System sklepu oparty na bocie Telegram z webowym panelem administracyjnym. Bot (@GuaKamole_Shop_bot) obsługuje lejek zakupowy — wybór miasta, produktu, dzielnicy i metody płatności — a panel admina umożliwia zarządzanie użytkownikami, asortymentem i ustawieniami bota.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 8080, proxied at /api)
- `pnpm --filter @workspace/admin-panel run dev` — run the admin panel (port 20130, proxied at /)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/scripts run seed` — seed example cities, products, districts
- Required env: `DATABASE_URL` — Postgres connection string
- Required env/secret: `TELEGRAM_BOT_TOKEN` — Telegram bot token

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)
- Frontend: React + Vite + Tailwind + shadcn/ui + React Query

## Where things live

- `lib/db/src/schema/` — DB tables: users, cities, products, districts, orders, settings
- `lib/api-spec/openapi.yaml` — OpenAPI contract (source of truth)
- `lib/api-client-react/src/generated/` — React Query hooks (generated)
- `lib/api-zod/src/generated/` — Zod schemas (generated)
- `artifacts/api-server/src/routes/` — Express route handlers
- `artifacts/api-server/src/lib/botHandler.ts` — Telegram bot conversation logic
- `artifacts/api-server/src/lib/telegram.ts` — Telegram API helpers
- `artifacts/api-server/src/lib/botSession.ts` — In-memory session state
- `artifacts/admin-panel/src/pages/` — Dashboard, Users, Assortment, Settings

## Architecture decisions

- **Single-message bot UI**: Uses `editMessageText` to update the same message on each button click — prevents chat spam, matches the reference screenshots.
- **In-memory sessions**: Bot conversation state (selected city/product/district) stored in a Map — simple and sufficient for single-instance deployment.
- **Contract-first API**: OpenAPI spec written first, then Orval generates both Zod validators (server) and React Query hooks (client).
- **Numeric fields as strings in DB**: Postgres `numeric` columns are stored as strings by Drizzle; serialization to `number` happens at the route layer before Zod parsing.
- **Webhook setup via Settings page**: Admin pastes bot token and webhook URL in the panel; clicking "Set Webhook" calls Telegram's `setWebhook` API automatically.

## Product

- **Telegram Bot**: Users `/start` → see balance/stats → buy flow (city → product → district → payment) → balance deducted → admin notified. Referral system with bonus credits.
- **Admin Panel**: Dashboard with revenue/order stats. Users tab with inline balance editing. Assortment tab to manage cities, products (with emoji/price/weight), and districts. Settings tab with bot token, admin Telegram ID, operator username, rules text, and webhook URL.

## User preferences

- Polish language for the bot and UI
- No emojis in the admin panel UI
- Bot uses inline keyboards (editMessageText) not new messages

## Gotchas

- After changing OpenAPI spec always run codegen: `pnpm --filter @workspace/api-spec run codegen`
- `lib/api-zod/src/index.ts` must only export `./generated/api` (not `./generated/types`) — orval config uses `mode: single` to avoid duplicates
- Webhook URL must be HTTPS and publicly accessible (use the deployed production URL, not localhost)
- To set webhook: go to Settings page in admin panel, fill in the deployed URL + `/api/telegram/webhook`, click Set Webhook

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details

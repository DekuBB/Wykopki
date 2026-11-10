# GuaKamole Shop Bot — Kompletny Prompt Projektu

## Opis projektu

System sklepu "dead drop" oparty na bocie Telegram (@GuaKamole_Shop_bot) z webowym panelem administracyjnym. Kupujący zamawia towar (np. warzywa, owoce itp,itd.) przez bota, płaci kryptowalutą lub BLIKiem, a po akceptacji przez admina otrzymuje współrzędne GPS i zdjęcie fizycznej skrytki (martwa skrytka / dead drop). Panel admina umożliwia zarządzanie całym systemem.

---

## Stack technologiczny

- **Backend**: Node.js 24, TypeScript 5.9, Express 5
- **Baza danych**: PostgreSQL + Drizzle ORM
- **Walidacja**: Zod v4, drizzle-zod
- **API contract**: OpenAPI 3.0 → Orval codegen (React Query hooks + Zod schemas)
- **Frontend**: React 18 + Vite + Tailwind CSS + shadcn/ui + React Query
- **Auth admin**: JWT httpOnly cookie (SESSION_SECRET), hasło (ADMIN_PASSWORD)
- **Storage**: Google Cloud Storage (Replit Object Storage) — zdjęcia produktów i skrytek
- **Telegram**: Webhook, Inline Keyboards, editMessageText (single-message UI)
- **Monorepo**: pnpm workspaces

---

## Struktura projektu

```
/
├── lib/
│   ├── db/src/schema/          # Schematy tabel Drizzle
│   │   ├── users.ts            # Użytkownicy bota
│   │   ├── cities.ts           # Miasta
│   │   ├── products.ts         # Produkty
│   │   ├── districts.ts        # Dzielnice
│   │   ├── orders.ts           # Zamówienia (z fulfillment)
│   │   ├── settings.ts         # Ustawienia bota
│   │   ├── product_photos.ts   # Zdjęcia produktów
│   │   └── coupons.ts          # Kupony promocyjne
│   ├── api-spec/openapi.yaml   # Kontrakt API (source of truth)
│   ├── api-client-react/       # React Query hooks (generated)
│   └── api-zod/                # Zod schemas (generated)
├── artifacts/
│   ├── api-server/src/
│   │   ├── lib/
│   │   │   ├── botHandler.ts   # Logika bota Telegram
│   │   │   ├── botSession.ts   # Sesje in-memory
│   │   │   ├── telegram.ts     # Telegram API helpers
│   │   │   └── objectStorage.ts # GCS storage
│   │   └── routes/
│   │       ├── auth.ts         # JWT login/logout/me
│   │       ├── users.ts        # CRUD użytkowników
│   │       ├── cities.ts       # CRUD miast
│   │       ├── products.ts     # CRUD produktów
│   │       ├── districts.ts    # CRUD dzielnic
│   │       ├── orders.ts       # Zamówienia + fulfill endpoint
│   │       ├── settings.ts     # Ustawienia + webhook
│   │       ├── product-photos.ts # Zdjęcia produktów
│   │       ├── storage.ts      # Serwowanie plików z GCS
│   │       ├── coupons.ts      # Kupony
│   │       ├── broadcast.ts    # Broadcast do wszystkich
│   │       └── stats.ts        # Statystyki dashboard
│   └── admin-panel/src/
│       ├── pages/
│       │   ├── login.tsx       # Ekran logowania
│       │   ├── dashboard.tsx   # Statystyki
│       │   ├── users.tsx       # Zarządzanie użytkownikami
│       │   ├── assortment.tsx  # Asortyment + zdjęcia
│       │   ├── orders.tsx      # Zamówienia + realizacja
│       │   ├── tools.tsx       # Broadcast + kupony
│       │   └── settings.tsx    # Ustawienia bota
│       └── components/
│           └── layout.tsx      # Sidebar z nawigacją
```

---

## Baza danych — schematy tabel

### users
```sql
id SERIAL PRIMARY KEY,
telegram_id TEXT UNIQUE NOT NULL,
username TEXT,
first_name TEXT,
balance NUMERIC(10,2) DEFAULT 0,
discount_percent NUMERIC(5,2) DEFAULT 0,
bonuses NUMERIC(10,2) DEFAULT 0,
purchase_count INTEGER DEFAULT 0,
referral_code TEXT UNIQUE,
referred_by_id INTEGER REFERENCES users(id),
created_at TIMESTAMPTZ DEFAULT NOW()
```

### cities
```sql
id SERIAL PRIMARY KEY,
name TEXT NOT NULL,
emoji TEXT,
is_active BOOLEAN DEFAULT true
```

### products
```sql
id SERIAL PRIMARY KEY,
city_id INTEGER REFERENCES cities(id),
name TEXT NOT NULL,
emoji TEXT,
price_pln NUMERIC(10,2) NOT NULL,
weight_grams INTEGER,
description TEXT,
is_active BOOLEAN DEFAULT true
```

### districts
```sql
id SERIAL PRIMARY KEY,
city_id INTEGER REFERENCES cities(id),
name TEXT NOT NULL,
is_active BOOLEAN DEFAULT true
```

### orders
```sql
id SERIAL PRIMARY KEY,
user_id INTEGER REFERENCES users(id),
telegram_id TEXT NOT NULL,
city_id INTEGER, city_name TEXT,
product_id INTEGER, product_name TEXT,
district_id INTEGER, district_name TEXT,
amount_pln NUMERIC(10,2) NOT NULL,
payment_method TEXT NOT NULL,
status TEXT DEFAULT 'pending',        -- pending | fulfilled
fulfillment_photo_path TEXT,          -- ścieżka w GCS
fulfillment_gps TEXT,                 -- JSON: {"lat": x, "lng": y}
fulfillment_note TEXT,
fulfilled_at TIMESTAMPTZ,
created_at TIMESTAMPTZ DEFAULT NOW()
```

### bot_settings
```sql
id SERIAL PRIMARY KEY,
bot_token TEXT,
admin_telegram_id TEXT,
welcome_message TEXT,
operator_username TEXT,
rules_text TEXT,
webhook_url TEXT,
order_confirmation_message TEXT,
bonus_exchange_rate INTEGER DEFAULT 10,
min_purchase_amount INTEGER DEFAULT 0
```

### product_photos
```sql
id SERIAL PRIMARY KEY,
product_id INTEGER REFERENCES products(id),
object_path TEXT NOT NULL,
caption TEXT,
created_at TIMESTAMPTZ DEFAULT NOW()
```

### coupons
```sql
id SERIAL PRIMARY KEY,
code TEXT UNIQUE NOT NULL,
value_pln NUMERIC(10,2) NOT NULL,
max_uses INTEGER DEFAULT 1,
used_count INTEGER DEFAULT 0,
is_active BOOLEAN DEFAULT true,
created_at TIMESTAMPTZ DEFAULT NOW()
```

---

## Bot Telegram — pełna logika

### Komendy
- `/start [ref_code]` — rejestracja/logowanie, opcjonalnie z kodem referalnym

### Menu główne (editMessageText)
```
[Konto osobiste]
[Doładuj swoje saldo]
[Kup produkt]
[Opinia]
[Zasady] → URL: https://telegra.ph/XxXGuaKamoleXxX-05-10
[Operator]
```

### Konto osobiste — podmenu
```
[Moje referały]
[Historia zakupów]
[Doładuj saldo]
[Wymień punkty]
[Aktywuj kupon]
[Moje rezerwacje]
[Wstecz] [Dom]
```

### Przepływ zakupu
1. Wybór miasta → lista aktywnych miast
2. Wybór produktu → lista z emoji, wagą, ceną PLN
3. Wybór dzielnicy
4. Wybór płatności: [BLIK] [Kryptowaluty] [Przelew]
5. Potwierdzenie → saldo odliczone, zamówienie status=pending
6. Admin w panelu realizuje → bot wysyła klientowi: wiadomość + lokalizację GPS + zdjęcie skrytki

### Wymiana bonusów
- Kurs: 10 bonusów = 1 PLN (konfigurowalne)
- Użytkownik wpisuje liczbę bonusów w czacie
- Bot waliduje i dodaje PLN do salda

### Kupony
- Użytkownik wpisuje kod kuponu w czacie
- Bot weryfikuje kod, dodaje wartość PLN do salda

---

## Panel administracyjny — funkcje

### Logowanie
- Formularz hasłem (domyślnie: 2906)
- JWT httpOnly cookie, ważność 7 dni

### Dashboard
- Przychód ogółem (PLN)
- Liczba zamówień
- Aktywni użytkownicy
- Wykres sprzedaży

### Users
- Lista użytkowników z ID Telegram, username, saldo, bonusy, liczba zakupów
- Inline edycja salda (kliknij i wpisz)

### Assortment
- CRUD miast (nazwa, emoji, aktywny)
- CRUD produktów (nazwa, emoji, cena, waga, dzielnica)
- CRUD dzielnic
- Upload zdjęć produktów (presigned URL → GCS)

### Zamówienia
- Lista z filtrem: Oczekujące / Wszystkie / Zrealizowane
- Przycisk "Realizuj" → dialog z:
  - GPS (lat, lng)
  - Upload zdjęcia skrytki
  - Wiadomość dla klienta
- Kliknięcie "Wyślij" → bot wysyła do klienta

### Narzędzia
- **Broadcast**: wyślij wiadomość HTML do wszystkich użytkowników
- **Kupony**: dodawaj kody promocyjne z wartością PLN i limitem użyć

### Settings
- Token bota Telegram
- Admin Telegram ID
- Username operatora
- URL webhooka + przycisk "Ustaw Webhook"
- Wiadomość powitalna
- Tekst zasad (backup)
- Szablon potwierdzenia zamówienia
- Kurs wymiany bonusów
- Min. kwota zakupu

---

## API Endpoints

### Auth
- `POST /api/auth/login` — `{ password }` → JWT cookie
- `POST /api/auth/logout` → czyści cookie
- `GET /api/auth/me` → `{ ok, role }`

### Users
- `GET /api/users` — lista użytkowników
- `PATCH /api/users/:id` — edycja salda

### Cities / Products / Districts
- `GET/POST /api/cities`
- `PATCH/DELETE /api/cities/:id`
- analogicznie dla products, districts

### Orders
- `GET /api/orders` — lista zamówień (desc)
- `GET /api/orders/:id`
- `GET /api/orders/:id/fulfill-upload-url` — presigned PUT URL dla zdjęcia
- `POST /api/orders/:id/fulfill` — `{ fulfillmentGps, fulfillmentPhotoPath, fulfillmentNote }`

### Product Photos
- `POST /api/product-photos/upload-url`
- `POST /api/product-photos` — zapisz ścieżkę w DB
- `GET /api/product-photos/:productId`
- `DELETE /api/product-photos/:id`

### Coupons
- `GET /api/coupons`
- `POST /api/coupons` — `{ code, valuePln, maxUses }`
- `PATCH /api/coupons/:id/toggle` — aktywuj/deaktywuj
- `DELETE /api/coupons/:id`

### Broadcast
- `POST /api/broadcast` — `{ message, parseMode }` → `{ sent, failed, total }`

### Settings
- `GET /api/settings`
- `PUT /api/settings`
- `POST /api/settings/apply-webhook`

### Storage
- `GET /api/storage/objects/:path` — serwowanie plików GCS (bez auth)

### Telegram
- `POST /api/telegram/webhook` — webhook Telegram (bez auth)

### Stats
- `GET /api/stats` — statystyki do dashboardu

---

## Zmienne środowiskowe (Secrets)

```
DATABASE_URL                    # PostgreSQL connection string
TELEGRAM_BOT_TOKEN              # Token bota z BotFather
SESSION_SECRET                  # Klucz JWT (losowy string)
ADMIN_PASSWORD                  # Hasło panelu admina (domyślnie: 2906)
DEFAULT_OBJECT_STORAGE_BUCKET_ID # ID bucketa GCS (Replit Object Storage)
PRIVATE_OBJECT_DIR              # Ścieżka do prywatnego katalogu GCS
PUBLIC_OBJECT_SEARCH_PATHS      # Ścieżki do publicznych plików GCS
```

---

## Kluczowe decyzje architektoniczne

1. **Single-message bot UI**: `editMessageText` zamiast `sendMessage` — brak spamu w czacie
2. **In-memory sessions**: Map<telegramId, BotSession> — proste, wystarczające dla single-instance
3. **Contract-first API**: OpenAPI spec → Orval codegen → React Query hooks + Zod validators
4. **Dead drop fulfillment**: Admin realizuje zamówienie przez panel → bot wysyła GPS + zdjęcie klientowi
5. **JWT httpOnly cookie**: Bezpieczna auth panelu admina, odporna na XSS
6. **Presigned URLs**: Upload plików bezpośrednio do GCS, serwer nie obsługuje dużych plików w pamięci
7. **Bonus system**: 10 bonusów = 1 PLN, wymiana przez wiadomość tekstową w bocie
8. **Referral system**: Link z kodem → nowy user → 10 bonusów dla referera

---

## Zasady sklepu (domyślne)

- Płatność: przelew natychmiastowy, BLIK, wpłatomat, kryptowaluty
- Skrytkę odebrać w ciągu 6 godzin od wydania
- Perezakład (powtórne wydanie) tylko dla klientów z historią zakupów
- Skrytka do odbioru wyłącznie osobiście
- Reklamacje tylko z materiałem wideo

---

## Wdrożenie (Replit)

1. Ustaw sekrety: `DATABASE_URL`, `TELEGRAM_BOT_TOKEN`, `SESSION_SECRET`, `ADMIN_PASSWORD`
2. Provisjonuj PostgreSQL i Object Storage w Replit
3. Uruchom: `pnpm --filter @workspace/db run push` (migracja DB)
4. Uruchom: `pnpm --filter @workspace/scripts run seed` (przykładowe dane)
5. Wdróż aplikację (Deployments → Deploy)
6. W panelu admina → Settings → wpisz webhook URL produkcyjny → kliknij "Ustaw Webhook"
7. Webhook URL format: `https://twoja-domena.replit.app/api/telegram/webhook`

---

## Rozszerzenia do implementacji (roadmap)

- [ ] System rabatów progowych (np. 5% po 5 zakupach)
- [ ] Powiadomienia push do admina (bot wysyła alert o nowym zamówieniu z linkiem do panelu)
- [ ] Eksport zamówień do CSV
- [ ] Automatyczne archiwizowanie starych zamówień
- [ ] Multi-admin support (wiele kont z różnymi uprawnieniami)
- [ ] Webhook do zewnętrznego systemu (np. Zapier/Make)
- [ ] QR kody dla skrytek
- [ ] System ocen produktów
- [ ] Automatyczna weryfikacja płatności BLIK przez API banku
- [ ] Integracja z kryptowalutami (monero, bitcoin) przez własne portfele

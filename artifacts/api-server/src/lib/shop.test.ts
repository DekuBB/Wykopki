import test, { after, before, mock } from "node:test";
import assert from "node:assert/strict";
import { createHmac, randomBytes } from "node:crypto";
import { getTableName } from "drizzle-orm";
import { db } from "@workspace/db";
import app from "../app";
import apiFunction from "./netlifyAdapter";
import { handleUpdate } from "./botHandler";
import type { AddressInfo } from "node:net";

const botToken = randomBytes(32).toString("hex");
process.env.TELEGRAM_BOT_TOKEN = botToken;
process.env.ADMIN_PASSWORD = randomBytes(32).toString("hex");
process.env.SESSION_SECRET = randomBytes(32).toString("hex");
delete process.env.ADMIN_TELEGRAM_ID;
const now = new Date();
const messages: Array<{ method: string; body: any }> = [];
const sessionRows = new Map<string, any>();
let insertedProduct: any;
let rejectTelegram = false;
const rows: Record<string, any[]> = {
  bot_settings: [{ id: 1, adminTelegramId: "12345", adminId: "12345", bonusExchangeRate: 10 }],
  bot_users: [{ id: 1, telegramId: "12345", firstName: "Test <name>", balance: "0", discountPercent: "0", bonuses: "0", purchaseCount: 0, referralCode: "ref-test" }],
  cities: [{ id: 1, name: "WARSZAWA", emoji: "🏙️", isActive: true, createdAt: now }],
  products: [{ id: 1, cityId: 1, categoryId: null, name: "Jabłka", pricePln: "20.00", emoji: null, weightGrams: null, createdAt: now, isActive: true }],
  categories: [], districts: [],
};
const server = app.listen(0, "127.0.0.1");
await new Promise<void>(resolve => server.once("listening", resolve));
const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
const actualFetch = globalThis.fetch;
let cookie = "";
function query(data: () => any[]) {
  const result: any = { then: (resolve: any) => Promise.resolve(data()).then(resolve) };
  for (const method of ["where", "orderBy", "limit"]) result[method] = () => result;
  return result;
}
before(() => {
  mock.method(db, "select", () => ({ from: (table: any) => query(() => getTableName(table) === "bot_sessions" ? [...sessionRows.values()] : rows[getTableName(table)] ?? []) }) as any);
  mock.method(db, "insert", (table: any) => ({ values: (value: any) => {
    if (getTableName(table) === "bot_sessions") return { onConflictDoUpdate: async () => { sessionRows.set(value.telegramId, { ...value, updatedAt: now }); } };
    insertedProduct = value;
    return { returning: async () => [{ ...value, id: 99, createdAt: now, updatedAt: now }] };
  } }) as any);
  mock.method(globalThis, "fetch", async (input: any, init?: any) => {
    if (String(input).startsWith("https://api.telegram.org/")) {
      const method = String(input).split("/").at(-1)!;
      const body = JSON.parse(init.body);
      messages.push({ method, body });
      if (rejectTelegram && method === "sendMessage") return Response.json({ ok: false, description: "Unavailable in test" });
      return Response.json({ ok: true, result: method === "getMe" ? { username: "leviafan5zzz_bot" } : { message_id: 9 } });
    }
    return actualFetch(input, init);
  });
});
after(() => { server.close(); mock.restoreAll(); });
function signedData(id: number, age = 0) {
  const params = new URLSearchParams({ auth_date: String(Math.floor(Date.now() / 1000) - age), user: JSON.stringify({ id, first_name: "Test" }) });
  const check = [...params.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${k}=${v}`).join("\n");
  const key = createHmac("sha256", "WebAppData").update(botToken).digest();
  params.set("hash", createHmac("sha256", key).update(check).digest("hex"));
  return params.toString();
}
async function post(path: string, body: unknown, session = "") {
  return fetch(url + path, { method: "POST", headers: { "Content-Type": "application/json", Cookie: session }, body: JSON.stringify(body) });
}
async function callback(data: string, id = 12345) {
  messages.length = 0;
  await handleUpdate({ callback_query: { id: "test", from: { id }, message: { chat: { id }, message_id: 9 }, data } });
}

test("anonymous admin access is rejected", async () => {
  assert.equal((await fetch(url + "/api/products")).status, 401);
});
test("a valid Telegram signature from a foreign account is rejected", async () => {
  assert.equal((await post("/api/auth/telegram", { initData: signedData(99999) })).status, 403);
});
test("old and tampered Telegram identity cannot log in", async () => {
  assert.equal((await post("/api/auth/telegram", { initData: signedData(12345, 600) })).status, 403);
  assert.equal((await post("/api/auth/telegram", { initData: signedData(12345).replace("12345", "99999") })).status, 403);
});
test("the configured administrator receives an httpOnly Telegram session", async () => {
  const result = await post("/api/auth/telegram", { initData: signedData(12345) });
  assert.equal(result.status, 200);
  assert.match(result.headers.get("set-cookie")!, /HttpOnly/i);
  cookie = result.headers.get("set-cookie")!.split(";")[0];
  assert.equal((await fetch(url + "/api/products", { headers: { Cookie: cookie } })).status, 200);
});
test("adding a product saves numeric fields and its category", async () => {
  const result = await post("/api/products", { name: "Jabłka", cityId: 1, pricePln: 25.50, weightGrams: 1000, categoryId: null }, cookie);
  assert.equal(result.status, 201);
  assert.equal(insertedProduct.pricePln, "25.5");
  assert.equal(insertedProduct.weightGrams, "1000");
  assert.equal((await result.json() as { pricePln: number }).pricePln, 25.5);
  assert.equal((await post("/api/products", { name: "Jabłka", cityId: 1, pricePln: -1 }, cookie)).status, 400);
});
test("buy product responds with active city buttons and persists conversation state", async () => {
  await callback("menu:buy");
  const message = messages.find(m => m.method === "editMessageText")!;
  assert.match(message.body.text, /Wybierz miasto/);
  assert.equal(message.body.reply_markup.inline_keyboard[0][0].callback_data, "city:1");
  assert.equal(sessionRows.get("12345").data.state, "buy:city");
});
test("city selection shows products and an unavailable district explains what happened", async () => {
  await callback("city:1");
  assert.ok(messages.find(m => m.method === "editMessageText")!.body.reply_markup.inline_keyboard.some((row: any[]) => row[0].callback_data === "product:1"));
  await callback("product:1");
  assert.match(messages.find(m => m.method === "editMessageText")!.body.text, /Brak dostępnych dzielnic/);
});
test("referral link targets this bot", async () => {
  await callback("account:referrals");
  assert.match(messages.find(m => m.method === "editMessageText")!.body.text, /https:\/\/t.me\/leviafan5zzz_bot\?start=ref-test/);
});
test("foreign accounts cannot open the administrator menu", async () => {
  await callback("admin:home", 99999);
  assert.ok(messages.some(m => m.body.text === "Brak uprawnień administratora."));
  assert.ok(!messages.some(m => m.body.reply_markup?.inline_keyboard?.some((row: any[]) => row.some(b => b.web_app))));
});
test("BLIK rejects amounts below 20 and displays fixed payment instructions for 20 PLN", async () => {
  await callback("topup:blik");
  const message = (text: string) => handleUpdate({ message: { message_id: 10, chat: { id: 12345 }, from: { id: 12345 }, text } });
  messages.length = 0;
  await message("19,99");
  assert.match(messages.at(-1)!.body.text, /minimum 20 PLN/);
  await message("20");
  assert.match(messages.at(-1)!.body.text, /20.00 PLN/);
  assert.match(messages.at(-1)!.body.text, /724 438 691/);
  assert.match(messages.at(-1)!.body.text, /19212906/);
  assert.equal(sessionRows.get("12345").data.state, "home");
});
test("invalid photo data is rejected before contacting storage", async () => {
  const response = await fetch(url + "/api/storage/upload/00000000-0000-0000-0000-000000000000", { method: "PUT", headers: { Cookie: cookie, "Content-Type": "image/png" }, body: "invalid PNG" });
  assert.equal(response.status, 400);
});

test("Netlify function serves JSON API responses and keeps session cookies", async () => {
  const login = await apiFunction(new Request(url + "/api/auth/telegram", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ initData: signedData(12345) }) }));
  assert.equal(login.status, 200);
  assert.match(login.headers.get("set-cookie")!, /HttpOnly/i);
  const response = await apiFunction(new Request(url + "/api/products", { headers: { Cookie: cookie } }));
  assert.equal(response.status, 200);
  assert.equal((await response.json() as any[])[0].name, "Jabłka");
});

test("failed Telegram fulfillment is reported instead of marking an order fulfilled", async () => {
  rows.orders = [{ id: 1, telegramId: "12345", productName: "Jabłka", districtName: "Centrum", status: "pending" }];
  rejectTelegram = true;
  try {
    const response = await post("/api/orders/1/fulfill", { fulfillmentNote: "Odbiór" }, cookie);
    assert.equal(response.status, 502);
    assert.equal(rows.orders[0].status, "pending");
  } finally { rejectTelegram = false; }
});

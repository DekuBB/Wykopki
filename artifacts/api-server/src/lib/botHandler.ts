import { db } from "@workspace/db";
import {
  usersTable,
  citiesTable,
  productsTable,
  districtsTable,
  ordersTable,
  settingsTable,
  productPhotosTable,
  couponsTable,
  categoriesTable,
} from "@workspace/db";
import { and, eq, sql } from "drizzle-orm";
import { randomBytes } from "crypto";
import {
  sendMessage,
  editMessageText,
  sendPhoto,
  answerCallbackQuery,
  mainMenuKeyboard,
  navButtons,
  makeInlineKeyboard,
  getBotToken,
  telegramApi,
} from "./telegram";
import { getSession, setSession, resetSession } from "./botSession";
import { logger } from "./logger";
import { isTelegramAdmin } from "./adminAccess";
import { siteUrl } from "./siteUrl";
function html(value: string) { return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }

import {
  createBalanceOrder,
  exchangeBonusesForBalance,
  redeemCouponForUser,
} from "./commerce";

function generateReferralCode(): string {
  return randomBytes(6).toString("base64url");
}

async function getOrCreateUser(
  telegramId: string,
  username?: string,
  firstName?: string,
  referralCode?: string
) {
  const existing = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.telegramId, telegramId))
    .limit(1);

  if (existing.length > 0) return existing[0];

  let referredById: number | undefined;
  if (referralCode) {
    const referrer = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.referralCode, referralCode))
      .limit(1);
    if (referrer.length > 0) {
      referredById = referrer[0].id;
      // Give referrer a bonus
      await db
        .update(usersTable)
        .set({ bonuses: sql`${usersTable.bonuses} + 10` })
        .where(eq(usersTable.id, referrer[0].id));
    }
  }

  const code = generateReferralCode();
  const [user] = await db
    .insert(usersTable)
    .values({
      telegramId,
      username: username ?? null,
      firstName: firstName ?? null,
      referralCode: code,
      referredById: referredById ?? null,
    })
    .returning();

  return user;
}

async function getSettings() {
  const rows = await db.select().from(settingsTable).limit(1);
  return rows[0] ?? null;
}

async function sendOrEditHome(
  token: string,
  chatId: string | number,
  user: { telegramId: string; firstName: string | null; balance: string; discountPercent: string; bonuses: string; purchaseCount: number },
  messageId?: number
): Promise<number | undefined> {
  const text =
    `<b>Witam ${html(user.firstName ?? user.telegramId)}</b>\n\n` +
    `<b>ID:</b> ${user.telegramId}\n` +
    `<b>Twoj Balans:</b> ${parseFloat(user.balance).toFixed(2)} PLN\n` +
    `<b>Rabat:</b> ${parseFloat(user.discountPercent).toFixed(1)}%\n` +
    `<b>Bonusy:</b> ${parseFloat(user.bonuses).toFixed(0)}\n` +
    `<b>Zakupy:</b> ${user.purchaseCount}`;

  const keyboard = mainMenuKeyboard(await isTelegramAdmin(user.telegramId));

  if (messageId) {
    await editMessageText(token, {
      chat_id: chatId,
      message_id: messageId,
      text,
      parse_mode: "HTML",
      reply_markup: keyboard,
    });
    return undefined;
  } else {
    const result = (await sendMessage(token, {
      chat_id: chatId,
      text,
      parse_mode: "HTML",
      reply_markup: keyboard,
    })) as { result?: { message_id?: number } };
    return result?.result?.message_id;
  }
}

export async function handleUpdate(update: Record<string, unknown>) {
  const token = await getBotToken();
  if (!token) {
    logger.warn("No bot token configured");
    return;
  }

  // Handle /start command
  if (update.message) {
    const message = update.message as {
      message_id: number;
      chat: { id: number };
      from?: { id: number; username?: string; first_name?: string };
      text?: string;
    };

    const chatId = message.chat.id;
    const telegramId = String(message.from?.id ?? chatId);
    const username = message.from?.username;
    const firstName = message.from?.first_name;
    const text = message.text ?? "";

    if (/^\/start(?:@\w+)?(?:\s|$)/.test(text)) {
      const parts = text.split(" ");
      const refCode = parts[1] ?? undefined;
      const user = await getOrCreateUser(telegramId, username, firstName, refCode);
      await resetSession(telegramId);
      const msgId = await sendOrEditHome(token, chatId, user);
      if (msgId) {
        await setSession(telegramId, { state: "home", lastMessageId: msgId });
      }
      return;
    }

    // Handle text input states
    if (text === "/admin") {
      if (String(chatId) !== telegramId || !(await isTelegramAdmin(telegramId))) {
        await sendMessage(token, { chat_id: chatId, text: "Brak uprawnień administratora." }); return;
      }
      await sendMessage(token, { chat_id: chatId, text: "Panel administratora", reply_markup: makeInlineKeyboard([
        [{ text: "Otwórz panel administratora", web_app: { url: siteUrl() + "/?telegram-admin=1" } }],
      ]) }); return;
    }
    const session = await getSession(telegramId);
    const user = await getOrCreateUser(telegramId, username, firstName);

    if (session.state === "topup:amount") {
      const value = text.trim().replace(",", ".");
      const amount = Number(value);
      if (!/^\d+(?:\.\d{1,2})?$/.test(value) || !Number.isFinite(amount) || amount < 20 || amount > 999999.99) {
        await sendMessage(token, { chat_id: chatId, text: "Wpisz kwotę w złotych (minimum 20 PLN, maksymalnie dwa miejsca po przecinku)." }); return;
      }
      await sendMessage(token, { chat_id: chatId,
        text: `<b>Doładowanie salda — BLIK</b>\n\nKwota: <b>${amount.toFixed(2)} PLN</b>\nNumer BLIK: <code>724 438 691</code>\nComment/Numer Zamówienia: <code>19212906</code>\n\nPo wpłacie skontaktuj się z operatorem. Saldo zostanie uzupełnione po weryfikacji wpłaty.`,
        parse_mode: "HTML", reply_markup: makeInlineKeyboard([[{ text: "Operator", callback_data: "menu:operator" }], ...navButtons()]),
      });
      await resetSession(telegramId); return;
    }

    if (session.state === "exchange:waiting") {
      const amount = parseInt(text.trim(), 10);
      const settings = await getSettings();
      const rate = settings?.bonusExchangeRate ?? 10;
      const currentBonuses = parseFloat(user.bonuses);

      if (isNaN(amount) || amount <= 0) {
        await sendMessage(token, { chat_id: chatId, text: "Podaj prawidlowa liczbe bonusow (liczba calkowita > 0)." });
        return;
      }
      if (amount > currentBonuses) {
        await sendMessage(token, { chat_id: chatId, text: `Niewystarczajaca liczba bonusow. Masz: <b>${Math.floor(currentBonuses)}</b>`, parse_mode: "HTML" });
        return;
      }
      const pln = amount / rate;
      const exchanged = await exchangeBonusesForBalance(telegramId, amount, rate);
      if (!exchanged) {
        await sendMessage(token, {
          chat_id: chatId,
          text: "Nie udało się wymienić bonusów. Spróbuj ponownie.",
        });
        return;
      }

      await resetSession(telegramId);
      await sendMessage(token, {
        chat_id: chatId,
        text: `Wymieniono <b>${amount}</b> bonusow na <b>${pln.toFixed(2)} PLN</b>.\nNowe saldo zostalo zaktualizowane.`,
        parse_mode: "HTML",
      });
      return;
    }

    if (session.state === "coupon:waiting") {
      const code = text.trim().toUpperCase();
      const pln = await redeemCouponForUser(telegramId, code);
      if (pln === null) {
        await sendMessage(token, { chat_id: chatId, text: "Kupon jest nieprawidlowy lub wyczerpany." });
        await resetSession(telegramId);
        return;
      }
      await resetSession(telegramId);
      await sendMessage(token, {
        chat_id: chatId,
        text: `Kupon aktywowany! Dodano <b>${pln.toFixed(2)} PLN</b> do Twojego salda.`,
        parse_mode: "HTML",
      });
      return;
    }

    return;
  }

  // Handle callback queries (button clicks)
  if (update.callback_query) {
    const cb = update.callback_query as {
      id: string;
      from: { id: number; username?: string; first_name?: string };
      message?: { chat: { id: number }; message_id: number };
      data?: string;
    };

    const callbackId = cb.id;
    const telegramId = String(cb.from.id);
    const chatId = cb.message?.chat.id ?? cb.from.id;
    const messageId = cb.message?.message_id;
    const data = cb.data ?? "";

    await answerCallbackQuery(token, callbackId).catch(() => undefined);

    const user = await getOrCreateUser(
      telegramId,
      cb.from.username,
      cb.from.first_name
    );

    const session = await getSession(telegramId);

    if (data.startsWith("admin:")) {
      if (String(chatId) !== telegramId || !(await isTelegramAdmin(telegramId))) {
        await sendMessage(token, { chat_id: chatId, text: "Brak uprawnień administratora." }); return;
      }
      await editMessageText(token, { chat_id: chatId, message_id: messageId!, text: "⚙️ Panel administratora\nZarządzaj sklepem bezpośrednio w Telegramie.",
        reply_markup: makeInlineKeyboard([
          ...[["Dashboard", "/"], ["Asortyment i kategorie", "/assortment"], ["Zamówienia", "/orders"], ["Użytkownicy i saldo", "/users"], ["Kupony i wiadomości", "/tools"], ["Ustawienia", "/settings"]].map(([text, path]) => [{ text, web_app: { url: siteUrl() + path + "?telegram-admin=1" } }]),
          ...navButtons(),
        ]),
      }); return;
    }

    // Navigation: home
    if (data === "nav:home") {
      await resetSession(telegramId);
      await sendOrEditHome(token, chatId, user, messageId);
      await setSession(telegramId, { state: "home", lastMessageId: messageId });
      return;
    }

    // Navigation: back
    if (data === "nav:back") {
      if (session.state === "buy:product") {
        // Go back to city selection
        await setSession(telegramId, { state: "home", lastMessageId: messageId });
        await handleBuyStart(token, chatId, messageId);
        return;
      }
      if (session.state === "buy:district") {
        // Go back to product selection
        await setSession(telegramId, {
          state: "buy:city",
          selectedCityId: session.selectedCityId,
          selectedCityName: session.selectedCityName,
          lastMessageId: messageId,
        });
        await handleCitySelected(
          token,
          chatId,
          messageId,
          session.selectedCityId!,
          session.selectedCityName!
        );
        return;
      }
      if (session.state === "buy:payment") {
        // Go back to district selection
        await setSession(telegramId, {
          state: "buy:product",
          selectedCityId: session.selectedCityId,
          selectedCityName: session.selectedCityName,
          selectedProductId: session.selectedProductId,
          selectedProductName: session.selectedProductName,
          selectedProductPrice: session.selectedProductPrice,
          lastMessageId: messageId,
        });
        await handleProductSelected(
          token,
          chatId,
          messageId,
          session.selectedCityId!,
          session.selectedCityName!,
          session.selectedProductId!,
          session.selectedProductName!,
          session.selectedProductPrice!
        );
        return;
      }
      // Default: home
      await resetSession(telegramId);
      await sendOrEditHome(token, chatId, user, messageId);
      return;
    }

    // Main menu handlers
    if (data === "menu:account") {
      await resetSession(telegramId);
      const accountText =
        `<b>Konto osobiste</b>\n\n` +
        `Profil: ${html(user.firstName ?? user.telegramId)}\n` +
        `ID: <code>${user.telegramId}</code>\n` +
        `Saldo: <b>${parseFloat(user.balance).toFixed(2)} PLN</b>\n` +
        `Rabat: ${parseFloat(user.discountPercent).toFixed(1)}%\n` +
        `Bonusy: <b>${parseFloat(user.bonuses).toFixed(0)}</b>\n` +
        `Zakupy: ${user.purchaseCount}`;

      await editMessageText(token, {
        chat_id: chatId,
        message_id: messageId!,
        text: accountText,
        parse_mode: "HTML",
        reply_markup: makeInlineKeyboard([
          [{ text: "Moje referaly", callback_data: "account:referrals" }],
          [{ text: "Historia zakupow", callback_data: "account:purchases" }],
          [{ text: "Doladuj saldo", callback_data: "menu:topup" }],
          [{ text: "Wymien punkty", callback_data: "account:exchange" }],
          [{ text: "Aktywuj kupon", callback_data: "account:coupon" }],
          [{ text: "Moje rezerwacje", callback_data: "account:reservations" }],
          ...navButtons(),
        ]),
      });
      return;
    }

    if (data === "account:referrals") {
      const settings = await getSettings();
      const me = await telegramApi(token, "getMe", {}) as { result?: { username?: string } };
      const botUsername = me.result?.username ?? "leviafan5zzz_bot";
      const refLink = `https://t.me/${botUsername}?start=${user.referralCode}`;
      const referrals = await db
        .select()
        .from(usersTable)
        .where(eq(usersTable.referredById, user.id));

      await editMessageText(token, {
        chat_id: chatId,
        message_id: messageId!,
        text:
          `<b>Moje referaly</b>\n\n` +
          `Zaproszonych uzytkownikow: <b>${referrals.length}</b>\n` +
          `Za kazde zaproszenie otrzymujesz <b>10 bonusow</b>.\n\n` +
          `<b>Twoj link referalny:</b>\n${refLink}`,
        parse_mode: "HTML",
        reply_markup: makeInlineKeyboard([
          [{ text: "Wstecz", callback_data: "menu:account" }, { text: "Dom", callback_data: "nav:home" }],
        ]),
      });
      return;
    }

    if (data === "account:purchases") {
      const purchases = await db
        .select()
        .from(ordersTable)
        .where(eq(ordersTable.telegramId, telegramId))
        .orderBy(ordersTable.createdAt)
        .limit(10);

      if (purchases.length === 0) {
        await editMessageText(token, {
          chat_id: chatId,
          message_id: messageId!,
          text: "<b>Historia zakupow</b>\n\nNie masz jeszcze zadnych zakupow.",
          parse_mode: "HTML",
          reply_markup: makeInlineKeyboard([
            [{ text: "Wstecz", callback_data: "menu:account" }, { text: "Dom", callback_data: "nav:home" }],
          ]),
        });
        return;
      }

      let historyText = `<b>Historia zakupow (ostatnie ${purchases.length})</b>\n\n`;
      for (const p of purchases) {
        const date = new Date(p.createdAt).toLocaleDateString("pl-PL", { day: "2-digit", month: "2-digit", year: "2-digit" });
        const statusIcon = p.status === "fulfilled" ? "✅" : "⏳";
        historyText += `${statusIcon} <b>#${p.id}</b> ${date}\n`;
        historyText += `   ${html(p.productName ?? "")} — ${parseFloat(p.amountPln).toFixed(2)} PLN\n`;
        historyText += `   ${html(p.cityName ?? "")} / ${html(p.districtName ?? "")}\n`;
        if (p.status === "fulfilled" && p.fulfillmentGps) {
          try {
            const { lat, lng } = JSON.parse(p.fulfillmentGps) as { lat: number; lng: number };
            historyText += `   GPS: ${lat.toFixed(6)}, ${lng.toFixed(6)}\n`;
          } catch { /* ignore */ }
        }
        historyText += "\n";
      }

      await editMessageText(token, {
        chat_id: chatId,
        message_id: messageId!,
        text: historyText,
        parse_mode: "HTML",
        reply_markup: makeInlineKeyboard([
          [{ text: "Wstecz", callback_data: "menu:account" }, { text: "Dom", callback_data: "nav:home" }],
        ]),
      });
      return;
    }

    if (data === "account:exchange") {
      const settings = await getSettings();
      const rate = settings?.bonusExchangeRate ?? 10;
      const currentBonuses = Math.floor(parseFloat(user.bonuses));
      await setSession(telegramId, { state: "exchange:waiting", lastMessageId: messageId });
      await editMessageText(token, {
        chat_id: chatId,
        message_id: messageId!,
        text:
          `<b>Wymiana bonusow</b>\n\n` +
          `Masz: <b>${currentBonuses} bonusow</b>\n` +
          `Kurs wymiany: <b>${rate} bonusow = 1 PLN</b>\n\n` +
          `Wprowadz liczbe bonusow do wymiany:`,
        parse_mode: "HTML",
        reply_markup: makeInlineKeyboard([
          [{ text: "Anuluj", callback_data: "menu:account" }],
        ]),
      });
      return;
    }

    if (data === "account:coupon") {
      await setSession(telegramId, { state: "coupon:waiting", lastMessageId: messageId });
      await editMessageText(token, {
        chat_id: chatId,
        message_id: messageId!,
        text: `<b>Aktywuj kupon</b>\n\nWpisz kod kuponu w oknie czatu:`,
        parse_mode: "HTML",
        reply_markup: makeInlineKeyboard([
          [{ text: "Anuluj", callback_data: "menu:account" }],
        ]),
      });
      return;
    }

    if (data === "account:reservations") {
      const reservations = await db
        .select()
        .from(ordersTable)
        .where(eq(ordersTable.telegramId, telegramId))
        .orderBy(ordersTable.createdAt)
        .limit(20);

      const pending = reservations.filter((r) => r.status === "pending");
      const fulfilled = reservations.filter((r) => r.status === "fulfilled");

      if (pending.length === 0 && fulfilled.length === 0) {
        await editMessageText(token, {
          chat_id: chatId,
          message_id: messageId!,
          text: "<b>Moje rezerwacje</b>\n\nBrak aktywnych rezerwacji.",
          parse_mode: "HTML",
          reply_markup: makeInlineKeyboard([
            [{ text: "Wstecz", callback_data: "menu:account" }, { text: "Dom", callback_data: "nav:home" }],
          ]),
        });
        return;
      }

      let resText = `<b>Moje rezerwacje</b>\n\n`;
      if (pending.length > 0) {
        resText += `<b>Oczekujace (${pending.length}):</b>\n`;
        for (const r of pending) {
          resText += `⏳ #${r.id} — ${html(r.productName ?? "")} (${html(r.districtName ?? "")})\n`;
        }
        resText += "\n";
      }
      if (fulfilled.length > 0) {
        resText += `<b>Zrealizowane (${fulfilled.length}):</b>\n`;
        for (const r of fulfilled.slice(-5)) {
          resText += `✅ #${r.id} — ${html(r.productName ?? "")}\n`;
        }
      }

      await editMessageText(token, {
        chat_id: chatId,
        message_id: messageId!,
        text: resText,
        parse_mode: "HTML",
        reply_markup: makeInlineKeyboard([
          [{ text: "Wstecz", callback_data: "menu:account" }, { text: "Dom", callback_data: "nav:home" }],
        ]),
      });
      return;
    }

    if (data === "menu:topup") {
      await resetSession(telegramId);
      const text =
        `<b>Doladuj swoje saldo</b>\n\n` +
        `Wybierz metode platnosci:\n` +
        `• <b>Odblaskiem (BLIK)</b> — skontaktuj sie z operatorem\n` +
        `• <b>Kryptowaluty</b> — wyslij krypto na podany adres\n\n` +
        `Po doladowaniu saldo zostanie zaktualizowane przez operatora.`;

      await editMessageText(token, {
        chat_id: chatId,
        message_id: messageId!,
        text,
        parse_mode: "HTML",
        reply_markup: makeInlineKeyboard([
          [{ text: "Uzupełnij odblaskiem (BLIK)", callback_data: "topup:blik" }],
          [{ text: "Doladuj kryptowalutami", callback_data: "topup:crypto" }],
          ...navButtons(),
        ]),
      });
      return;
    }

    if (data === "topup:blik") {
      await setSession(telegramId, { state: "topup:amount", lastMessageId: messageId });
      await editMessageText(token, { chat_id: chatId, message_id: messageId!,
        text: "Uzupełnij odblaskiem (BLIK)\n\nWpisz kwotę do wpłaty w złotych. Minimalna kwota do wpłaty to 20 PLN.",
        reply_markup: makeInlineKeyboard([[{ text: "Anuluj", callback_data: "menu:topup" }], ...navButtons()]),
      }); return;
    }
    if (data === "topup:crypto") {
      const settings = await getSettings();
      const operator = settings?.operatorUsername
        ? `@${settings.operatorUsername}`
        : "@Operator";
      const method = "kryptowaluty";
      await editMessageText(token, {
        chat_id: chatId,
        message_id: messageId!,
        text: `Aby doladowac saldo przez <b>${method}</b>, skontaktuj sie z operatorem:\n\n<b>OPERATOR:</b> ${operator}`,
        parse_mode: "HTML",
        reply_markup: makeInlineKeyboard(navButtons()),
      });
      return;
    }

    if (data === "menu:opinion") {
      await editMessageText(token, {
        chat_id: chatId,
        message_id: messageId!,
        text: "Prosimy o wystawienie opinii. Napisz do nas bezposrednio.",
        parse_mode: "HTML",
        reply_markup: makeInlineKeyboard(navButtons()),
      });
      return;
    }

    if (data === "menu:rules") {
      const settings = await getSettings();
      const rules =
        settings?.rulesText ??
        "1. Minimum zakupu: 1 porcja.\n2. Platnosc z gory.\n3. Zamowienie realizowane w ciagu 30 minut.\n4. Brak mozliwosci zwrotu.";
      await editMessageText(token, {
        chat_id: chatId,
        message_id: messageId!,
        text: `<b>Zasady</b>\n\n${rules}`,
        parse_mode: "HTML",
        reply_markup: makeInlineKeyboard(navButtons()),
      });
      return;
    }

    if (data === "menu:operator") {
      const settings = await getSettings();
      const operator = settings?.operatorUsername
        ? `@${settings.operatorUsername}`
        : "@Operator";
      await editMessageText(token, {
        chat_id: chatId,
        message_id: messageId!,
        text: `<b>OPERATOR:</b> ${operator}`,
        parse_mode: "HTML",
        reply_markup: makeInlineKeyboard(navButtons()),
      });
      return;
    }

    // Buy flow
    if (data === "menu:buy") {
      await setSession(telegramId, { state: "buy:city", lastMessageId: messageId });
      await handleBuyStart(token, chatId, messageId);
      return;
    }

    if (data.startsWith("city:")) {
      const cityId = parseInt(data.split(":")[1], 10);
      const cities = await db
        .select()
        .from(citiesTable)
        .where(eq(citiesTable.id, cityId));
      const city = cities[0];
      if (!city || !city.isActive) { await handleBuyStart(token, chatId, messageId); return; }
      await setSession(telegramId, {
        state: "buy:product",
        selectedCityId: city.id,
        selectedCityName: city.name,
        lastMessageId: messageId,
      });
      await handleCitySelected(token, chatId, messageId, city.id, city.name);
      return;
    }

    if (data.startsWith("product:")) {
      const productId = parseInt(data.split(":")[1], 10);
      const products = await db
        .select()
        .from(productsTable)
        .where(eq(productsTable.id, productId));
      const product = products[0];
      if (!product || !product.isActive) { await handleBuyStart(token, chatId, messageId); return; }
      const [productCity] = await db.select().from(citiesTable).where(and(eq(citiesTable.id, product.cityId), eq(citiesTable.isActive, true)));
      if (!productCity) { await handleBuyStart(token, chatId, messageId); return; }
      session.selectedCityId = productCity.id;
      session.selectedCityName = productCity.name;
      await setSession(telegramId, {
        state: "buy:district",
        selectedCityId: session.selectedCityId,
        selectedCityName: session.selectedCityName,
        selectedProductId: product.id,
        selectedProductName: product.name,
        selectedProductPrice: parseFloat(product.pricePln),
        lastMessageId: messageId,
      });
      await handleProductSelected(
        token,
        chatId,
        messageId,
        session.selectedCityId!,
        session.selectedCityName!,
        product.id,
        product.name,
        parseFloat(product.pricePln)
      );
      return;
    }

    if (data.startsWith("district:")) {
      const districtId = parseInt(data.split(":")[1], 10);
      const districts = await db
        .select()
        .from(districtsTable)
        .where(eq(districtsTable.id, districtId));
      const district = districts[0];
      if (!district || !district.isActive || district.cityId !== session.selectedCityId || !session.selectedProductId) {
        await handleBuyStart(token, chatId, messageId); return;
      }
      await setSession(telegramId, {
        state: "buy:payment",
        selectedCityId: session.selectedCityId,
        selectedCityName: session.selectedCityName,
        selectedProductId: session.selectedProductId,
        selectedProductName: session.selectedProductName,
        selectedProductPrice: session.selectedProductPrice,
        selectedDistrictId: district.id,
        selectedDistrictName: district.name,
        lastMessageId: messageId,
      });
      await editMessageText(token, {
        chat_id: chatId,
        message_id: messageId!,
        text:
          `Wybrales miasto: <b>${html(session.selectedCityName ?? "")}</b>\n` +
          `Produkt: <b>${html(session.selectedProductName ?? "")}</b>\n` +
          `Dzielnica: <b>${html(district.name ?? "")}</b>\n\n` +
          `Wybierz metode platnosci:\n\n` +
          `Zewnetrzne platnosci sa obecnie niedostepne. Mozesz uzyc srodkow na saldzie konta.`,
        parse_mode: "HTML",
        reply_markup: makeInlineKeyboard([
          [{ text: "Zaplac z salda konta", callback_data: "pay:balance" }],
          ...navButtons(),
        ]),
      });
      return;
    }

    if (data === "pay:blik" || data === "pay:crypto" || data === "pay:unavailable") {
      await editMessageText(token, {
        chat_id: chatId,
        message_id: messageId!,
        text: "Ta metoda płatności nie jest jeszcze skonfigurowana. Użyj salda konta.",
        parse_mode: "HTML",
        reply_markup: makeInlineKeyboard(navButtons()),
      });
      return;
    }

    if (data === "pay:balance") {
      if (session.state !== "buy:payment" || !session.selectedCityId || !session.selectedProductId || !session.selectedDistrictId) {
        await handleBuyStart(token, chatId, messageId); return;
      }
      const [product] = await db
        .select()
        .from(productsTable)
        .where(
          and(
            eq(productsTable.id, session.selectedProductId!),
            eq(productsTable.cityId, session.selectedCityId!),
            eq(productsTable.isActive, true),
          ),
        );
      const [district] = await db
        .select()
        .from(districtsTable)
        .where(
          and(
            eq(districtsTable.id, session.selectedDistrictId!),
            eq(districtsTable.cityId, session.selectedCityId!),
            eq(districtsTable.isActive, true),
          ),
        );

      if (!product || !district) {
        await editMessageText(token, {
          chat_id: chatId,
          message_id: messageId!,
          text: "Produkt lub dzielnica nie są już dostępne. Wybierz ponownie.",
          parse_mode: "HTML",
          reply_markup: makeInlineKeyboard(navButtons()),
        });
        await resetSession(telegramId);
        return;
      }

      const settingsForPurchase = await getSettings();
      if (Number(product.pricePln) < (settingsForPurchase?.minPurchaseAmount ?? 0)) {
        await editMessageText(token, { chat_id: chatId, message_id: messageId!, text: `Minimalna kwota zakupu to ${settingsForPurchase!.minPurchaseAmount} PLN. Wybierz inny produkt.`, reply_markup: makeInlineKeyboard(navButtons()) }); return;
      }
      const price = parseFloat(product.pricePln);
      const paymentResult = await createBalanceOrder({
        requestKey: `telegram:${callbackId}`,
        telegramId,
        cityId: session.selectedCityId!,
        cityName: session.selectedCityName!,
        productId: product.id,
        productName: product.name,
        amountPln: product.pricePln,
        districtId: district.id,
        districtName: district.name,
      });

      if (!paymentResult) {
        const balance = parseFloat(user.balance);
        await editMessageText(token, {
          chat_id: chatId,
          message_id: messageId!,
          text:
            `Niewystarczajace saldo!\n\n` +
            `Twoje saldo: <b>${balance.toFixed(2)} PLN</b>\n` +
            `Cena produktu: <b>${price.toFixed(2)} PLN</b>\n` +
            `Brakuje: <b>${(price - balance).toFixed(2)} PLN</b>\n\n` +
            `Prosimy o doladowanie konta.`,
          parse_mode: "HTML",
          reply_markup: makeInlineKeyboard([
            [{ text: "Doladuj saldo", callback_data: "menu:topup" }],
            ...navButtons(),
          ]),
        });
        return;
      }
      const { order, newBalance } = paymentResult;

      await editMessageText(token, {
        chat_id: chatId,
        message_id: messageId!,
        text:
          `Zamowienie zlecone!\n\n` +
          `Miasto: <b>${html(session.selectedCityName ?? "")}</b>\n` +
          `Produkt: <b>${html(product.name ?? "")}</b>\n` +
          `Dzielnica: <b>${html(district.name ?? "")}</b>\n` +
          `Platnosc: <b>Saldo konta</b>\n` +
          `Kwota: <b>${price.toFixed(2)} PLN</b>\n` +
          `Pozostale saldo: <b>${newBalance.toFixed(2)} PLN</b>\n\n` +
          `Zamowienie zostanie zrealizowane wkrotce. Dziekujemy!`,
        parse_mode: "HTML",
        reply_markup: makeInlineKeyboard(navButtons()),
      });

      // Send product photos to the buyer
      const photos = await db
        .select()
        .from(productPhotosTable)
        .where(eq(productPhotosTable.productId, session.selectedProductId!))
        .orderBy(productPhotosTable.createdAt);

      if (photos.length > 0) {
        const baseUrl = siteUrl();
        for (const photo of photos) {
          const photoUrl = `${baseUrl}/api/storage${photo.objectPath}`;
          await sendPhoto(token, {
            chat_id: chatId,
            photo: photoUrl,
            caption: photo.caption ?? `Zamowienie #${order.id} — lokalizacja skarbu`,
            parse_mode: "HTML",
          }).catch((e) => logger.warn({ e }, "Failed to send product photo"));
        }
      }

      // Notify admin
      const settings = await getSettings();
      if (settings?.adminTelegramId && settings.adminTelegramId.trim()) {
        const adminMsg =
          `NOWE ZAMOWIENIE #${order.id}\n\n` +
          `Uzytkownik: ${user.firstName ?? ""} (@${user.username ?? ""}) [${telegramId}]\n` +
          `Miasto: ${html(session.selectedCityName ?? "")}\n` +
          `Produkt: ${html(session.selectedProductName ?? "")}\n` +
          `Dzielnica: ${html(session.selectedDistrictName ?? "")}\n` +
          `Platnosc: Saldo konta\n` +
          `Kwota: ${price.toFixed(2)} PLN`;
        await sendMessage(token, {
          chat_id: settings.adminTelegramId.trim(),
          text: adminMsg,
        }).catch((e) => logger.warn({ e }, "Failed to notify admin"));
      }

      await resetSession(telegramId);
      return;
    }
  }
}

async function handleBuyStart(
  token: string,
  chatId: number,
  messageId?: number
) {
  const cities = await db
    .select()
    .from(citiesTable)
    .where(eq(citiesTable.isActive, true));

  const cityButtons = cities.map((c) => [
    {
      text: `${c.emoji ?? ""} ${c.name}`.trim(),
      callback_data: `city:${c.id}`,
    },
  ]);

  await editMessageText(token, {
    chat_id: chatId,
    message_id: messageId!,
    text: cities.length ? "Kupić! Wybierz miasto." : "Brak aktywnych miast. Wróć później lub skontaktuj się z operatorem.",
    parse_mode: "HTML",
    reply_markup: makeInlineKeyboard([...cityButtons, ...navButtons()]),
  });
}

async function handleCitySelected(
  token: string,
  chatId: number,
  messageId: number | undefined,
  cityId: number,
  cityName: string
) {
  const products = await db
    .select()
    .from(productsTable)
    .where(eq(productsTable.cityId, cityId));

  const categories = await db.select().from(categoriesTable);
  const categoryById = new Map(categories.map(c => [c.id, c]));
  const productButtons = products
    .filter((p) => p.isActive && (p.categoryId == null || categoryById.get(p.categoryId)?.isActive))
    .map((p) => [
      {
        text: `${p.emoji ?? ""} ${p.categoryId ? (categoryById.get(p.categoryId)?.name ?? "") + " · " : ""}${p.name} ${p.weightGrams ? p.weightGrams + "g" : ""} - ${parseFloat(p.pricePln).toFixed(0)} PLN`.trim(),
        callback_data: `product:${p.id}`,
      },
    ]);

  await editMessageText(token, {
    chat_id: chatId,
    message_id: messageId!,
    text: `Wybrałeś miasto: <b>${html(cityName)}</b>\n${productButtons.length ? "Wybierz produkt:" : "Brak aktywnych produktów w tym mieście."}`,
    parse_mode: "HTML",
    reply_markup: makeInlineKeyboard([...productButtons, ...navButtons()]),
  });
}

async function handleProductSelected(
  token: string,
  chatId: number,
  messageId: number | undefined,
  cityId: number,
  cityName: string,
  _productId: number,
  productName: string,
  _productPrice: number
) {
  const districts = await db
    .select()
    .from(districtsTable)
    .where(eq(districtsTable.cityId, cityId));

  const districtButtons = districts
    .filter((d) => d.isActive)
    .map((d) => [
      {
        text: d.name,
        callback_data: `district:${d.id}`,
      },
    ]);

  await editMessageText(token, {
    chat_id: chatId,
    message_id: messageId!,
    text: `Wybrałeś miasto: <b>${html(cityName)}</b>\nProdukt: <b>${html(productName)}</b>\n${districtButtons.length ? "Wybierz dzielnicę:" : "Brak dostępnych dzielnic. Skontaktuj się z operatorem."}`,
    parse_mode: "HTML",
    reply_markup: makeInlineKeyboard([...districtButtons, ...navButtons()]),
  });
}

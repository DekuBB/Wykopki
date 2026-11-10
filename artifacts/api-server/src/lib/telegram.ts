import { logger } from "./logger";
import { db, settingsTable } from "@workspace/db";
import { getRequiredSecret } from "./security";

interface TelegramMessage {
  chat_id: string | number;
  text: string;
  parse_mode?: "HTML" | "Markdown" | "MarkdownV2";
  reply_markup?: object;
}

interface TelegramEditMessage {
  chat_id: string | number;
  message_id: number;
  text: string;
  parse_mode?: "HTML" | "Markdown" | "MarkdownV2";
  reply_markup?: object;
}

export type InlineButton =
  | { text: string; callback_data: string }
  | { text: string; url: string }
  | { text: string; web_app: { url: string } };

export async function getBotToken(): Promise<string | null> {
  const token = getRequiredSecret("TELEGRAM_BOT_TOKEN");
  if (token) return token;
  const [settings] = await db.select({ botToken: settingsTable.botToken }).from(settingsTable).limit(1);
  return settings?.botToken ?? null;
}

export async function telegramApi(
  token: string,
  method: string,
  body: object
): Promise<unknown> {
  const url = `https://api.telegram.org/bot${token}/${method}`;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15000),
    });
    const data = (await res.json()) as { ok: boolean; description?: string; result?: unknown };
    if (!data.ok) {
      if (method === "editMessageText" && data.description?.includes("message is not modified")) return data;
      throw new Error(`Telegram ${method} failed`);
    }
    return data;
  } catch (err) {
    logger.error({ method }, "Telegram API request failed");
    throw new Error(`Telegram ${method} failed`);
  }
}

export async function sendMessage(
  token: string,
  params: TelegramMessage
): Promise<unknown> {
  return telegramApi(token, "sendMessage", params);
}

export async function editMessageText(
  token: string,
  params: TelegramEditMessage
): Promise<unknown> {
  return telegramApi(token, "editMessageText", params);
}

export async function answerCallbackQuery(
  token: string,
  callbackQueryId: string,
  text?: string
): Promise<unknown> {
  return telegramApi(token, "answerCallbackQuery", {
    callback_query_id: callbackQueryId,
    text: text ?? "",
  });
}

export async function sendPhoto(
  token: string,
  params: {
    chat_id: string | number;
    photo: string;
    caption?: string;
    parse_mode?: "HTML" | "Markdown";
    reply_markup?: object;
  }
): Promise<unknown> {
  return telegramApi(token, "sendPhoto", params);
}

export async function sendLocation(
  token: string,
  params: {
    chat_id: string | number;
    latitude: number;
    longitude: number;
  }
): Promise<unknown> {
  return telegramApi(token, "sendLocation", params);
}

export async function setWebhook(
  token: string,
  webhookUrl: string,
  secretToken: string
): Promise<unknown> {
  return telegramApi(token, "setWebhook", {
    url: webhookUrl,
    secret_token: secretToken,
  });
}

export function makeInlineKeyboard(buttons: Array<InlineButton[]>) {
  return {
    inline_keyboard: buttons,
  };
}

export function mainMenuKeyboard(admin = false) {
  return makeInlineKeyboard([
    ...(admin ? [[{ text: "⚙️ Panel administratora", callback_data: "admin:home" }]] : []),
    [{ text: "Konto osobiste", callback_data: "menu:account" }],
    [{ text: "Doładuj swoje saldo", callback_data: "menu:topup" }],
    [{ text: "Kup produkt", callback_data: "menu:buy" }],
    [{ text: "★Opinia★", callback_data: "menu:opinion" }],
    [{ text: "Zasady", url: "https://telegra.ph/XxXLeviaFanXxX-11-10" }],
    [{ text: "Operator", callback_data: "menu:operator" }],
  ]);
}

export function navButtons(extra?: InlineButton[]): InlineButton[][] {
  const row: InlineButton[] = [
    { text: "🔙 Wstecz", callback_data: "nav:back" },
    { text: "🔹 Dom", callback_data: "nav:home" },
  ];
  return extra ? [extra, row] : [row];
}

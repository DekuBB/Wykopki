import { logger } from "./logger";

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
  | { text: string; url: string };

export async function getBotToken(): Promise<string | null> {
  return process.env.TELEGRAM_BOT_TOKEN ?? null;
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
    });
    const data = (await res.json()) as { ok: boolean; description?: string; result?: unknown };
    if (!data.ok) {
      logger.warn({ method, error: data.description }, "Telegram API error");
    }
    return data;
  } catch (err) {
    logger.error({ method, err }, "Telegram API request failed");
    throw err;
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

export function mainMenuKeyboard() {
  return makeInlineKeyboard([
    [{ text: "Konto osobiste", callback_data: "menu:account" }],
    [{ text: "Doladuj swoje saldo", callback_data: "menu:topup" }],
    [{ text: "Kup produkt", callback_data: "menu:buy" }],
    [{ text: "Opinia", callback_data: "menu:opinion" }],
    [{ text: "Zasady", url: "https://telegra.ph/GuaKamole-05-15-3" }],
    [{ text: "Operator", callback_data: "menu:operator" }],
  ]);
}

export function navButtons(extra?: InlineButton[]): InlineButton[][] {
  const row: InlineButton[] = [
    { text: "Wstecz", callback_data: "nav:back" },
    { text: "Dom", callback_data: "nav:home" },
  ];
  return extra ? [extra, row] : [row];
}

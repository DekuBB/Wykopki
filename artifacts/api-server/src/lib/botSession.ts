// In-memory session storage for bot conversation state
// Each user's state is keyed by their Telegram ID

export interface BotSession {
  state:
    | "home"
    | "buy:city"
    | "buy:product"
    | "buy:district"
    | "buy:payment"
    | "topup"
    | "opinion"
    | "exchange:waiting"
    | "coupon:waiting";
  selectedCityId?: number;
  selectedCityName?: string;
  selectedProductId?: number;
  selectedProductName?: string;
  selectedProductPrice?: number;
  selectedDistrictId?: number;
  selectedDistrictName?: string;
  lastMessageId?: number;
}

const sessions = new Map<string, BotSession>();

export function getSession(telegramId: string): BotSession {
  if (!sessions.has(telegramId)) {
    sessions.set(telegramId, { state: "home" });
  }
  return sessions.get(telegramId)!;
}

export function setSession(telegramId: string, session: BotSession): void {
  sessions.set(telegramId, session);
}

export function resetSession(telegramId: string): void {
  sessions.set(telegramId, { state: "home" });
}

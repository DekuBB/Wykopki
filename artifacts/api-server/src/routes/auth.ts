import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import jwt from "jsonwebtoken";
import { logger } from "../lib/logger";
import { getRequiredSecret, secretsMatch } from "../lib/security";

import { validateTelegramInitData } from "./telegram-mini-app";
import { getBotToken } from "../lib/telegram";
import { isTelegramAdmin } from "../lib/adminAccess";

const router: IRouter = Router();


const COOKIE_NAME = "admin_session";

export async function authMiddleware(req: Request, res: Response, next: NextFunction): Promise<void> {
  const skip =
    req.path === "/healthz" ||
    req.path.startsWith("/auth") ||
    req.path === "/telegram/webhook" ||
    req.path.startsWith("/telegram/app") ||
    req.path.startsWith("/storage/objects/");

  if (skip) {
    next();
    return;
  }

  const jwtSecret = getRequiredSecret("SESSION_SECRET");
  if (!jwtSecret) {
    res.status(503).json({ error: "Authentication is not configured" });
    return;
  }

  const token = req.cookies?.[COOKIE_NAME];
  if (!token) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  try {
    const payload = jwt.verify(token, jwtSecret);
    if (typeof payload !== "object" || payload.role !== "admin") {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    if (payload.telegramId && !(await isTelegramAdmin(String(payload.telegramId)))) {
      res.status(403).json({ error: "Brak uprawnień administratora" }); return;
    }
    next();
  } catch {
    res.status(401).json({ error: "Unauthorized" });
  }
}

router.post("/auth/telegram", async (req, res): Promise<void> => {
  const secret = getRequiredSecret("SESSION_SECRET");
  const botToken = await getBotToken();
  if (!secret || !botToken) { res.status(503).json({ error: "Logowanie nie jest skonfigurowane" }); return; }
  const initData = req.body?.initData;
  const identity = typeof initData === "string" && initData.length <= 10000 ? validateTelegramInitData(initData, botToken) : null;
  const date = typeof initData === "string" ? Number(new URLSearchParams(initData).get("auth_date")) : 0;
  if (!identity || Date.now() / 1000 - date > 300 || !(await isTelegramAdmin(String(identity.telegramUser.id)))) {
    res.clearCookie(COOKIE_NAME);
    res.status(403).json({ error: "To konto Telegram nie ma uprawnień administratora." }); return;
  }
  const token = jwt.sign({ role: "admin", telegramId: String(identity.telegramUser.id) }, secret, { expiresIn: "1h" });
  res.cookie(COOKIE_NAME, token, { httpOnly: true, secure: true, sameSite: "strict", maxAge: 3600000, path: "/" });
  res.json({ ok: true });
});

router.post("/auth/login", (req: Request, res: Response): void => {
  const { password } = req.body as { password?: string };
  const jwtSecret = getRequiredSecret("SESSION_SECRET");
  const adminPassword = getRequiredSecret("ADMIN_PASSWORD");

  if (!jwtSecret || !adminPassword) {
    res.status(503).json({ error: "Authentication is not configured" });
    return;
  }

  if (!password || !secretsMatch(adminPassword, password)) {
    logger.warn({ ip: req.ip }, "Failed admin login attempt");
    res.status(401).json({ error: "Nieprawidlowe haslo" });
    return;
  }

  const token = jwt.sign({ role: "admin" }, jwtSecret, { expiresIn: "7d" });
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
  logger.info({ ip: req.ip }, "Admin logged in");
  res.json({ ok: true });
});

router.post("/auth/logout", (_req: Request, res: Response): void => {
  res.clearCookie(COOKIE_NAME);
  res.json({ ok: true });
});

router.get("/auth/me", async (req: Request, res: Response): Promise<void> => {
  const token = req.cookies?.[COOKIE_NAME];
  if (!token) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const jwtSecret = getRequiredSecret("SESSION_SECRET");
  if (!jwtSecret) {
    res.status(503).json({ error: "Authentication is not configured" });
    return;
  }

  try {
    const payload = jwt.verify(token, jwtSecret);
    if (typeof payload !== "object" || payload.role !== "admin") {
      res.status(401).json({ error: "Not authenticated" });
      return;
    }
    if (payload.telegramId && !(await isTelegramAdmin(String(payload.telegramId)))) {
      res.status(403).json({ error: "Brak uprawnień administratora" }); return;
    }
    res.json({ ok: true, role: "admin" });
  } catch {
    res.status(401).json({ error: "Not authenticated" });
  }
});

export default router;

import express, { type Express } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";
import { authMiddleware } from "./routes/auth";

const app: Express = express();

app.disable("x-powered-by");
app.set("trust proxy", 1);

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);

const configuredOrigins = new Set(
  (process.env.REPLIT_DOMAINS ?? "")
    .split(",")
    .map((domain) => domain.trim())
    .filter(Boolean)
    .flatMap((domain) => [
      domain,
      domain.startsWith("http://") || domain.startsWith("https://")
        ? domain
        : `https://${domain}`,
    ]),
);

app.use(
  cors({
    credentials: true,
    origin: (origin, callback) => {
      if (
        !origin ||
        configuredOrigins.has(origin) ||
        /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)
      ) {
        callback(null, true);
        return;
      }
      callback(new Error("Origin is not allowed"));
    },
  }),
);
app.use(express.json({ limit: "256kb" }));
app.use(express.urlencoded({ extended: false, limit: "32kb" }));
app.use(cookieParser());

app.use("/api", authMiddleware);
app.use("/api", router);

export default app;

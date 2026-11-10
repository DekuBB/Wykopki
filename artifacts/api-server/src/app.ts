import express, { type Express, type Request, type Response, type NextFunction } from "express";
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

app.use(express.json({ limit: "256kb" }));
app.use(express.urlencoded({ extended: false, limit: "32kb" }));
app.use(cookieParser());

app.use("/api", authMiddleware);
app.use("/api", router);

app.use((error: { status?: number; code?: string }, req: Request, res: Response, _next: NextFunction) => {
  const status = error.status ?? (error.code === "23505" || error.code === "23503" ? 409 : 500);
  req.log.error({ code: error.code, status }, "API request failed");
  res.status(status).json({ error: status === 413 ? "Zdjęcie jest za duże. Maksymalnie 4 MB." : status === 409 ? "Ten wpis już istnieje lub jest używany przez inne dane." : "Nie udało się wykonać operacji. Spróbuj ponownie." });
});
export default app;

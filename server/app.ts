import cors from "cors";
import express from "express";
import session from "express-session";
import { alpacaBrokerageRouter } from "./alpaca/brokerageRoutes";
import { portfolioRouter } from "./src/portfolio/portfolioRoutes";
import { clawfolioRouter } from "./src/routes/clawfolioRoutes";

export function loadSessionSecret(): string {
  return (
    process.env.SESSION_SECRET?.trim() ||
    (process.env.NODE_ENV === "production"
      ? (() => {
          throw new Error("SESSION_SECRET is required in production.");
        })()
      : "openclaw-dev-session-secret-not-for-production")
  );
}

export function createApp(): express.Express {
  const app = express();
  app.disable("x-powered-by");
  app.use(
    cors({
      origin: true,
      credentials: true,
    }),
  );
  app.use(
    session({
      name: "oc.sid",
      secret: loadSessionSecret(),
      resave: false,
      saveUninitialized: false,
      cookie: {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        maxAge: 14 * 24 * 60 * 60 * 1000,
      },
    }),
  );
  app.use(express.json({ limit: "256kb" }));

  app.get("/health", (_req, res) => {
    res.json({ ok: true });
  });

  app.use("/api/brokerage/alpaca", alpacaBrokerageRouter);
  app.use("/api/portfolio", portfolioRouter);
  app.use("/api/clawfolio", clawfolioRouter);

  app.use(
    (
      _req: express.Request,
      res: express.Response,
      _next: express.NextFunction,
    ) => {
      res.status(404).json({ error: { code: "NOT_FOUND", message: "Not found" } });
    },
  );

  return app;
}

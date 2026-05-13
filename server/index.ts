import "dotenv/config";
import cors from "cors";
import express from "express";
import session from "express-session";
import { alpacaBrokerageRouter } from "./alpaca/brokerageRoutes";

const port = Number(process.env.PORT ?? 8787);

const sessionSecret =
  process.env.SESSION_SECRET?.trim() ||
  (process.env.NODE_ENV === "production"
    ? (() => {
        throw new Error("SESSION_SECRET is required in production.");
      })()
    : "openclaw-dev-session-secret-not-for-production");

if (
  sessionSecret === "openclaw-dev-session-secret-not-for-production"
) {
  console.warn(
    "[openclaw] Using insecure SESSION_SECRET default; set SESSION_SECRET in .env.",
  );
}

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
    secret: sessionSecret,
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

app.use(
  (
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction,
  ) => {
    res.status(404).json({ error: { code: "NOT_FOUND", message: "Not found" } });
  },
);

app.listen(port, () => {
  console.log(`OpenClaw API listening on http://127.0.0.1:${port}`);
});

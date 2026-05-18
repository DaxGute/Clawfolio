import "dotenv/config";
import { createApp } from "./app";
import { logPortfolioAlpacaAuthMode } from "./src/alpaca/resolveAlpacaReadOnlyClient";

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

logPortfolioAlpacaAuthMode();

const app = createApp();

app.listen(port, () => {
  console.log(`OpenClaw API listening on http://127.0.0.1:${port}`);
});

import "dotenv/config";
import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { auth } from "./routes/auth.js";
import { submissions } from "./routes/submissions.js";
import { agreementsRoute } from "./routes/agreements.js";
import { edits } from "./routes/edits.js";
import { moderation } from "./routes/moderation.js";
import { getSessionUser, type AppEnv } from "./middleware.js";

const app = new Hono<AppEnv>();

app.use(logger());

// Browser origins allowed to send credentialed requests. Localhost is always
// permitted for development; deployments must list their site origin in
// WEB_ORIGIN (comma-separated) or the site cannot talk to the API at all.
const allowedOrigins = (process.env.WEB_ORIGIN ?? "")
  .split(",")
  .map((o) => o.trim().replace(/\/$/, ""))
  .filter(Boolean);

app.use(
  "*",
  cors({
    origin: (origin) => {
      if (!origin) return origin;
      const normalized = origin.replace(/\/$/, "");
      if (allowedOrigins.includes(normalized)) return origin;
      if (process.env.NODE_ENV !== "production" && /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(normalized)) {
        return origin;
      }
      return null;
    },
    credentials: true,
  }),
);

app.use("*", async (c, next) => {
  const user = await getSessionUser(getCookieValue(c));
  if (user) c.set("user", user);
  await next();
});

function getCookieValue(c: { req: { header: (n: string) => string | undefined } }): string | undefined {
  const cookieHeader = c.req.header("cookie");
  if (!cookieHeader) return undefined;
  const match = cookieHeader.match(/(?:^|;\s*)session=([^;]+)/);
  return match?.[1];
}

app.get("/healthz", (c) => c.json({ ok: true }));

app.route("/auth", auth);
app.route("/submissions", submissions);
app.route("/agreements", agreementsRoute);
app.route("/", edits);
app.route("/moderation", moderation);

app.onError((err, c) => {
  console.error(err);
  return c.json({ error: "internal server error" }, 500);
});

const port = Number(process.env.PORT ?? 3000);
serve({ fetch: app.fetch, port }, (info) => {
  console.log(`api listening on http://localhost:${info.port}`);
});

import { Hono } from "hono";
import { eq } from "drizzle-orm";
import { hash, verify } from "@node-rs/argon2";
import { z } from "zod";
import { db, users } from "@collective/db";
import {
  createSession,
  setSessionCookie,
  clearSessionCookie,
  requireAuth,
  type AppEnv,
} from "../middleware.js";

export const auth = new Hono<AppEnv>();

const Credentials = z.object({
  email: z.string().email().max(200),
  password: z.string().min(8).max(200),
});

function randomHandle(): string {
  return `editor-${Math.random().toString(36).slice(2, 8)}`;
}

auth.post("/register", async (c) => {
  const body = Credentials.safeParse(await c.req.json());
  if (!body.success) return c.json({ error: "invalid input" }, 400);
  const email = body.data.email.toLowerCase();
  const existing = await db.select({ id: users.id }).from(users).where(eq(users.email, email));
  if (existing.length > 0) return c.json({ error: "email already registered" }, 409);
  const passwordHash = await hash(body.data.password);
  const [user] = await db
    .insert(users)
    .values({ email, passwordHash, displayName: randomHandle() })
    .returning({ id: users.id, email: users.email, role: users.role });
  const sid = await createSession(user.id);
  setSessionCookie(c, sid);
  return c.json({ user }, 201);
});

auth.post("/login", async (c) => {
  const body = Credentials.safeParse(await c.req.json());
  if (!body.success) return c.json({ error: "invalid input" }, 400);
  const email = body.data.email.toLowerCase();
  const [user] = await db.select().from(users).where(eq(users.email, email));
  if (!user || !(await verify(user.passwordHash, body.data.password))) {
    return c.json({ error: "invalid credentials" }, 401);
  }
  const sid = await createSession(user.id);
  setSessionCookie(c, sid);
  return c.json({
    user: { id: user.id, email: user.email, role: user.role },
  });
});

auth.post("/logout", async (c) => {
  clearSessionCookie(c);
  return c.json({ ok: true });
});

auth.get("/me", requireAuth, (c) => c.json(c.get("user")));

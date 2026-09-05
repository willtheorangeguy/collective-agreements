import { createMiddleware } from "hono/factory";
import { getCookie, setCookie, deleteCookie } from "hono/cookie";
import { and, eq, gt } from "drizzle-orm";
import { z } from "zod";
import { db, sessions, users } from "@collective/db";
import type { UserRole } from "@collective/shared";

export const SESSION_COOKIE = "session";
const UUID = z.string().uuid();

const SESSION_DAYS = 30;

export async function createSession(userId: string): Promise<string> {
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  const [row] = await db.insert(sessions).values({ userId, expiresAt }).returning();
  return row.id;
}

export function setSessionCookie(c: { header: (k: string, v: string) => void }, id: string): void {
  setCookie(c as never, SESSION_COOKIE, id, {
    httpOnly: true,
    sameSite: "Lax",
    path: "/",
    secure: process.env.NODE_ENV === "production",
    maxAge: SESSION_DAYS * 24 * 60 * 60,
  });
}

export function clearSessionCookie(c: Parameters<typeof deleteCookie>[0]): void {
  deleteCookie(c, SESSION_COOKIE, { path: "/" });
}

export interface AuthUser {
  id: string;
  email: string;
  displayName: string;
  role: UserRole;
}

export interface AppEnv {
  Variables: { user: AuthUser };
}

export async function getSessionUser(sessionId: string | undefined): Promise<AuthUser | null> {
  if (!sessionId || !UUID.safeParse(sessionId).success) return null;
  const [row] = await db
    .select({
      id: users.id,
      email: users.email,
      displayName: users.displayName,
      role: users.role,
    })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(and(eq(sessions.id, sessionId), gt(sessions.expiresAt, new Date())));
  return row ?? null;
}

type Env = AppEnv;

export const requireAuth = createMiddleware<Env>(async (c, next) => {
  const user = await getSessionUser(getCookie(c, SESSION_COOKIE));
  if (!user) return c.json({ error: "unauthorized" }, 401);
  c.set("user", user);
  await next();
});

export const requireRole =
  (...roles: UserRole[]) =>
  createMiddleware<Env>(async (c, next) => {
    const user: AuthUser | undefined = c.get("user");
    if (!user || !roles.includes(user.role)) return c.json({ error: "forbidden" }, 403);
    await next();
  });

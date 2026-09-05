import { Hono } from "hono";
import { asc, desc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db, agreements, auditLog, revisions, users } from "@collective/db";
import { TRUSTED_AFTER_ACCEPTED_EDITS } from "@collective/shared";
import { requireAuth, requireRole, type AppEnv } from "../middleware.js";

export const moderation = new Hono<AppEnv>();

moderation.use("*", requireAuth, requireRole("moderator", "admin"));

moderation.get("/pending", async (c) => {
  const rows = await db
    .select({
      revisionId: revisions.id,
      agreementSlug: agreements.slug,
      fields: revisions.fields,
      editSummary: revisions.editSummary,
      createdAt: revisions.createdAt,
      editorName: users.displayName,
      editorAcceptedEdits: users.acceptedEdits,
      // The content the edit was proposed against, so the queue can show a diff
      // instead of a wall of JSON.
      currentFields: sql`(
        select r2.fields from revisions r2 where r2.id = ${agreements.currentRevisionId}
      )`,
    })
    .from(revisions)
    .innerJoin(agreements, eq(agreements.id, revisions.agreementId))
    .leftJoin(users, eq(users.id, revisions.editorId))
    .where(eq(revisions.status, "pending"))
    .orderBy(asc(revisions.createdAt))
    .limit(100);
  return c.json({ items: rows });
});

const Decision = z.object({
  decision: z.enum(["approve", "reject"]),
  note: z.string().max(1000).optional(),
});

moderation.post("/revisions/:id/decision", async (c) => {
  const moderator = c.get("user");
  const id = c.req.param("id");
  const body = Decision.safeParse(await c.req.json());
  if (!body.success) return c.json({ error: "invalid input" }, 400);

  const [revision] = await db.select().from(revisions).where(eq(revisions.id, id));
  if (!revision) return c.json({ error: "not found" }, 404);
  if (revision.status !== "pending") return c.json({ error: "already reviewed" }, 409);

  const approving = body.data.decision === "approve";

  const [updated] = await db
    .update(revisions)
    .set({
      status: approving ? "approved" : "rejected",
      reviewerId: moderator.id,
      reviewNote: body.data.note ?? null,
      reviewedAt: new Date(),
    })
    .where(eq(revisions.id, id))
    .returning();

  if (approving && revision.editorId) {
    const [editor] = await db
      .update(users)
      .set({ acceptedEdits: sql`${users.acceptedEdits} + 1` })
      .where(eq(users.id, revision.editorId))
      .returning();
    if (
      editor &&
      editor.role === "user" &&
      editor.acceptedEdits >= TRUSTED_AFTER_ACCEPTED_EDITS
    ) {
      await db.update(users).set({ role: "trusted" }).where(eq(users.id, editor.id));
      await db.insert(auditLog).values({
        actorId: moderator.id,
        action: "user.auto_trusted",
        targetType: "user",
        targetId: editor.id,
        detail: { acceptedEdits: editor.acceptedEdits },
      });
    }
  }

  if (approving) {
    await db
      .update(agreements)
      .set({ currentRevisionId: updated.id, updatedAt: new Date() })
      .where(eq(agreements.id, updated.agreementId));
  }

  await db.insert(auditLog).values({
    actorId: moderator.id,
    action: `revision.${body.data.decision}d`,
    targetType: "revision",
    targetId: id,
    detail: { note: body.data.note },
  });

  return c.json({ ok: true, status: updated.status });
});

const Revert = z.object({
  revisionId: z.string().uuid(),
  note: z.string().max(1000).optional(),
});

/** Restores an earlier approved revision as the live content — the vandalism
 *  and bad-edit escape hatch that a wiki-style site needs. */
moderation.post("/agreements/:slug/revert", async (c) => {
  const moderator = c.get("user");
  const slug = c.req.param("slug");
  const body = Revert.safeParse(await c.req.json());
  if (!body.success) return c.json({ error: "invalid input" }, 400);

  const [agreement] = await db
    .select({ id: agreements.id })
    .from(agreements)
    .where(eq(agreements.slug, slug));
  if (!agreement) return c.json({ error: "not found" }, 404);

  const [target] = await db
    .select({
      id: revisions.id,
      agreementId: revisions.agreementId,
      status: revisions.status,
      fields: revisions.fields,
    })
    .from(revisions)
    .where(eq(revisions.id, body.data.revisionId));
  if (!target || target.agreementId !== agreement.id) {
    return c.json({ error: "revision not found for this agreement" }, 404);
  }
  if (target.status !== "approved") {
    return c.json({ error: "can only revert to an approved revision" }, 409);
  }

  // Recorded as a new revision so the history stays append-only and the revert
  // itself is visible rather than rewriting the past.
  const [revision] = await db
    .insert(revisions)
    .values({
      agreementId: agreement.id,
      editorId: moderator.id,
      isAi: false,
      fields: target.fields,
      editSummary: `Reverted to revision ${target.id.slice(0, 8)}${
        body.data.note ? `: ${body.data.note}` : ""
      }`,
      status: "approved",
      reviewerId: moderator.id,
      reviewedAt: new Date(),
    })
    .returning();

  await db
    .update(agreements)
    .set({ currentRevisionId: revision.id, updatedAt: new Date() })
    .where(eq(agreements.id, agreement.id));

  await db.insert(auditLog).values({
    actorId: moderator.id,
    action: "agreement.reverted",
    targetType: "agreement",
    targetId: agreement.id,
    detail: { slug, revertedTo: target.id, note: body.data.note },
  });

  return c.json({ ok: true, revisionId: revision.id });
});

const Takedown = z.object({
  reason: z.string().min(1).max(1000),
  restore: z.boolean().optional(),
});

/** Unpublishes an agreement (rights holder request, mis-submission, spam).
 *  The About page promises this; there was previously no way to do it. */
moderation.post("/agreements/:slug/takedown", async (c) => {
  const moderator = c.get("user");
  const slug = c.req.param("slug");
  const body = Takedown.safeParse(await c.req.json());
  if (!body.success) return c.json({ error: "invalid input" }, 400);

  const [agreement] = await db
    .select({ id: agreements.id, status: agreements.status })
    .from(agreements)
    .where(eq(agreements.slug, slug));
  if (!agreement) return c.json({ error: "not found" }, 404);

  const nextStatus = body.data.restore ? "published" : "rejected";
  await db
    .update(agreements)
    .set({ status: nextStatus, updatedAt: new Date() })
    .where(eq(agreements.id, agreement.id));

  await db.insert(auditLog).values({
    actorId: moderator.id,
    action: body.data.restore ? "agreement.restored" : "agreement.taken_down",
    targetType: "agreement",
    targetId: agreement.id,
    detail: { slug, reason: body.data.reason },
  });

  return c.json({ ok: true, status: nextStatus });
});

moderation.get("/audit", async (c) => {
  const limit = Math.min(Math.max(Number(c.req.query("limit") ?? 100) || 100, 1), 200);
  const rows = await db
    .select({
      id: auditLog.id,
      action: auditLog.action,
      targetType: auditLog.targetType,
      targetId: auditLog.targetId,
      detail: auditLog.detail,
      createdAt: auditLog.createdAt,
      actorName: users.displayName,
    })
    .from(auditLog)
    .leftJoin(users, eq(users.id, auditLog.actorId))
    .orderBy(desc(auditLog.createdAt))
    .limit(limit);
  return c.json({ items: rows });
});

moderation.get("/users", requireRole("admin"), async (c) => {
  const rows = await db
    .select({
      id: users.id,
      email: users.email,
      displayName: users.displayName,
      role: users.role,
      acceptedEdits: users.acceptedEdits,
      createdAt: users.createdAt,
    })
    .from(users)
    .orderBy(desc(users.createdAt))
    .limit(200);
  return c.json({ items: rows });
});

const RoleChange = z.object({ role: z.enum(["user", "trusted", "moderator"]) });

moderation.post("/users/:id/role", requireRole("admin"), async (c) => {
  const actor = c.get("user");
  const id = c.req.param("id");
  const body = RoleChange.safeParse(await c.req.json());
  if (!body.success) return c.json({ error: "invalid input" }, 400);
  await db.update(users).set({ role: body.data.role }).where(eq(users.id, id));
  await db.insert(auditLog).values({
    actorId: actor.id,
    action: "user.role_changed",
    targetType: "user",
    targetId: id,
    detail: { role: body.data.role },
  });
  return c.json({ ok: true });
});

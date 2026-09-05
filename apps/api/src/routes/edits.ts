import { Hono } from "hono";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { db, agreements, auditLog, revisions } from "@collective/db";
import { EditableContent, Provisions } from "@collective/shared";
import { requireAuth, type AppEnv } from "../middleware.js";

export const edits = new Hono<AppEnv>();

const ProposalBody = z.object({
  // Partial, including inside `provisions`: a client only needs to send the
  // fields it actually touched. They are merged over the current revision, so a
  // form that renders a subset of the content can never silently drop the rest.
  fields: EditableContent.partial().extend({
    provisions: Provisions.partial().optional(),
  }),
  editSummary: z.string().max(500).optional(),
  /** Guards against two editors overwriting each other; from GET /agreements/:slug. */
  baseRevisionId: z.string().uuid().optional(),
});

edits.post("/agreements/:slug/revisions", requireAuth, async (c) => {
  const user = c.get("user");
  const slug = c.req.param("slug");

  const body = ProposalBody.safeParse(await c.req.json());
  if (!body.success) {
    return c.json({ error: "invalid fields", detail: body.error.flatten() }, 400);
  }

  const [agreement] = await db
    .select({
      id: agreements.id,
      status: agreements.status,
      currentRevisionId: agreements.currentRevisionId,
    })
    .from(agreements)
    .where(eq(agreements.slug, slug));
  if (!agreement || agreement.status !== "published" || !agreement.currentRevisionId) {
    return c.json({ error: "not found" }, 404);
  }

  if (
    body.data.baseRevisionId &&
    body.data.baseRevisionId !== agreement.currentRevisionId
  ) {
    return c.json(
      {
        error: "this page changed while you were editing — reload and reapply your changes",
        currentRevisionId: agreement.currentRevisionId,
      },
      409,
    );
  }

  const [current] = await db
    .select({ fields: revisions.fields })
    .from(revisions)
    .where(eq(revisions.id, agreement.currentRevisionId));
  if (!current) return c.json({ error: "not found" }, 404);

  const merged = EditableContent.safeParse({
    ...current.fields,
    ...body.data.fields,
    provisions: { ...current.fields.provisions, ...(body.data.fields.provisions ?? {}) },
  });
  if (!merged.success) {
    return c.json({ error: "invalid fields", detail: merged.error.flatten() }, 400);
  }

  if (JSON.stringify(merged.data) === JSON.stringify(current.fields)) {
    return c.json({ error: "no changes to save" }, 400);
  }

  const canPublishInstantly =
    user.role === "trusted" || user.role === "moderator" || user.role === "admin";

  const [revision] = await db
    .insert(revisions)
    .values({
      agreementId: agreement.id,
      editorId: user.id,
      isAi: false,
      fields: merged.data,
      editSummary: body.data.editSummary?.trim() || null,
      status: canPublishInstantly ? "approved" : "pending",
      reviewerId: canPublishInstantly ? user.id : null,
      reviewedAt: canPublishInstantly ? new Date() : null,
    })
    .returning();

  if (canPublishInstantly) {
    await db
      .update(agreements)
      .set({ currentRevisionId: revision.id, updatedAt: new Date() })
      .where(eq(agreements.id, agreement.id));
  }

  await db.insert(auditLog).values({
    actorId: user.id,
    action: canPublishInstantly ? "revision.published" : "revision.proposed",
    targetType: "revision",
    targetId: revision.id,
    detail: { slug },
  });

  return c.json(
    {
      id: revision.id,
      status: revision.status,
    },
    201,
  );
});

edits.get("/me/revisions", requireAuth, async (c) => {
  const user = c.get("user");
  const rows = await db
    .select({
      id: revisions.id,
      status: revisions.status,
      editSummary: revisions.editSummary,
      reviewNote: revisions.reviewNote,
      createdAt: revisions.createdAt,
      slug: agreements.slug,
    })
    .from(revisions)
    .innerJoin(agreements, eq(agreements.id, revisions.agreementId))
    .where(and(eq(revisions.editorId, user.id), eq(revisions.isAi, false)))
    .orderBy(desc(revisions.createdAt))
    .limit(50);
  return c.json({ items: rows });
});

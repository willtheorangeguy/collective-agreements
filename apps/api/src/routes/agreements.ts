import { Hono } from "hono";
import { and, asc, desc, eq, sql, type SQL } from "drizzle-orm";
import { db, agreements, aiAnalyses, revisions, users } from "@collective/db";

export const agreementsRoute = new Hono();

const titleExpr = sql<string>`coalesce(${revisions.fields} ->> 'title_english', ${agreements.slug})`;

/** Must stay identical to the expression in drizzle/0001_search_and_facets.sql,
 *  otherwise the GIN index will not be used. */
const bodyVector = sql`to_tsvector('simple', left(coalesce(${agreements.extractedText}, ''), 200000))`;

const SORTS = {
  newest: () => desc(agreements.createdAt),
  oldest: () => asc(agreements.createdAt),
  updated: () => desc(agreements.updatedAt),
  title: () => asc(titleExpr),
  expiry: () => sql`(${revisions.fields} ->> 'expiry_date') asc nulls last`,
} as const;
type SortKey = keyof typeof SORTS;

function isSortKey(v: string): v is SortKey {
  return Object.prototype.hasOwnProperty.call(SORTS, v);
}

function listConditions(country?: string, sector?: string, q?: string): SQL[] {
  const conditions: SQL[] = [
    eq(agreements.status, "published"),
    eq(revisions.status, "approved"),
  ];
  if (country) conditions.push(sql`${agreements.countries} ? ${country}`);
  if (sector) conditions.push(sql`(${revisions.fields} ->> 'sector') ilike ${`%${sector}%`}`);
  if (q) {
    const like = `%${q}%`;
    conditions.push(
      sql`(
        (${revisions.fields} ->> 'title_english') ilike ${like}
        or (${revisions.fields} ->> 'summary_english') ilike ${like}
        or (${revisions.fields} ->> 'sector') ilike ${like}
        or ${bodyVector} @@ plainto_tsquery('simple', ${q})
      )`,
    );
  }
  return conditions;
}

agreementsRoute.get("/", async (c) => {
  const country = c.req.query("country")?.toUpperCase().trim() || undefined;
  const sector = c.req.query("sector")?.trim() || undefined;
  const q = c.req.query("q")?.trim() || undefined;
  const sortParam = c.req.query("sort") ?? "newest";
  const sort = isSortKey(sortParam) ? sortParam : "newest";

  const limit = Math.min(Math.max(Number(c.req.query("limit") ?? 25) || 25, 1), 100);
  const offset = Math.max(Number(c.req.query("offset") ?? 0) || 0, 0);

  const conditions = listConditions(country, sector, q);

  const rows = await db
    .select({
      slug: agreements.slug,
      title: titleExpr,
      countries: agreements.countries,
      sector: sql<string | null>`${revisions.fields} ->> 'sector'`,
      effectiveDate: sql<string | null>`${revisions.fields} ->> 'effective_date'`,
      expiryDate: sql<string | null>`${revisions.fields} ->> 'expiry_date'`,
      summary: sql<string | null>`left(${revisions.fields} ->> 'summary_english', 240)`,
      hasFile: sql<boolean>`${agreements.fileKey} is not null`,
      createdAt: agreements.createdAt,
    })
    .from(agreements)
    .innerJoin(revisions, eq(revisions.id, agreements.currentRevisionId))
    .where(and(...conditions))
    .orderBy(SORTS[sort]())
    .limit(limit)
    .offset(offset);

  const [{ total } = { total: 0 }] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(agreements)
    .innerJoin(revisions, eq(revisions.id, agreements.currentRevisionId))
    .where(and(...conditions));

  return c.json({ items: rows, total, limit, offset });
});

/** Country facets for the browse filter; published agreements only. */
agreementsRoute.get("/facets/countries", async (c) => {
  const rows = await db.execute(sql`
    select code, count(*)::int as count
    from ${agreements}, jsonb_array_elements_text(${agreements.countries}) as code
    where ${agreements.status} = 'published'
    group by code
    order by count desc, code asc
  `);
  return c.json({ items: rows.rows as unknown as { code: string; count: number }[] });
});

agreementsRoute.get("/stats", async (c) => {
  const rows = (
    await db.execute(sql`
      select
        (select count(*)::int from ${agreements} where ${agreements.status} = 'published')
          as agreements,
        (select count(distinct code)::int
           from ${agreements}, jsonb_array_elements_text(${agreements.countries}) as code
          where ${agreements.status} = 'published') as countries,
        (select count(*)::int from ${revisions}
          where ${revisions.isAi} = false and ${revisions.status} = 'approved')
          as community_edits,
        (select count(*)::int from ${revisions} where ${revisions.status} = 'pending')
          as pending_edits
    `)
  ).rows as unknown as {
    agreements: number;
    countries: number;
    community_edits: number;
    pending_edits: number;
  }[];
  const row = rows[0];
  return c.json({
    agreements: row?.agreements ?? 0,
    countries: row?.countries ?? 0,
    communityEdits: row?.community_edits ?? 0,
    pendingEdits: row?.pending_edits ?? 0,
  });
});

agreementsRoute.get("/revisions/:id", async (c) => {
  const id = c.req.param("id");
  if (!/^[0-9a-f-]{36}$/i.test(id)) return c.json({ error: "not found" }, 404);
  const [row] = await db
    .select({
      id: revisions.id,
      fields: revisions.fields,
      status: revisions.status,
      isAi: revisions.isAi,
      editSummary: revisions.editSummary,
      reviewNote: revisions.reviewNote,
      createdAt: revisions.createdAt,
      editorName: users.displayName,
    })
    .from(revisions)
    .leftJoin(users, eq(users.id, revisions.editorId))
    .where(eq(revisions.id, id));
  if (!row) return c.json({ error: "not found" }, 404);
  return c.json(row);
});

/** Public recent-changes feed. A wiki without one has no way for the community
 *  to notice bad edits between moderation passes. */
agreementsRoute.get("/feed/changes", async (c) => {
  const limit = Math.min(Math.max(Number(c.req.query("limit") ?? 50) || 50, 1), 100);
  const rows = await db
    .select({
      id: revisions.id,
      slug: agreements.slug,
      title: sql<string>`coalesce(${revisions.fields} ->> 'title_english', ${agreements.slug})`,
      isAi: revisions.isAi,
      status: revisions.status,
      editSummary: revisions.editSummary,
      createdAt: revisions.createdAt,
      editorName: users.displayName,
    })
    .from(revisions)
    .innerJoin(agreements, eq(agreements.id, revisions.agreementId))
    .leftJoin(users, eq(users.id, revisions.editorId))
    .where(and(eq(agreements.status, "published"), eq(revisions.status, "approved")))
    .orderBy(desc(revisions.createdAt))
    .limit(limit);
  return c.json({ items: rows });
});

/** Lightweight status probe. A freshly submitted agreement has no prerendered
 *  page yet, so the submitter is sent to /agreements/pending which polls this. */
agreementsRoute.get("/:slug/status", async (c) => {
  const [row] = await db
    .select({ status: agreements.status, slug: agreements.slug })
    .from(agreements)
    .where(eq(agreements.slug, c.req.param("slug")));
  if (!row) return c.json({ error: "not found" }, 404);
  return c.json(row);
});

/** Serves the archived original document. Source URLs rot; keeping a copy is
 *  the whole point of the upload, so it needs to be reachable. */
agreementsRoute.get("/:slug/file", async (c) => {
  const [row] = await db
    .select({
      status: agreements.status,
      fileKey: agreements.fileKey,
      fileName: agreements.fileName,
      mimeType: agreements.mimeType,
    })
    .from(agreements)
    .where(eq(agreements.slug, c.req.param("slug")));

  if (!row || row.status !== "published" || !row.fileKey) {
    return c.json({ error: "not found" }, 404);
  }

  const { getFile } = await import("@collective/pipeline");
  let body: Buffer;
  try {
    body = await getFile(row.fileKey);
  } catch (err) {
    console.error("original document fetch failed:", err);
    return c.json({ error: "document unavailable" }, 502);
  }

  const name = (row.fileName ?? "agreement").replace(/[^a-zA-Z0-9._-]/g, "_");
  return new Response(new Uint8Array(body), {
    headers: {
      "Content-Type": row.mimeType ?? "application/octet-stream",
      "Content-Length": String(body.length),
      "Content-Disposition": `inline; filename="${name}"`,
      "Cache-Control": "public, max-age=86400",
    },
  });
});

agreementsRoute.get("/:slug", async (c) => {
  const slug = c.req.param("slug");
  const [row] = await db
    .select({
      agreement: {
        id: agreements.id,
        slug: agreements.slug,
        status: agreements.status,
        sourceUrl: agreements.sourceUrl,
        countries: agreements.countries,
        detectedLanguage: agreements.detectedLanguage,
        fileKey: agreements.fileKey,
        fileName: agreements.fileName,
        fileSize: agreements.fileSize,
        mimeType: agreements.mimeType,
        aiAnalysisId: agreements.aiAnalysisId,
        createdAt: agreements.createdAt,
        updatedAt: agreements.updatedAt,
      },
      revision: revisions,
    })
    .from(agreements)
    .leftJoin(revisions, eq(revisions.id, agreements.currentRevisionId))
    .where(eq(agreements.slug, slug));

  if (!row || row.agreement.status !== "published" || !row.revision) {
    return c.json({ error: "not found", status: row?.agreement.status ?? null }, 404);
  }

  let aiMeta: {
    provider: string;
    model: string;
    createdAt: Date;
    confidence: unknown;
    language: string | null;
  } | null = null;
  if (row.agreement.aiAnalysisId) {
    const [ai] = await db
      .select({
        provider: aiAnalyses.provider,
        model: aiAnalyses.model,
        createdAt: aiAnalyses.createdAt,
        structured: aiAnalyses.structured,
      })
      .from(aiAnalyses)
      .where(eq(aiAnalyses.id, row.agreement.aiAnalysisId));
    aiMeta = ai
      ? {
          provider: ai.provider,
          model: ai.model,
          createdAt: ai.createdAt,
          confidence: ai.structured?.confidence ?? null,
          language: ai.structured?.language ?? null,
        }
      : null;
  }

  const countRows = (
    await db.execute(sql`
      select
        count(*) filter (where ${revisions.isAi} = false and ${revisions.status} = 'approved')::int
          as community,
        count(*) filter (where ${revisions.status} = 'pending')::int as pending
      from ${revisions}
      where ${revisions.agreementId} = ${row.agreement.id}
    `)
  ).rows as unknown as { community: number; pending: number }[];
  const counts = countRows[0] ?? { community: 0, pending: 0 };

  let editorName: string | null = null;
  if (row.revision.editorId) {
    const [editor] = await db
      .select({ displayName: users.displayName })
      .from(users)
      .where(eq(users.id, row.revision.editorId));
    editorName = editor?.displayName ?? null;
  }

  return c.json({
    agreement: {
      id: row.agreement.id,
      slug: row.agreement.slug,
      status: row.agreement.status,
      sourceUrl: row.agreement.sourceUrl,
      countries: row.agreement.countries,
      detectedLanguage: row.agreement.detectedLanguage,
      fileName: row.agreement.fileName,
      fileSize: row.agreement.fileSize,
      mimeType: row.agreement.mimeType,
      hasFile: row.agreement.fileKey !== null,
      createdAt: row.agreement.createdAt,
      updatedAt: row.agreement.updatedAt,
    },
    content: row.revision.fields,
    isAiRevision: row.revision.isAi,
    currentRevision: {
      id: row.revision.id,
      createdAt: row.revision.createdAt,
      editorName,
    },
    aiAnalysis: aiMeta,
    communityEditCount: counts.community,
    pendingEditCount: counts.pending,
  });
});

agreementsRoute.get("/:slug/history", async (c) => {
  const slug = c.req.param("slug");
  const [agreement] = await db
    .select({ id: agreements.id, currentRevisionId: agreements.currentRevisionId })
    .from(agreements)
    .where(eq(agreements.slug, slug));
  if (!agreement) return c.json({ error: "not found" }, 404);

  const rows = await db
    .select({
      id: revisions.id,
      editorName: users.displayName,
      isAi: revisions.isAi,
      // Included so the history page can diff each revision against its
      // predecessor in one request instead of N follow-up fetches.
      fields: revisions.fields,
      editSummary: revisions.editSummary,
      reviewNote: revisions.reviewNote,
      status: revisions.status,
      createdAt: revisions.createdAt,
      reviewedAt: revisions.reviewedAt,
    })
    .from(revisions)
    .leftJoin(users, eq(users.id, revisions.editorId))
    .where(eq(revisions.agreementId, agreement.id))
    .orderBy(desc(revisions.createdAt));

  return c.json({ items: rows, currentRevisionId: agreement.currentRevisionId });
});

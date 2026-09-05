import { Hono } from "hono";
import { createHash } from "node:crypto";
import { desc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db, agreements, auditLog, jobs, revisions } from "@collective/db";
import { SubmissionMeta, slugify } from "@collective/shared";
import { putFile } from "@collective/pipeline";
import { requireAuth, type AppEnv } from "../middleware.js";

export const submissions = new Hono<AppEnv>();

const MAX_FILE_SIZE = 25 * 1024 * 1024;
const MIN_TEXT_LENGTH = 1000;

const ALLOWED_MIME = new Set([
  "application/pdf",
  "text/plain",
  "image/png",
  "image/jpeg",
  "image/tiff",
  "image/webp",
]);

const RATE_LIMIT = 10;
const rateMap = new Map<string, number[]>();

function rateLimited(key: string): boolean {
  const now = Date.now();
  const windowStart = now - 24 * 60 * 60 * 1000;
  const hits = (rateMap.get(key) ?? []).filter((t) => t > windowStart);
  if (hits.length >= RATE_LIMIT) return true;
  hits.push(now);
  rateMap.set(key, hits);
  return false;
}

function shortId(): string {
  return Math.random().toString(36).slice(2, 6);
}

submissions.post("/", requireAuth, async (c) => {
  const user = c.get("user");
  if (rateLimited(user.id)) {
    return c.json({ error: "rate limit exceeded, try again tomorrow" }, 429);
  }

  let form: Record<string, string | File>;
  try {
    form = await c.req.parseBody();
  } catch {
    return c.json({ error: "expected multipart/form-data" }, 400);
  }

  const metaRaw = form["meta"];
  if (typeof metaRaw !== "string") return c.json({ error: "missing meta field" }, 400);
  const meta = SubmissionMeta.safeParse(JSON.parse(metaRaw));
  if (!meta.success) {
    return c.json({ error: "invalid meta", detail: meta.error.flatten() }, 400);
  }

  const textEntry = form["text"];
  const fileEntry = form["file"];

  let buffer: Buffer | null = null;
  let mimeType = "text/plain";
  let fileName = "pasted-text.txt";

  if (textEntry && typeof textEntry === "string") {
    if (textEntry.trim().length < MIN_TEXT_LENGTH) {
      return c.json({ error: `pasted text too short (min ${MIN_TEXT_LENGTH} chars)` }, 400);
    }
    buffer = Buffer.from(textEntry, "utf8");
  } else if (fileEntry && typeof fileEntry === "object" && "arrayBuffer" in fileEntry) {
    const f = fileEntry as File;
    if (f.size > MAX_FILE_SIZE) return c.json({ error: "file exceeds 25MB limit" }, 413);
    mimeType = f.type || "application/octet-stream";
    if (!ALLOWED_MIME.has(mimeType)) {
      return c.json({ error: `unsupported file type: ${mimeType}` }, 415);
    }
    fileName = f.name || fileName;
    buffer = Buffer.from(await f.arrayBuffer());
  } else {
    return c.json({ error: "provide a file or pasted text" }, 400);
  }

  const sha256 = createHash("sha256").update(buffer).digest("hex");
  const dup = await db
    .select({ slug: agreements.slug })
    .from(agreements)
    .where(eq(agreements.sha256, sha256));
  if (dup.length > 0) {
    return c.json({ error: "exact duplicate of existing agreement", existing: dup[0].slug }, 409);
  }

  const slugBase = slugify(fileName.replace(/\.[a-z0-9]+$/i, "")) || "agreement";
  const slug = `${slugBase}-${shortId()}${Date.now().toString(36).slice(-4)}`;

  const [agreement] = await db
    .insert(agreements)
    .values({
      slug,
      status: "processing",
      sha256,
      sourceUrl: meta.data.source_url,
      countries: meta.data.country_codes,
      submittedBy: user.id,
      extractedText: mimeType === "text/plain" ? buffer.toString("utf8") : null,
    })
    .returning();

  if (fileEntry && typeof fileEntry === "object" && "arrayBuffer" in fileEntry) {
    const key = `originals/${agreement.id}/${fileName.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
    await putFile(key, buffer, mimeType);
    await db
      .update(agreements)
      .set({ fileKey: key, fileName, fileSize: buffer.length, mimeType })
      .where(eq(agreements.id, agreement.id));
  }

  await db.insert(jobs).values({ type: "analyze", payload: { agreementId: agreement.id } });
  await db.insert(auditLog).values({
    actorId: user.id,
    action: "agreement.submitted",
    targetType: "agreement",
    targetId: agreement.id,
    detail: { slug },
  });

  return c.json({ id: agreement.id, slug }, 202);
});

submissions.get("/mine", requireAuth, async (c) => {
  const user = c.get("user");
  const rows = await db
    .select({
      id: agreements.id,
      slug: agreements.slug,
      status: agreements.status,
      createdAt: agreements.createdAt,
    })
    .from(agreements)
    .where(eq(agreements.submittedBy, user.id))
    .orderBy(desc(agreements.createdAt))
    .limit(50);
  return c.json({ items: rows });
});

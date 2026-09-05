# Collective Agreements — Architecture

The project is an npm-workspace monorepo with a static Astro frontend, a Hono API, and a polling worker. Postgres holds application state; S3-compatible object storage holds submitted originals.

```
browser → Astro site → Hono API → Postgres
                         │          │
                         │          └→ jobs table → worker → AI provider
                         └→ S3-compatible object storage ← uploaded originals
```

`apps/web` renders the public library, account screens, moderation dashboard, sitemap, and Atom change feed. It calls the API using `PUBLIC_API_URL`; production builds use `PUBLIC_SITE_URL` for canonical URLs and feed links.

`apps/api` owns authentication, submissions, agreement search and retrieval, revisions, moderation, and the audit log. It issues HTTP-only, 30-day cookies whose identifiers map to the `sessions` table. `apps/api/src/worker.ts` claims pending jobs with `FOR UPDATE SKIP LOCKED`, retries failures up to three attempts, and invokes an optional rebuild webhook after a successful job.

`packages/pipeline` persists file originals, extracts text from PDFs and supported images, and coordinates analysis. Text PDFs use their text layer; images use Tesseract. `packages/ai` selects Anthropic, OpenAI-compatible, or local analyzers and validates their structured response through shared Zod schemas.

The main records are `users`, `sessions`, `agreements`, `revisions`, `ai_analyses`, `jobs`, and `audit_log`. An agreement points to its current approved revision and its original AI analysis. Revisions are append-only: moderation approvals advance the current revision, and a revert creates a new approved revision containing an earlier revision's fields.

Search combines case-insensitive matches on title, summary, and sector with a PostgreSQL full-text expression index over the first 200,000 characters of extracted text. Keep the query expression in `apps/api/src/routes/agreements.ts` aligned with migration `0001_search_and_facets.sql` so Postgres can use that index.

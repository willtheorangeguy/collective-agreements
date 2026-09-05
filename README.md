# Collective Agreements

Public library of union collective agreements worldwide. Users submit agreements, an AI model
produces a structured analysis that publishes instantly behind a permanent "AI-generated,
unverified" banner, and the community corrects it through moderated, versioned edits
(Wikipedia-style).

## Layout

```
apps/web        Astro static site (SSG, rebuilt via webhook when content changes)
apps/api        Hono API: auth, submissions, edits, moderation
packages/db     Drizzle schema + migrations (Postgres)
packages/ai     Provider abstraction: anthropic | openai | local (OpenAI-compatible)
packages/pipeline Extraction, OCR, dedup, orchestration
packages/shared Zod schemas + domain types + ISO-3166 country names
infra/          docker compose: postgres, minio, (ollama optional)
scripts/        seed.ts — demo content + admin user
```

## Quick start

```sh
npm install
cp .env.example .env         # set AI_PROVIDER + API key; defaults work for local dev
docker compose -f infra/docker-compose.yml up -d   # postgres + minio
npm run db:migrate           # apply schema
npm run seed                 # demo agreements + admin (admin@example.com / change-me-123)

npm run dev:api              # API on :3000
npm run worker               # AI pipeline worker (separate terminal)
npm run dev:web              # site on :4321
```

Local LLM option: `docker compose -f infra/docker-compose.yml --profile local-ai up -d ollama`,
then `ollama pull llama3.1` and set `AI_PROVIDER=local`.

## Flow

1. POST /submissions (multipart: file or text + meta JSON) → sha256 dedup → stored to S3 →
   `analyze` job enqueued → agreement `processing`. The submitter is sent to
   `/agreements/pending?slug=…`, which polls until the page exists.
2. Worker extracts text (pdf text layer / OCR for images) → calls configured provider →
   validates strict JSON schema → saves `ai_analyses` + approved AI revision → agreement
   `published` → rebuild webhook fires.
3. Site rebuild prerenders agreement pages. Every page shows the unverified-AI banner until a
   community edit has been accepted, and shows the model's self-reported confidence per section.
4. Signed-in users propose edits (`POST /agreements/:slug/revisions`). Trusted+ editors publish
   instantly; others land in the moderation queue. Approvals count toward auto-trust at 5.
5. Full revision history per agreement with per-field before/after diffs; moderators can reject
   with notes, restore an earlier revision, or take an agreement down. The audit log records all
   moderation actions.

## Search

Browse searches titles, summaries and sectors with `ILIKE`, and the full document body with
Postgres full-text search. Migration `0001` adds the GIN indexes. The `to_tsvector(...)`
expression in `apps/api/src/routes/agreements.ts` must stay byte-identical to the one in
`packages/db/drizzle/0001_search_and_facets.sql`, or the index is silently not used.

The body is indexed as an *expression* index rather than a generated column so that
`select * from agreements` never pulls a large tsvector into the application. `drizzle-kit
generate` does not know about these indexes; do not let it drop them.

## Deployment notes

- `WEB_ORIGIN` (API) must list the site's browser origin, comma-separated. Localhost is
  auto-allowed only when `NODE_ENV !== production`; without `WEB_ORIGIN` set, a deployed site
  cannot call the API at all.
- `PUBLIC_SITE_URL` (web) drives canonical URLs, `sitemap.xml` and `changes.xml`. If unset,
  those are emitted empty rather than with wrong URLs.
- The API serves archived originals at `/agreements/:slug/file` straight from S3. Put a CDN or
  cache in front of it if traffic warrants; responses are already `Cache-Control: public`.

## Tests

```sh
npm test        # vitest units: dedup, slugify, prompt parsing/schema validation
npm run typecheck
```

## Notes

- Only submit publicly available documents; source URL is mandatory and displayed.
- Nothing on the site is legal advice; takedown contact in About page, takedown action in the
  moderation API.
- Multi-page scanned-PDF OCR is not enabled yet (rasterize first); image uploads OCR directly.
- Country codes are validated against the ISO-3166-1 alpha-2 list in `packages/shared`.

-- Full-text search support for the browse page.
--
-- The document body is indexed with an EXPRESSION index rather than a generated
-- column so that `select * from agreements` never drags a large tsvector back
-- into the application. Queries must use the identical expression to hit it.
--
-- `left(..., 200000)` keeps very long agreements below Postgres' 1MB tsvector
-- limit; matches beyond that point fall back to the title/summary conditions.
CREATE EXTENSION IF NOT EXISTS pg_trgm;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "agreements_fts_idx" ON "agreements"
  USING gin (to_tsvector('simple', left(coalesce("extracted_text", ''), 200000)));
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "agreements_countries_idx" ON "agreements" USING gin ("countries");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "revisions_title_trgm_idx" ON "revisions"
  USING gin ((("fields" ->> 'title_english')) gin_trgm_ops);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "revisions_sector_trgm_idx" ON "revisions"
  USING gin ((("fields" ->> 'sector')) gin_trgm_ops);

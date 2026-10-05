# Collective Agreements — Known Issues

## High — Static pages are not rebuilt after community changes

**Where:** `apps/api/src/worker.ts` and `apps/api/src/routes/edits.ts`, `apps/api/src/routes/moderation.ts`.

**What:** `REBUILD_WEBHOOK_URL` is called only after a successful worker job. Approved edits, instant trusted-editor revisions, reversions, takedowns, and restores update Postgres without calling the webhook.

**Why it matters:** The Astro site is statically generated, so deployed agreement pages, browse results, and feeds can keep showing stale content after community or moderator actions.

**Suggested fix:** Trigger the configured rebuild after every mutation that changes published agreement content or status, ideally through a shared post-publication hook or durable rebuild job.

## Low — `SESSION_SECRET` is documented but unused

**Where:** `.env.example` and `apps/api/src/middleware.ts`.

**What:** The example environment file defines `SESSION_SECRET`, but the session implementation stores random UUIDs in the database and does not read the variable.

**Why it matters:** Operators may spend time configuring a setting that has no effect and may incorrectly assume it protects or signs sessions.

**Suggested fix:** Remove the variable from the example file or introduce a documented use for it as part of an explicit session-security design.

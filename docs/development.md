# Collective Agreements — Development

Install dependencies and start the backing services as described in [quickstart](./quickstart.md). The root scripts coordinate all workspaces.

| Command | Purpose |
| --- | --- |
| `npm run dev:api` | Watch and run the Hono API. |
| `npm run dev:web` | Run the Astro development server. |
| `npm run worker` | Watch and run the analysis worker. |
| `npm run db:migrate` | Apply committed Drizzle migrations. |
| `npm run db:generate` | Generate a migration after an intentional schema change. |
| `npm run seed` | Create missing demo data and a development administrator. |
| `npm test` | Run Vitest unit tests. |
| `npm run typecheck` | Type-check TypeScript packages and run Astro checks. |

Run the test suite and type checks before proposing a change:

```sh
npm test
npm run typecheck
```

Schema definitions live in `packages/db/src/schema.ts`; committed SQL migrations live in `packages/db/drizzle/`. Do not regenerate away the hand-maintained full-text indexes in `0001_search_and_facets.sql`. When changing search, update the migration and query expression together.

The worker consumes `pending` rows from the `jobs` table. Use seeded agreements when working on the interface without configured AI credentials. For end-to-end submissions, configure a provider and keep the worker running.

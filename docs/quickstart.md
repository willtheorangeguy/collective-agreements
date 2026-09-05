# Collective Agreements — Quickstart

Use this path to run a local copy with the supplied demo agreements. It needs Node.js 22 or later and Docker Compose.

```sh
npm install
cp .env.example .env
docker compose -f infra/docker-compose.yml up -d
npm run db:migrate
npm run seed
```

Start each long-running process in its own terminal:

```sh
npm run dev:api
npm run worker
npm run dev:web
```

The API listens on `http://localhost:3000` and the Astro site on `http://localhost:4321`.
Open the site and sign in as `admin@example.com` with password `change-me-123`. The seed script creates that account and two published demo agreements when they do not already exist.

The default AI provider is Anthropic, so the worker needs `ANTHROPIC_API_KEY` before it can process a new submission. The seeded content does not call an AI provider. See [configuration](./configuration.md) for provider choices.

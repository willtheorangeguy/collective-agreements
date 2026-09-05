# Collective Agreements — Installation

The monorepo uses npm workspaces. Install Node.js 22 or later, npm, Docker, and Docker Compose before running it.

Clone the repository, install its workspace dependencies, and create the local configuration file:

```sh
npm install
cp .env.example .env
```

Start Postgres and MinIO. The compose configuration publishes Postgres on port 5433, MinIO's S3 API on port 9000, and its console on port 9001. The `minio-init` service creates the `agreements` bucket.

```sh
docker compose -f infra/docker-compose.yml up -d
npm run db:migrate
```

`npm run seed` is optional but useful for development. It adds an administrator and two published demonstrations without calling an AI service. Set `SEED_ADMIN_EMAIL` and `SEED_ADMIN_PASSWORD` before running it to replace its development defaults.

For a local OpenAI-compatible model, start the optional Ollama service, pull the configured model, and set the provider:

```sh
docker compose -f infra/docker-compose.yml --profile local-ai up -d ollama
ollama pull llama3.1
```

Set `AI_PROVIDER=local` in `.env`. See [configuration](./configuration.md) for the equivalent Anthropic and OpenAI settings.

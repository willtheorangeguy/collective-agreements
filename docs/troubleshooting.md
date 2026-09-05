# Collective Agreements — Troubleshooting

## The API cannot connect to Postgres

Start the compose services with `docker compose -f infra/docker-compose.yml up -d` and confirm that port 5433 is free. The development connection string uses `localhost:5433`, not Postgres's internal container port 5432. Then run `npm run db:migrate`.

## Uploads fail because the object bucket does not exist

Start the full compose configuration, including `minio-init`, rather than MinIO alone. That one-shot service creates the `agreements` bucket. Check its logs with `docker compose -f infra/docker-compose.yml logs minio-init`.

## A new agreement stays in processing

Run `npm run worker` in a separate terminal. The worker claims rows from the database jobs table; the API only creates the job. Check the worker output for provider credentials, extraction errors, or invalid model output.

## A scanned PDF fails to process

Multi-page scanned-PDF OCR is not implemented. Rasterize the PDF pages and submit supported image files, or submit a PDF with a usable text layer. Image OCR uses the language selected by `OCR_LANG`.

## The worker reports an AI credential or model error

Set `AI_PROVIDER` to the provider you configured and supply its matching credentials. `anthropic` needs `ANTHROPIC_API_KEY`; `openai` needs `OPENAI_API_KEY` and optionally `OPENAI_BASE_URL`; `local` needs a running OpenAI-compatible endpoint such as Ollama.

## The deployed web site gets CORS or authentication errors

Add the exact browser origin to `WEB_ORIGIN`, separated by commas when there are several. Use the origin only, without a path. In production, localhost is not implicitly allowed.

## Sitemap or Atom feed links are missing

Set `PUBLIC_SITE_URL` to the public site origin during the web build. Astro leaves those absolute URLs out when it cannot determine the site origin.

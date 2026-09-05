# Collective Agreements — Configuration

The processes load `.env` from the repository root. Copy `.env.example` and replace development values before deploying.

| Variable | Purpose | Development default |
| --- | --- | --- |
| `DATABASE_URL` | PostgreSQL connection string | `postgres://collective:collective@localhost:5433/collective` |
| `PORT` | API listener port | `3000` |
| `AI_PROVIDER` | Analyzer: `anthropic`, `openai`, or `local` | `anthropic` |
| `ANTHROPIC_API_KEY` | Credential for Anthropic | empty |
| `ANTHROPIC_MODEL` | Anthropic model override | `claude-sonnet-4-20250514` |
| `OPENAI_API_KEY` | Credential for OpenAI-compatible providers | empty |
| `OPENAI_BASE_URL` / `OPENAI_MODEL` | OpenAI-compatible endpoint and model | OpenAI v1 / `gpt-4o-mini` |
| `LOCAL_BASE_URL` / `LOCAL_MODEL` | Local OpenAI-compatible endpoint and model | Ollama / `llama3.1` |
| `OCR_LANG` | Tesseract language passed to image OCR | `eng` |
| `S3_ENDPOINT`, `S3_REGION`, `S3_BUCKET` | Object-storage target for uploaded originals | local MinIO values |
| `S3_ACCESS_KEY`, `S3_SECRET_KEY` | Object-storage credentials | local MinIO values |
| `S3_FORCE_PATH_STYLE` | Use path-style S3 requests | `true` |
| `REBUILD_WEBHOOK_URL` | POST target after a successful worker job | empty |
| `PUBLIC_API_URL` | API origin embedded in the static site | `http://localhost:3000` |
| `PUBLIC_SITE_NAME` | Site name used by web pages and feeds | `Collective Agreements` |
| `PUBLIC_SITE_URL` | Public web origin used for canonical URLs, sitemap, and Atom feed | `http://localhost:4321` |
| `WEB_ORIGIN` | Comma-separated browser origins allowed to make credentialed API requests | empty |

Set `PUBLIC_SITE_URL` and `WEB_ORIGIN` in production. The API permits localhost automatically only outside production; if the deployed site origin is absent from `WEB_ORIGIN`, browsers cannot call the API with session cookies. Keep `PUBLIC_API_URL` and `PUBLIC_SITE_URL` distinct: the first is the browser-facing API origin and the second is the static site's public origin.

`SESSION_SECRET` appears in `.env.example`, but the current session implementation stores random session identifiers in Postgres and does not read that variable. Its mismatch with the example file is tracked in [known issues](./internal/known-issues.md).

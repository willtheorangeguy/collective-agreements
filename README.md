<h1 align="center">Collective Agreements</h1>

<h4 align="center">A public, community-reviewed library that makes collective agreements searchable and understandable.</h4>

<!-- Badges -->
<div align="center">
  <a href="https://github.com/willtheorangeguy/collective-agreements/issues"><img alt="GitHub Issues" src="https://img.shields.io/github/issues/willtheorangeguy/collective-agreements"></a>
  <a href="https://github.com/willtheorangeguy/collective-agreements/pulls"><img alt="GitHub Pull Requests" src="https://img.shields.io/github/issues-pr/willtheorangeguy/collective-agreements"></a>
  <a href="#license"><img alt="License: not provided" src="https://img.shields.io/badge/license-not%20provided-lightgrey"></a>
</div>

<p align="center">
  <a href="#key-features">Key Features</a> ·
  <a href="#installation">Installation</a> ·
  <a href="#usage">Usage</a> ·
  <a href="#documentation">Documentation</a> ·
  <a href="#support">Support</a>
</p>

Collective Agreements accepts public agreements from around the world, extracts their text,
and produces structured English summaries. AI-generated content is published with a clear
unverified label; signed-in contributors can correct it through a moderated revision history.

## Key Features

* Search published agreements by keyword, country, sector, title, summary, or document text.
* Accept public PDFs, text, and image files, with duplicate detection and archived originals.
* Extract agreement text and create a structured AI analysis through Anthropic, OpenAI-compatible, or local models.
* Keep AI analyses, community revisions, moderation decisions, and reversions in an auditable history.
* Promote contributors to trusted editors after five accepted edits while retaining moderator controls.

## Installation

Requires Node.js 22 or later and Docker Compose.

```sh
npm install
cp .env.example .env
docker compose -f infra/docker-compose.yml up -d
npm run db:migrate && npm run seed
```

## Usage

Start the API, worker, and web application in separate terminals:

```sh
npm run dev:api
npm run worker
npm run dev:web
```

Open `http://localhost:4321`, sign in with the seeded administrator account
`admin@example.com` / `change-me-123`, and browse the demo agreements. Change the seed
password before exposing the instance to other people.

## Documentation

Full documentation lives in [`docs/`](docs/README.md):
[Quickstart](docs/quickstart.md) · [Configuration](docs/configuration.md) · [Architecture](docs/architecture.md) · [API](docs/api.md) · [Troubleshooting](docs/troubleshooting.md)

## Support

File an [issue](https://github.com/willtheorangeguy/collective-agreements/issues/new).

## Contributing

Contributions are welcome. Read [development guidance](docs/development.md) for the local
workflow and the in-product [contribution guide](apps/web/src/pages/contribute.astro) for
editorial rules.

## License

No license has been provided for this repository. See the documented issue in
[`docs/internal/known-issues.md`](docs/internal/known-issues.md).

# Collective Agreements — API

The API listens on `PORT` (3000 by default) and returns JSON except for archived files. Protected endpoints use the `session` HTTP-only cookie set by the authentication endpoints. Browser clients must originate from `WEB_ORIGIN` in production.

| Method | Endpoint | Access | Purpose |
| --- | --- | --- | --- |
| `GET` | `/healthz` | public | Health response: `{ "ok": true }`. |
| `POST` | `/auth/register` | public | Create an account from `email` and 8–200 character `password`. |
| `POST` | `/auth/login` | public | Start a session from `email` and `password`. |
| `POST` | `/auth/logout` | public | Clear the session cookie. |
| `GET` | `/auth/me` | signed in | Return the current user. |
| `POST` | `/submissions` | signed in | Submit a public agreement for processing. |
| `GET` | `/submissions/mine` | signed in | List the caller's latest 50 submissions. |
| `GET` | `/agreements` | public | Browse published agreements. |
| `GET` | `/agreements/facets/countries` | public | Return country facets and counts. |
| `GET` | `/agreements/stats` | public | Return published-agreement, country, edit, and pending-edit counts. |
| `GET` | `/agreements/feed/changes` | public | Return recent approved revisions. |
| `GET` | `/agreements/:slug` | public | Return a published agreement, its live content, and AI metadata. |
| `GET` | `/agreements/:slug/history` | public | Return all revisions for an agreement. |
| `GET` | `/agreements/:slug/status` | public | Return processing, published, failed, or rejected status. |
| `GET` | `/agreements/:slug/file` | public | Stream the archived original when one exists. |
| `POST` | `/agreements/:slug/revisions` | signed in | Propose a partial edit. |
| `GET` | `/me/revisions` | signed in | List the caller's latest 50 non-AI revisions. |
| `GET` | `/moderation/pending` | moderator/admin | List pending revisions. |
| `POST` | `/moderation/revisions/:id/decision` | moderator/admin | Approve or reject a revision. |
| `POST` | `/moderation/agreements/:slug/revert` | moderator/admin | Restore an approved revision as a new revision. |
| `POST` | `/moderation/agreements/:slug/takedown` | moderator/admin | Take down or restore an agreement. |
| `GET` | `/moderation/audit` | moderator/admin | Read audit entries. |
| `GET` | `/moderation/users` | admin | List users. |
| `POST` | `/moderation/users/:id/role` | admin | Set a user role. |

Submit `multipart/form-data` to `POST /submissions` with a JSON `meta` field and exactly one of `file` or `text`. `meta` needs a `source_url` and one to ten ISO 3166-1 alpha-2 `country_codes`; `sector`, `signed_date`, and `notes` are optional. Pasted text needs at least 1,000 characters. Files may be PDF, plain text, PNG, JPEG, TIFF, or WebP and must be 25 MB or smaller. Each user may make ten submissions per rolling 24 hours.

`GET /agreements` accepts `country`, `sector`, `q`, `sort` (`newest`, `oldest`, `updated`, `title`, or `expiry`), `limit` (1–100), and `offset`. A revision proposal accepts `{ "fields": { ... }, "editSummary": "...", "baseRevisionId": "..." }`; it merges submitted fields over the current revision. Pass the current revision ID to receive a `409` instead of overwriting a newer edit.

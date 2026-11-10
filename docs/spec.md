# Tripo — Project Spec

Read this file first when working on Tripo. Product UI, API docs, report, and slides are in English.

## 1. Product and MVP goal

Tripo helps a group plan a multi-day trip, organize a day-by-day itinerary and budget, and share a read-only trip link. A travel-story blog is a secondary feature.

The MVP demo is complete when a teammate can clone the repository, configure the documented services, apply migrations and seeds, sign in, create and edit a trip, add activities, see recorded spend and remaining/over-budget totals, create a share link, open it signed out, and revoke it so it no longer works.

## 2. Stack and deployment

- Frontend: React + Vite in `web/`.
- API: Node.js + Express REST API using ES modules in `api/`.
- Authentication: Clerk. The API verifies Clerk sessions; the app stores a local user profile mapped by Clerk user ID. Tripo does not store passwords.
- Database: MySQL through `mysql2/promise`; schema migrations and seed data live in `api/database/`. Use TiDB Cloud Starter in MySQL compatibility mode for the shared demo database; the provisioned database is named `tripo` and requires TLS.
- Hosting: deploy `web/` and `api/` as separate Vercel projects from this monorepo. The API runs as a Vercel Function. The shared database is managed and remote; do not use a teammate's laptop database.
- Local development: developers may use local MySQL. Production and shared demos must use the managed remote database, never a teammate's laptop database.
- Secrets: never commit `.env`, keys, or passwords. Commit `.env.example` only. Keep Clerk secret, database credentials, and provider secrets in the API deployment's environment settings. Only public client keys may use the Vite `VITE_` prefix.

The API must handle requests without relying on in-memory state surviving between invocations. Long-running workers, always-open WebSocket sessions, and realtime collaboration are out of scope. Keep API requests short and store shared or durable state in MySQL or another explicitly selected managed service.

## 3. Feature scope

### Core MVP — required for the demo

1. **Authentication and profile**: register/sign in/sign out through Clerk. Create or update a local profile from the verified Clerk identity. Reject unauthenticated writes.
2. **Trips**: an organizer creates, reads, updates, and deletes a trip with title, one or more destinations, start date, end date, group size, one currency code, and whole-trip budget.
3. **Itinerary**: one day per calendar date in the inclusive trip date range. The organizer adds, edits, and deletes activities for a day.
4. **Activities**: category, time, place/city/address, planned cost, actual spend (nullable), note, manual visited check-in, and an “Open in Google Maps” search link built from the address (no Maps API key).
5. **Budget**: show recorded spend, remaining or over-budget amount, and a breakdown by activity and category. Planned cost is not counted as recorded spend.
6. **Destinations and places**: browse curated seed data for destinations and places (sightseeing, food/drink, accommodation), and associate destinations with trips.
7. **Read-only sharing**: the organizer enables an unlisted link, can revoke or regenerate it, and anyone with an active link can read only the fields intended for sharing.

### Secondary — only after the core trip flow works

- **Travel-story blog**: visitors browse public posts; signed-in users publish, like a post once, and comment.
- **Trip photos** (Cloudinary) and **weather** (OpenWeather through the API) are stretch goals. Neither may block the core demo.

## 4. Rules and invariants

- **Dates**: start and end are inclusive. Number of days = calendar difference + 1. Reject an end date before the start date. Activities must belong to a date inside the trip range.
- **Money**: use MySQL `DECIMAL`, never floating-point storage. Reject negative values. One currency per trip; no conversion.
- **Actual spend**: `NULL` means not recorded, not zero. Totals treat `NULL` as zero and label the sum “recorded spend.”
- **Budget**: remaining = trip budget − sum of recorded actual spend. Clearly show the over-budget amount when remaining is negative.
- **Categories**: sightseeing/check-in, food/drink, accommodation, transport, shopping, other.
- **Permissions**: enforce authorization on the server for every write. Only the trip owner may edit or delete their trip, its itinerary, or its share settings. Hiding a UI control is not authorization.
- **Share token**: generate a random high-entropy token on the server; never expose a sequential trip ID as the token. Revoked or replaced tokens stop working. The public endpoint returns only reader-safe fields and excludes private posts, credentials, and internal identifiers not needed by the viewer.
- **Secrets and logs**: never return passwords, credentials, Clerk tokens, or share tokens in logs or error messages.
- **Errors**: API errors use `{ "error": { "code": "...", "message": "..." } }`.
- **SQL**: use parameterized queries.
- **UI states**: every screen handles loading, empty, error, and success states.

## 5. Data model

Core tables: `users` (with unique `clerk_user_id`), `trips`, `trip_destinations`, `trip_days` or an equivalent date-based representation, `activities`, and `share_links` (or a token on `trips`).

Secondary tables: `destinations`, `places`, `posts`, `post_comments`, `post_likes` (unique per user and post), and optional `trip_photos`.

Use foreign keys and database constraints for invariants that can be safely enforced in MySQL. Keep migrations repeatable where practical and seeds fictional and safe to rerun.

## 6. API and team conventions

- REST routes live under `/api`, use plural nouns, and return JSON. `GET /api/health` reports API and database readiness without exposing credentials.
- Keep `docs/api/openapi.yaml` aligned with implemented endpoints and request/response shapes.
- Branches use `feat/<short-name>`. Each PR should be one coherent, reviewable change; a teammate runs the relevant flow before merge.
- Record material choices and their rationale in `docs/decisions.md`.
- Build features as vertical slices across UI, API, and database migration. Agree on request/response shapes before parallel UI/API work.

## 7. Out of scope

Realtime collaboration, chat, notifications, multiple editors, currency conversion, bill splitting, payments, scraping Google Maps, embedded maps, long-range forecasts, and video.

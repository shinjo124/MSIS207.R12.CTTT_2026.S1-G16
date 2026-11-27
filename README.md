# Tripo

Tripo helps a group plan a multi-day trip together: pick destinations, build a day-by-day itinerary, track the budget against what was actually spent, invite friends to edit, share a read-only link, and publish travel stories.

**Course project** — MSIS207 Web Application Development (MSIS207.R12.CTTT_2026.S1), Group 16, University of Information Technology (UIT – VNU-HCM). Instructor: Nguyễn Thanh Bình, Ph.D.

| | Link |
|---|---|
| Live web app | <https://www.tripo.website> |
| Public API base URL | <https://api.tripo.website/api> |
| API documentation (Swagger UI) | <https://api.tripo.website/api-docs> |
| OpenAPI document (JSON) | <https://api.tripo.website/api-docs/openapi.json> |
| Health check | <https://api.tripo.website/api/health> |

## Team

| Member | Student ID | Main work |
|---|---|---|
| Trần Quốc Kiệt | 24520916 | Authentication (Clerk), trips and activities API, trip form and itinerary UI, destination search, API docs deployment |
| Cao Phan Lâm | 24520926 | Project setup, database schema and hosting, stories feed and photo uploads, sharing, collaboration and live sync, calendar, dashboard, weather and news |

## Features

- **Accounts** — email sign-in with Clerk; each account gets a Tripo profile.
- **Trips** — title, one or more catalog or trip-specific custom destinations, dates (up to 60 days), group size, budget and currency, trip time zone. Catalog search ignores accents ("da lat" finds Đà Lạt).
- **Itinerary and calendar** — activities per day with time, duration, category, place, planned cost and actual spend; mark places as visited.
- **Budget** — planned vs. actual totals per day and per trip, exact decimal arithmetic.
- **Collaboration** — invite members with a single-use link (24 h); edits from others appear automatically; conflicting edits are detected instead of silently overwritten.
- **Read-only sharing** — the owner can create and revoke a public share link.
- **Stories** — a public feed of travel posts with photos, likes and comments; authors can edit or delete their own stories.
- **Dashboard** — upcoming trip, today's plan, budget, weather forecast (OpenWeather) and travel news.
- **Vietnamese and English** — a VIE / ENG switch in the top bar; the first visit follows the browser language and the choice is remembered.
- **Explore Vietnam** — all 34 provinces and centrally run cities (2025 map), grouped by region and searchable by current or former province name; each has a page of places worth visiting (seed 005, Vietnamese and English).
- **More place ideas** — on each province page and when choosing destinations, six quick types (sights, food, cafés, nature, history, markets) load nearby places from OpenStreetMap via Geoapify. The box is hidden until `GEOAPIFY_API_KEY` is set. Province pages also show a map (Leaflet + OpenStreetMap tiles) with pins for catalogue places (after `npm run places:geocode`) and the current ideas.
- **Tribot** — an AI travel assistant in a floating chat button on every signed-in page (Google Gemini). On a trip page it answers questions about the trip's schedule and budget, suggests activities that can be added to the plan with one click; on other pages it answers general travel questions or lets you pick a trip.

## Tech stack

| Layer | Technology |
|---|---|
| Front end | React 19 + Vite (single-page app), `@clerk/react` |
| Back end | Node.js + Express 5 (ES modules), RESTful JSON API |
| Database | MySQL (local) / TiDB Cloud Starter, MySQL-compatible (production), accessed with `mysql2` and parameterized SQL |
| Auth | Clerk (Bearer session token verified by `@clerk/express`) |
| Files | Cloudinary (story photos) |
| API docs | OpenAPI 3 (`docs/api/openapi.yaml`) served with Swagger UI |
| Hosting | Vercel — two projects (`web/`, `api/`) on custom domains |

```
Browser (React SPA)  ──HTTPS + JSON──▶  Express REST API  ──SQL/TLS──▶  TiDB (MySQL)
www.tripo.website        Bearer token      api.tripo.website                │
        │                                       ├──▶ Clerk (verify user)
        └──▶ Clerk (sign-in UI)                 ├──▶ Cloudinary (photos)
                                                └──▶ OpenWeather, RSS news
```

## API overview

All endpoints are under `/api`, exchange JSON, and return errors as `{ "error": { "code", "message" } }`. Protected endpoints need `Authorization: Bearer <Clerk session token>`. The full contract (29 paths, 41 operations) is in [Swagger UI](https://api.tripo.website/api-docs).

| Resource | Endpoints |
|---|---|
| Health, profile | `GET /api/health`, `GET /api/auth/me` |
| Destinations | `GET /api/destinations?q=`, `GET /api/destinations/{id}/places` |
| Trips | `GET/POST /api/trips`, `GET/PUT/DELETE /api/trips/{tripId}`, `GET /api/trips/{tripId}/version` (long polling) |
| Activities | `POST /api/trips/{tripId}/activities`, `PATCH/DELETE /api/activities/{activityId}` |
| Members | `POST /api/trips/{tripId}/invitations`, `POST /api/trips/invitations/accept`, `GET /api/trips/{tripId}/members`, `DELETE …/members/{userId}` |
| Sharing | `GET/POST/DELETE /api/trips/{tripId}/share`, `GET /api/share/{token}` (public) |
| Stories | `GET/POST /api/posts`, `PATCH/DELETE /api/posts/{id}` (own story), `GET /api/posts/mine`, likes and comments |
| Extras | `POST /api/assistant`, `POST /api/trips/{tripId}/assistant`, `GET /api/trips/{tripId}/weather`, `PUT /api/trips/{tripId}/days/{date}/destination`, `GET /api/news` |

Typical status codes: `200`, `201` created, `204` deleted, `400` validation, `401` not signed in, `404` not found or not allowed, `409` conflicting edit, `429` rate limited.

## Repository structure

```
api/                 Express API
  src/routes/        one router per resource (trips, activities, posts, …)
  src/middleware/    auth, profile, upload and write-limit checks
  src/services/      validation rules, data shaping, limits
  database/          migrations/ (001–018, apply in order) and seeds/
  test/              node:test unit and route tests
web/                 React + Vite app
  src/features/      trips (incl. calendar), posts, dashboard
  src/lib/api.js     fetch wrapper that adds the Clerk token
  test/
docs/
  api/openapi.yaml   API contract
  spec.md            product specification
  decisions.md       decision log
  adr/               architecture decision records
  deployment.md      Vercel/TiDB setup and migration rollout notes
  working-on-tripo.md  code map and team workflow
```

## Run locally

Requirements: Node.js 24 LTS and MySQL 8.

1. Create the database:

   ```sql
   CREATE DATABASE tripo_dev CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
   ```

2. Apply every file in `api/database/migrations/` in numeric order, then every file in `api/database/seeds/` in numeric order (seed data is fictional and repeatable).
3. Copy `api/.env.example` to `api/.env` and fill in the MySQL values, `CLERK_SECRET_KEY`, and (optional) Cloudinary, OpenWeather and Gemini (`GEMINI_API_KEY`) keys. Keep `DB_SSL=false` for local MySQL.
4. Copy `web/.env.example` to `web/.env.local` and set `VITE_CLERK_PUBLISHABLE_KEY`.
5. Start both apps:

   ```bash
   cd api && npm install && npm run dev    # http://localhost:4000/api/health
   cd web && npm install && npm run dev    # http://localhost:5173
   ```

Swagger UI runs locally at <http://localhost:4000/api-docs>. Run tests with `npm test` in `api/` and in `web/`.

Secrets (Clerk secret, database password, Cloudinary secret, OpenWeather key, Gemini key) belong only in `api/.env`; never commit `.env` files or put secrets in `VITE_*` variables.

## Further reading

- [Deploying Tripo](docs/deployment.md) — Vercel projects, environment variables, custom domains, migration rollout notes
- [Working on Tripo](docs/working-on-tripo.md) — code map, verification commands, change workflow
- [Product direction](PRODUCT.md) and [specification](docs/spec.md)

## License

[MIT](LICENSE)

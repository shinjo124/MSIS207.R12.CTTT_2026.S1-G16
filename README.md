# Tripo

Tripo helps a group plan a multi-day trip, organize a day-by-day itinerary and budget, share a read-only trip link, and publish travel stories.

## Stack

- `web/`: React + Vite
- `api/`: Node.js + Express + MySQL
- `docs/api/openapi.yaml`: API contract, served with Swagger UI at `/api-docs`

## Local setup

1. Install Node.js 24 LTS and start MySQL (Laragon is the guide's local setup).
2. Create a database named `tripo_dev` using `utf8mb4`:

   ```sql
   CREATE DATABASE tripo_dev CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
   ```
3. Copy `api/.env.example` to `api/.env` and set the local MySQL values.
4. Apply every SQL file in `api/database/migrations/` in numeric order, then run every file in `api/database/seeds/` in numeric order. The seed data is fictional and repeatable.
5. In `api/`, run `npm install` and `npm run dev`.
6. Copy `web/.env.example` to `web/.env.local`; in `web/`, run `npm install` and `npm run dev`.

The API health endpoint is `http://localhost:4000/api/health`. Swagger UI is at `http://localhost:4000/api-docs`. Clerk email sign-in needs a Clerk app's keys; photo upload needs Cloudinary credentials. The Clerk secret and Cloudinary secret belong only in `api/.env`. The Vite publishable key is public and belongs in `web/.env.local`. `DB_SSL=false` is for local MySQL; set it to `true` for the hosted database.

## Deployment

Deploy `web/` and `api/` as separate Vercel projects connected to this Git repository, setting each project's Root Directory to its corresponding folder. For the API project, enable **Include source files outside of the Root Directory** because `/api-docs` loads `docs/api/openapi.yaml` from the repository root.

The shared database target is TiDB Cloud Starter in MySQL compatibility mode, using database `tripo`. Migrations `001` through `004` and destination/place seed (`001_demo.sql`) have been applied. TLS and TiDB `CHECK` constraint enforcement were verified. For a fresh TiDB instance, set `tidb_enable_check_constraint` to `ON` before applying migrations. The API has connected to this database from the development machine; verify the deployed health endpoint and browser requests before treating deployment as ready.

Set the TiDB host, port (`4000`), database (`tripo`), user, password, `DB_SSL=true`, `CLERK_SECRET_KEY`, `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, and `CLOUDINARY_API_SECRET` in the API project's Vercel environment. Cloudinary credentials are used server-side for story and trip photo uploads; keep the API secret only in the API project. Set `CLIENT_ORIGIN` to the exact web origin (`https://tripo-web.vercel.app` for the current demo). The web code defaults to `https://tripo-api-eta.vercel.app` in production; if `VITE_API_BASE_URL` is set in Vercel, it overrides that default and must contain the API origin. Put Clerk's publishable key in the web project's environment and keep Clerk's secret and database credentials only in the API project's environment. Vite embeds `VITE_*` values at build time, so redeploy the web after changing one. Never commit real `.env` files or put server secrets in Vite variables.

To show the fictional public story in the demo feed, execute `api/database/seeds/002_demo_trip_and_story.sql` against the shared database after migrations and `001_demo.sql`. It creates a sample trip and public post, and uses duplicate checks so it can be re-run safely. The feed stays empty until this seed has been applied to the database used by the deployed API. The free database quota can pause new connections after it is exceeded; see `docs/decisions.md` for the limits and hosting constraints.

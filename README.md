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

Deploy `web/` and `api/` as separate Vercel projects connected to this Git repository, setting each project's Root Directory to its corresponding folder. For the API project, enable **Include source files outside of the Root Directory** because `/api-docs` loads `docs/api/openapi.yaml` from the repository root. Use a TiDB Cloud Starter instance in MySQL compatibility mode for the shared database target. Set its host, port (`4000`), database, user, and password as API environment variables, and set `DB_SSL=true`. Before applying migrations, run `SET GLOBAL tidb_enable_check_constraint = ON;` in TiDB so the schema's `CHECK` constraints are enforced, then apply the migrations and seeds to that remote database. Set `CLIENT_ORIGIN` to the exact deployed frontend origin and `VITE_API_BASE_URL` to the deployed API URL. Put Clerk's publishable key in the web project's environment and keep Clerk's secret and database credentials only in the API project's environment. Never commit real `.env` files or put server secrets in Vite variables. The free database quota can pause new connections after it is exceeded; see `docs/decisions.md` for the limits and hosting constraints.

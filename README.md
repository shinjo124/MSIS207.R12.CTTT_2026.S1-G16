# Tripo

Tripo helps a group plan a multi-day trip, organize a day-by-day itinerary and budget, share a read-only trip link, and publish travel stories.

## Stack

- `web/`: React + Vite
- `api/`: Node.js + Express + MySQL
- `docs/api/openapi.yaml`: API contract, served with Swagger UI at `/api-docs`

## Local setup

1. Install Node.js 24 LTS and start MySQL (Laragon is the guide's local setup).
2. Create a local database named `tripo_dev` (matching `api/.env.example`) using `utf8mb4`:

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

The shared database target is TiDB Cloud Starter in MySQL compatibility mode, using database `tripo`. Historical checks recorded migrations `001` through `006` and destination seeds `001_demo.sql` and `003_vietnam_destinations.sql` as applied, with TLS and TiDB `CHECK` constraint enforcement verified; the current deployed state must be checked again. For a fresh TiDB instance, set `tidb_enable_check_constraint` to `ON` before applying migrations. See the [public production release checklist](docs/working-on-tripo.md#public-production-release-checklist) before launch.

Set the TiDB host, port (`4000`), database (`tripo`), user, password, `DB_SSL=true`, `CLERK_SECRET_KEY`, `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, and `CLOUDINARY_API_SECRET` in the API project's Vercel environment. Cloudinary credentials are used server-side for story and trip photo uploads; keep the API secret only in the API project. Set `CLIENT_ORIGIN` to the exact web origin (`https://tripo-web.vercel.app` for the current demo). The web code defaults to `https://tripo-api-eta.vercel.app` in production; if `VITE_API_BASE_URL` is set in Vercel, it overrides that default and must contain the API origin. Put Clerk's publishable key in the web project's environment and keep Clerk's secret and database credentials only in the API project's environment. Vite embeds `VITE_*` values at build time, so redeploy the web after changing one. Never commit real `.env` files or put server secrets in Vite variables.

For a local demo, `api/database/seeds/002_demo_trip_and_story.sql` creates a fictional trip and labelled sample stories after migrations and `001_demo.sql`, using duplicate checks so it can be re-run safely. An earlier unlabelled sample story from this seed is labelled when the seed runs again. Review the content and its impact before applying it to production; the current sample stories do not include images. The free database quota can pause new connections after it is exceeded; see `docs/decisions.md` for limits and hosting constraints.

Before deploying the updated API, apply `api/database/migrations/007_photo_cleanup.sql`. Trip deletion queues Cloudinary public IDs in the same transaction as the database delete. If storage is unavailable, run `npm run photos:retry` from `api/` using the same database and Cloudinary configuration. Failed IDs stay queued for the next run.

## Team development

See [Working on Tripo](docs/working-on-tripo.md) for the code map, verification commands, current implementation boundaries, and change workflow. `PRODUCT.md` records the agreed product direction; planned features there are not necessarily implemented yet.

Before deploying the calendar API, apply `api/database/migrations/008_activity_duration.sql` to add the nullable activity duration column. Existing activities retain an unset duration. Deploy the migration before the API; the prior API ignores the new column.

Before deploying the collaboration API, back up the database and apply `api/database/migrations/009_trip_members.sql` after migration 008. Existing trips remain owned by their current owners. Apply the migration before deploying the API; the prior API ignores the new tables. Roll back the API first if needed and retain the new tables to preserve memberships; dropping them destroys collaboration data. Owner-created invitation tokens are single-use secrets valid for 24 hours. Collaboration endpoints are documented in OpenAPI; the web app watches shared trip revisions through bounded long polling.

Before deploying activity conflict detection, back up the database and apply `api/database/migrations/010_activity_version.sql` after migration 009. Deploy the new web client before the API; after the API update, older web clients must reload because PATCH and DELETE now require the activity version and reject missing versions. Roll back the API first if necessary and retain the version column. Activity PATCH and DELETE reject stale versions with 409.


Before enabling revision-based polling, back up the database and apply `api/database/migrations/011_trip_revision.sql` after migration 010. Quiesce all old API writers during cutover: every writer must run revision-aware code before clients rely on the version endpoint. Direct SQL changes and requests to old deployments bypass the revision and can be missed. Deploy the revision-aware API and reload active clients; do not enable revision polling if old writers cannot be stopped. For rollback, stop revision-polling clients first, roll back the API, and retain the revision column. No production quota measurements are implied.

Trip PUT now requires the revision captured when editing starts and rejects stale writes with 409. Deploy the compatible web client before the API, then reload older clients; they cannot save trip edits against the new API until reloaded. Roll back the API first if necessary. This uses migration 011 and needs no additional schema change.

### Optional weather

Weather is disabled until `OPENWEATHER_API_KEY` is set in the API environment; never put this key in `VITE_*` or source control. Back up the database and apply `api/database/migrations/012_trip_weather_location.sql` after 011 before deploying the new API. If rolling back, revert the API first and retain the new table to preserve configured locations. Then a trip owner or member may explicitly confirm a trip destination's coordinates and IANA time zone in the dashboard or calendar. Removing the location disables weather for that trip. Only those coordinates and the server key are sent to OpenWeather; trip names and user identities are not sent. Data comes from OpenWeather's [current conditions](https://openweathermap.org/api/current) and [5-day, 3-hour forecast](https://openweathermap.org/api/forecast5). Forecast labels show an actual sample nearest noon on the selected local date, not a daily high or low; dates outside the provider horizon have no forecast. The selected time zone must match the coordinates, including daylight-saving rules.

Responses are cached for 10 minutes in each server process and simultaneous requests in that process are coalesced. The weather endpoint permits 30 requests per 15 minutes per IP in each process. Serverless instances do not share this cache or limiter, so these are not account-wide provider quota guarantees; monitor usage and provider charges/limits before enabling. Provider credentials, subscription and license terms are the deployer's responsibility; the free OpenWeather license can include attribution/share-alike obligations. The interface attributes OpenWeather. Check the [official pricing](https://openweathermap.org/price) and [license explainer](https://openweathermap.org/storage/app/media/documents/License_explainer_25_Feb_25.pdf) for the selected plan. No live provider access is required by automated tests.

Trip time zones are stored separately from weather locations. Back up the database and apply `api/database/migrations/013_trip_time_zone.sql` after 012 before deploying the new API. Existing trips keep an unknown time zone until a user explicitly confirms an IANA zone in the trip form. Older clients may omit the field: an unchanged destination list preserves the zone, while changing destinations without confirming a zone clears it. The dashboard and calendar determine today in the confirmed trip zone; if absent, they do not infer the device zone. Weather forecasts are not matched to trip dates when the two zone identifiers differ. Activity times remain local wall times; ambiguous or nonexistent DST times are not currently resolved or validated. Roll back the API first if needed and retain the new column to preserve zone settings.

Before deploying shared write limits, apply `api/database/migrations/014_write_limits.sql` after earlier migrations. Post attempts are limited to 15 per account and 100 globally per 15 minutes; multipart story and trip-photo uploads share a limit of 10 per account and 40 globally. Invalid attempts count. These are fixed windows, not provider quota guarantees; registration and general API traffic still need protection. All API instances must use the new code for shared limits to apply. On rollback, roll back the API first and retain the table. If the database is unavailable, protected writes fail closed.

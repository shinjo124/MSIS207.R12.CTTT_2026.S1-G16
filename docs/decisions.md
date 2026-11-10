# Tripo — Decisions

Keep this log short. Record decisions that affect architecture, scope, or team integration; revisit a decision only when a stated condition changes.

## D-001 — Use Clerk for authentication

- **Status:** Decided
- **Decision:** Clerk owns sign-up, sign-in, sign-out, and credential security. The API verifies Clerk sessions and maps the Clerk user ID to a local `users` row.
- **Reason:** This avoids building and maintaining password handling for a small MVP. Tripo stores no password hashes.
- **Consequence:** Keep Clerk keys in deployment secrets and update the spec/API contract when auth behavior changes.

## D-002 — Use ES modules

- **Status:** Decided
- **Decision:** Use JavaScript ES modules for both `web/` and `api/`.
- **Reason:** Both packages already declare `"type": "module"`; changing the implementation to CommonJS adds migration work without improving the MVP.
- **Consequence:** Documentation and examples must use ESM conventions.

## D-003 — Deploy both web and API on Vercel

- **Status:** Decided
- **Decision:** Deploy `web/` and `api/` as separate Vercel projects from the monorepo. The Express API runs as a Vercel Function.
- **Reason:** One Git-connected platform gives the class a simple preview/deploy workflow and avoids Render Free's idle spin-down for the API.
- **Consequences and limits:** The API is request-oriented, not an always-running server. Do not depend on process memory for durable/shared state or background work. WebSockets are out of MVP scope; Vercel's current WebSocket support is beta and function connections have a maximum duration. A Vercel incident can affect both deployments, though a static frontend may still load during an API-only failure.
- **Cost constraint:** Target Vercel Hobby for a non-commercial school demo, subject to its current usage limits and terms. Recheck current plan limits before demo day.

## D-004 — Keep MySQL and use a managed remote database in deployment

- **Status:** TiDB Cloud Starter is provisioned. Migrations `001`–`004` and destination/place seed `001_demo.sql` are applied; TLS connection and CHECK constraint enforcement were verified from the development machine. Vercel environment configuration and a deployed API smoke check remain.
- **Decision:** Keep local MySQL for development. Use a TiDB Cloud Starter instance in MySQL compatibility mode for the shared demo, with TLS enabled; never use a teammate's laptop as the shared database.
- **Reason:** The project already uses MySQL and `mysql2`; Starter currently includes a free monthly quota without requiring a credit card.
- **Consequences and limits:** The shared database is named `tripo`. Starter currently includes 5 GiB row storage, 5 GiB columnar storage, and 50 million request units per month. When a free quota is reached, new connections are denied until usage resets or the instance is upgraded. Free Starter backups retain one day and manual backups are unavailable. Enable TLS with `DB_SSL=true`. TiDB disables `CHECK` constraint enforcement by default, so enable `tidb_enable_check_constraint` before applying migrations; enforcement is enabled on the current instance. Keep the pool size within provider limits and test the deployed API before the demo. Recheck quotas and terms before demo day.

## D-005 — Prioritize the trip-planning vertical slice

- **Status:** Decided
- **Decision:** The required demo is sign-in, trip CRUD, itinerary activities, recorded-spend/budget totals, and read-only share/revoke. Destinations support this flow; blog is secondary; photos and weather are stretch goals.
- **Reason:** The core planner is the product's main value and needs to work end to end before optional features.
- **Consequence:** Do not expand blog, photo, or weather work while the core demo acceptance flow is incomplete.

## D-006 — No realtime requirement in the MVP

- **Status:** Decided
- **Decision:** Use ordinary REST requests for the MVP; do not add WebSockets, chat, or live collaboration.
- **Reason:** Current requirements do not need bidirectional live updates, and removing realtime infrastructure keeps deployment and debugging smaller.

## References

- [Vercel Hobby plan](https://vercel.com/docs/plans/hobby)
- [Vercel Express deployment guide](https://vercel.com/kb/guide/ship-an-express-app-on-vercel)
- [Vercel WebSocket limits and behavior](https://vercel.com/kb/guide/do-vercel-serverless-functions-support-websocket-connections)
- [TiDB Cloud Starter quotas](https://docs.pingcap.com/tidbcloud/select-cluster-tier/?compatibility=mysql&plan=starter)
- [TiDB Cloud TLS with mysql2](https://docs.pingcap.com/tidb/dev/dev-guide-sample-application-nodejs-mysql2/)
- [TiDB CHECK constraint behavior](https://docs.pingcap.com/tidb/dev/constraints/)
- [TiDB Cloud Starter backup limits](https://docs.pingcap.com/tidbcloud/backup-and-restore-serverless/)

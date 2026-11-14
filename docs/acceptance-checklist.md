# Integration acceptance checklist

Checked 2026-11-14 against the configured TiDB database and current production URLs.

| Task | Check | Result / evidence |
| --- | --- | --- |
| T2 | Auth rejects requests without a session | Pass: local `GET /api/trips` returns 401 `UNAUTHENTICATED`. Clerk sign-up/sign-in still needs a signed-in browser session. |
| T3 | Deployment and database health | Pass: production `/api/health` returns 200 with `database: connected`; production web root returns 200. |
| T4 | Create, read, update, delete trip | Pending: requires an authenticated owner session. |
| T5 | Destination search, places, category filter | Pass: after applying migration 006 and seed 003, `GET /api/destinations?scope=all` returns 49 destinations; `/api/destinations/1/places` returns places. UI filter helper test passes. The new UI still needs deployment/browser acceptance. |
| T6 | Activity CRUD and actual spend | Pending: requires an authenticated trip owner session. |
| T7 | Share link lifecycle and public itinerary | Partial: date grouping helper test passes and the UI is read-only. Enable/replace/revoke and public page need an authenticated browser session and deployment of this change. |
| T8 | Budget total, category totals, remaining and over-budget | Pass for helper calculations: API tests cover hand-checkable totals, recorded zero, and over-budget. Trip-detail route/UI integration still needs an authenticated trip. |
| T9 | Upload image to Cloudinary | Pass locally: a synthetic 1×1 PNG uploaded to the verification folder and was deleted. Production upload was not exercised. |
| T10 | API docs | Pass: production Swagger UI returns 200; current OpenAPI YAML parses as 3.1.0 and includes the shared itinerary and budget summary schemas. |
| T11 | Acceptance across T2 and T4–T10 | Partial: infrastructure, public data, auth rejection, helpers, and upload were checked. Full owner-session trip/activity/share acceptance and screenshots/demo evidence remain. |

## Verification commands

- `api`: `npm test` — 3 tests passed.
- `web`: `npm test` — 1 test passed; `npm run build` — passed.
- Production endpoints checked: `/api/health`, `/api-docs/`, `/api/destinations?scope=all`, and web `/`.

## Follow-up before demo

- Deploy the current web/API changes, then sign in and run the T4/T6/T7/T8 acceptance flow on one test trip.
- Check the shared link in an anonymous browser, then replace and revoke it from the owner session.
- Capture screenshots or a short screen recording for the final demo; remove the test trip afterward if it was created solely for acceptance.

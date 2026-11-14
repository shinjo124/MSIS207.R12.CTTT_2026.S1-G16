# Integration acceptance checklist

Checked 2026-11-14 against the configured TiDB database and current production URLs.

| Task | Check | Result / evidence |
| --- | --- | --- |
| T2 | Auth rejects requests without a session | Pass: local `GET /api/trips` returns 401 `UNAUTHENTICATED`. Clerk sign-up/sign-in itself was not exercised during this acceptance run. |
| T3 | Deployment and database health | Pass: production `/api/health` returns 200 with `database: connected`; production web root returns 200. |
| T4 | Create, read, update, delete trip | Pass: signed-in production session created, opened, updated, and deleted synthetic trips; both pre-existing trips were preserved. |
| T5 | Destination search, places, category filter | Pass: production trip form showed seeded places for Đà Lạt and the Nature filter; a destination without seeded places showed the empty state. API returned 49 destinations. |
| T6 | Activity CRUD and actual spend | Pass: on a synthetic production trip, added an activity, edited its title/spend, verified the budget recomputed, then deleted the activity and test trip. |
| T7 | Share link lifecycle and public itinerary | Pass: created a link, opened it anonymously, verified date-grouped read-only itinerary, replaced it and confirmed the old link was unavailable, then revoked the replacement. |
| T8 | Budget total, category totals, remaining and over-budget | Pass: on a synthetic production trip with a ₫10 budget, recorded ₫15 actual spend and verified ₫-5 remaining and ₫5 over budget. API tests also cover category totals and recorded zero. |
| T9 | Upload image to Cloudinary | Pass locally: a synthetic 1×1 PNG uploaded to the verification folder and was deleted. Production upload was not exercised. |
| T10 | API docs | Pass: production Swagger UI returns 200; current OpenAPI YAML parses as 3.1.0 and includes the shared itinerary and budget summary schemas. |
| T11 | Acceptance across T2 and T4–T10 | Partial: production trip, activity, places, share and budget flows passed; auth rejection, health and Swagger checks passed. Cloudinary upload was only verified locally, not on production. |

## Verification commands

- `api`: `npm test` — 3 tests passed.
- `web`: `npm test` — 1 test passed; `npm run build` — passed.
- Production endpoints checked: `/api/health`, `/api-docs/`, `/api/destinations?scope=all`, and web `/`.

## Follow-up before demo

- Deploy the current web UX changes.
- Verify production Cloudinary upload if the production storage credentials are configured.
- Capture screenshots or a short screen recording for the final demo.

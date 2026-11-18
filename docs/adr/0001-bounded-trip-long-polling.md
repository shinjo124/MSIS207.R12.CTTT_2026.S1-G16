# ADR-0001: Bounded trip long polling through the shared database

Date: 2026-11-17
Status: accepted for the local implementation; deployment measurements pending
Supersedes: D-006 in `../decisions.md`

## Context

The approved calendar supports multiple editors and needs updates soon after another member saves. Existing deployments use request-oriented Express functions and a shared MySQL-compatible database. Trip writers already advance `trips.revision` transactionally; activity versions already reject stale edits. A five-second client polling delay made collaboration feel slow.

## Decision

Extend the existing version endpoint with optional `wait=1&since=<revision>`. If unchanged, the request waits for up to eight seconds, checking the authorized revision approximately every second. Each check borrows the pool only for its query; it holds no transaction or dedicated connection while waiting. The response includes `pollAfterMs: 0`, so the visible online client immediately renews the request. A changed revision triggers a full trip refresh. Browser cancellation stops subsequent checks; every query rechecks ownership/membership.

Clients pause while editing, dragging, saving, hidden, or offline. Failed requests retry after five seconds, and stale responses cannot overwrite a newer view. An older API that omits the renewal hint retains ordinary five-second polling. All writers must use the revision-aware API.

## Alternatives considered

- Short client polling: simplest, but a shorter interval increases HTTP/auth overhead and shared-IP rate-limit usage.
- A process-local WebSocket/SSE event registry: cannot distribute events reliably between independent serverless instances.
- Managed pub/sub: can reduce database polling and provide push, but adds a provider, credentials and cost management. Revisit when measured concurrency or latency justifies it.

## Consequences and verification

This adds no dependency, provider or schema change beyond existing migrations 008–013. An idle viewer creates roughly 450 version requests/hour plus approximately 3,600–4,050 revision queries/hour, excluding auth, network latency and retries. Busy trips trigger more early responses and full refreshes. Multiple viewers multiply database work. Existing per-process IP limits are not global quota controls. There is no guaranteed one-second end-to-end latency.

Tests exercise a waiting request receiving a later revision, rejected invalid revisions and revoked members, client cancellation/stale response handling, immediate renewal and the legacy fallback. Deployment must verify two independent sessions, revocation, disconnects, function duration, database latency and provider usage. The eight-second waiting budget excludes database/auth latency; configure adequate function duration.

## Release and rollback

Apply migrations through 013 before deploying the current API. Quiesce old writers before relying on revision detection. Deploy API then web; both remain compatible with the immediate version response. To roll back this transport, restore the five-second web polling behavior or the immediate version endpoint and retain revision/version columns and membership data. No data is deleted by this change. No deployment or database migration was performed by this implementation.

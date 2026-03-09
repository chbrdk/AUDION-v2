# Persona detail load: Failed to fetch / ERR_INSUFFICIENT_RESOURCES

## Symptoms

- Console: `Persona detail load failed TypeError: Failed to fetch`
- Network: `GET .../api/persona-admin/:id net::ERR_INSUFFICIENT_RESOURCES`
- Happens when opening a persona in the dashboard; can spiral (many repeated requests).

## Cause

1. **Overlapping requests**: Multiple `loadDetail` calls in flight (e.g. from effect re-runs or polling) exhaust browser connection/socket limits.
2. **Aggressive polling**: Ingestion-status polling every 2s multiplied by re-renders or unstable deps can increase request rate.

## Fix (in `msqdx-glass-persona-admin-panel.tsx`)

1. **In-flight guard**: `loadDetailInFlightRef` — skip starting a new `loadDetail` if one is already running. Ref is set `true` at start and `false` in `finally`.
2. **Reset on persona change**: When `selectedId` changes, reset the ref in the same effect that calls `loadDetail(selectedId)` so the new persona load is allowed.
3. **Polling**: Only call `loadDetail` from the interval when `!loadDetailInFlightRef.current`. Polling interval increased from 2s to 5s to reduce load.
4. **Stable polling deps**: Polling effect depends on `hasActiveIngestion` (derived from `detail?.documents` via `useMemo`), not on `detail`, to avoid re-creating the interval on every detail update.

## If it persists

- Check Network tab: which URL repeats and how often.
- Ensure the deployed build includes these changes (in-flight ref + 5s polling).
- Backend: ensure DB pool and API can handle normal request rate (see `knowledge/database-pool-timeout.md`).

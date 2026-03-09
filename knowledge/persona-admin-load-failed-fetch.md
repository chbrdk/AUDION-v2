# Persona detail load: Failed to fetch / ERR_INSUFFICIENT_RESOURCES

## Symptoms

- Console: `Persona detail load failed TypeError: Failed to fetch`
- Network: `GET .../api/persona-admin/:id net::ERR_INSUFFICIENT_RESOURCES`
- Happens when opening a persona in the dashboard; can spiral (many repeated requests).

## Cause

1. **Effect re-runs (main cause)**: The effect that loads detail had `[selectedId, loadDetail]` as deps. If `loadDetail` gets a new reference every render (e.g. from `useCallback` depending on `t` from i18n), the effect runs every render → `loadDetail(selectedId)` every time → setState → re-render → effect again → hundreds of requests.
2. **Overlapping requests**: Multiple `loadDetail` calls in flight exhaust browser connection/socket limits.
3. **Aggressive polling**: Polling interval and unstable deps can add more requests.

## Fix (in `msqdx-glass-persona-admin-panel.tsx`)

1. **Effect deps – no `loadDetail`**: The effect that loads detail when `selectedId` changes must **not** depend on `loadDetail`. Use `loadDetailRef`: set `loadDetailRef.current = loadDetail` after defining `loadDetail`, and in the effect call `loadDetailRef.current(selectedId)` with deps **only `[selectedId]`**. So the effect runs exactly once per `selectedId` change.
2. **Polling effect**: Same idea – use `loadDetailRef.current(selectedId)` in the interval and remove `loadDetail` from the effect deps; deps stay `[hasActiveIngestion, selectedId]`.
3. **In-flight guard**: `loadDetailInFlightRef` — skip starting a new `loadDetail` if one is already running. Ref is set `true` at start and `false` in `finally`.
4. **Reset on persona change**: When `selectedId` changes, reset the ref in the same effect so the new persona load is allowed.
5. **Polling**: Only call from the interval when `!loadDetailInFlightRef.current`; interval 5s.

## If it persists

- Check Network tab: which URL repeats and how often.
- Ensure the deployed build includes these changes (in-flight ref + 5s polling).
- Backend: ensure DB pool and API can handle normal request rate (see `knowledge/database-pool-timeout.md`).

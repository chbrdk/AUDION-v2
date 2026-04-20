# Next.js `next start` ECONNREFUSED (Persona Backend)

## Symptom
When running `next start`, the server logs:
- `TypeError: fetch failed`
- `connect ECONNREFUSED <ip>:8000`
Often coming from `apps/web/app/api/auth/me/route.ts`.

## Docker: `ECONNREFUSED 172.18.x.x:8000`
`172.18.*` is usually the **current bridge IP** Docker DNS assigned to the API container (hostname `api` resolves to that IP). The error is **not** “wrong IP syntax” — it means **nothing accepted TCP on port 8000** at that moment: API container stopped/crashed, still starting, or **not on the same network** as `web`.

- Check: `docker compose ps` — `api` / `audion-api` should be **Up (healthy)**.
- Logs: `docker compose logs api --tail 100` (migrations, DB, missing env often prevent bind on `:8000`).
- Avoid setting `NEXT_PERSONA_BACKEND_INTERNAL_URL` to a **literal 172.x** address in Coolify/env files; use the **stable service hostname** (e.g. `http://api:8000` in Compose, or Coolify’s internal API hostname). Container IPs change after redeploy.

## Root cause
The Web app proxies auth to the **Persona Backend**:
- Server-side base URL is resolved via `getPersonaBackendBase({ preferPublic: false })`
- This uses, in order:
  - `NEXT_PERSONA_BACKEND_INTERNAL_URL`
  - `NEXT_PUBLIC_PERSONA_BACKEND_URL`
  - fallback: `http://api:8000`

If the resolved backend host is not reachable (backend container down / wrong network / wrong env var), Node fetch throws `ECONNREFUSED`.

## Fix
- Ensure Persona Backend is running and reachable from the Web runtime network.
- Set the correct URL in env:
  - `NEXT_PERSONA_BACKEND_INTERNAL_URL=http://<internal-host>:8000`
  - or `NEXT_PUBLIC_PERSONA_BACKEND_URL=https://<public-host>`

## Hardening (implemented)
`apps/web/app/api/auth/me/route.ts` now catches fetch connection errors and returns:
- HTTP `503` with JSON `{ error, detail, target }`
instead of throwing unhandled errors during `next start`.

## Notes: “Failed to find Server Action …”
This usually happens when the browser is still sending requests from an older build.
Typical fix:
- stop server
- delete `.next`
- rebuild (`npm run build:web`)
- start again (`npm run start --workspace apps/web`)
- hard reload browser tab / clear site data


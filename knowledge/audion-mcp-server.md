# AUDION MCP Server

## Purpose

The AUDION MCP server exposes AUDION FastAPI APIs as MCP tools so that clients (Cursor, Claude Desktop, etc.) can call the API via the Model Context Protocol. The server is stateless and does not store user data; it forwards requests to the AUDION API with a single Bearer token (`AUDION_API_TOKEN`).

## Architecture

- **Client** (Cursor / Claude) → **MCP Server** (Node, port 3100) → **AUDION FastAPI API** (port 8000).
- Authentication: one **API token** per user, created in AUDION (Settings → API access or `POST /auth/tokens`). Same token is used for MCP and other integrations.
- Optional: **Next.js** rewrites `/mcp` and `/mcp/*` to the MCP server so clients can use `https://audion.example.com/mcp` on the same domain.

## Environment variables

| Variable | Where | Description |
|----------|--------|-------------|
| `AUDION_API_URL` | MCP server | Base URL of the FastAPI API (e.g. `http://api:8000`). |
| `AUDION_API_TOKEN` | MCP server | Bearer token (API token from Settings). |
| `MCP_TRANSPORT` | MCP server | `stdio` for Claude Desktop; omit or `http` for HTTP. |
| `MCP_PORT` | MCP server | HTTP port (default 3100). |
| `MCP_STATELESS` | MCP server | `true` when behind Next.js proxy (recommended). |
| `MCP_SERVER_URL` | **Web app** (Next.js) | Internal URL of the MCP server for rewrites (e.g. `http://audion-mcp:3100`). |

See [audion-urls-and-paths.md](./audion-urls-and-paths.md) for the full list.

## Local run

```bash
cd mcp-server
npm install && npm run build
export AUDION_API_URL=http://localhost:8000
export AUDION_API_TOKEN=audion_xxxx
npm start
```

## Docker / Coolify

- Build from repo root: `docker build -f Dockerfile.mcp-server -t audion-mcp .`
- Run with `AUDION_API_URL` and `AUDION_API_TOKEN`.
- In Coolify: use Dockerfile path `Dockerfile.mcp-server`, context = repo root.

## Same-domain proxy (Next.js)

Set `MCP_SERVER_URL` in the **web app** (e.g. `http://audion-mcp:3100`). The Next.js config rewrites `/mcp` and `/mcp/:path*` to that URL. Clients then use `https://audion.example.com/mcp` (or with base path). Use `MCP_STATELESS=true` on the MCP server to avoid session ID issues behind the proxy.

## Troubleshooting

- **500 when calling /mcp**: Enable `MCP_STATELESS=true`; ensure `MCP_SERVER_URL` points to the MCP service.
- **Tools return "AUDION_API_URL or AUDION_API_TOKEN not configured"**: Set both in the MCP server environment.
- **401 from API**: Token invalid or revoked; create a new token in Settings → API access.
- **Redirect to /login (z. B. „Anfrage wurde an /login?redirect=%2Fpersonas weitergeleitet“)**: Die **Web-App** (Next.js) leitet unangemeldete Aufrufe auf Seiten wie `/personas` zur Login-Seite um – die **API** (FastAPI) macht das nicht. Ursache ist meist, dass ein Client die **Web-App-URL** (z. B. `https://audion.example.com`) statt der **API-URL** verwendet. **Lösung:** MCP und alle API-Clients müssen `AUDION_API_URL` auf die **FastAPI-Basis-URL** setzen (z. B. `http://api:8000` intern oder `https://api.audion.example.com`), **nicht** auf die Web-App-URL. Zusätzlich gültigen **API-Token** setzen (`AUDION_API_TOKEN`). Dann gehen Anfragen mit `Authorization: Bearer <token>` an die API und erhalten JSON (oder 401), kein HTML-Redirect.
- **MCP Proxy „Not connected“ / „Failed to list website tools“**: Tritt oft in Browser-Erweiterungen oder Clients auf, die das MCP über eine Web-URL ansprechen. Prüfen: (1) MCP-Server-URL stimmt (z. B. `https://audion.example.com/mcp` wenn Rewrite aktiv, oder direkte MCP-URL). (2) Kein CORS/Netzwerk-Block; bei Erweiterungen ggf. gleiche Domain oder explizite Erlaubnis. (3) Wenn der Zugriff über die Web-App läuft: `MCP_SERVER_URL` in der Web-App gesetzt, damit `/mcp` an den MCP-Server weitergeleitet wird.

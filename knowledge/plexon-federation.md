# AUDION Federation with PLEXON

Stand: Mai 2026

## Rolle von AUDION

`AUDION` bleibt ein eigenstaendiges Multi-Service-Produkt. `PLEXON` liefert dafuer die zentrale Identitaet, Profilquelle und Usage-Control-Plane, waehrend `AUDION` weiterhin seine Produkt- und Projektlogik selbst betreibt.

## PLEXON-Vertrag

- Vertragsversion: `2026-05-plexon-federation-v2`
- Request-Header an PLEXON: `X-Plexon-Contract-Version`
- Service-Authentifizierung: `X-Service-Secret`

Die Web-App verwendet den Vertrag ueber `apps/web/lib/plexon-contract.ts`. Die Python-Seite sendet dieselbe Vertragsversion beim Usage-Reporting.

## Wichtige Architekturgrenzen

- `apps/web` bleibt BFF/Proxy-Schicht fuer das Produkt
- `apps/api`, `apps/chat-api`, `apps/indexing-api` und Worker bleiben produktlokal
- `PLEXON` uebernimmt **nicht** die Persona-, Chat- oder Projektlogik

## Aktuelle Integrationspunkte

- zentrale Credential-Validierung ueber `apps/web/lib/plexon-auth.ts`
- Profil-Lesen/-Patch ueber PLEXON-Service-Endpunkte
- Usage-Reporting aus Python ueber `apps/api/app/services/usage_report.py`

## Zentrale Projekt-Anlage (PLEXON Company)

Wenn die Persona-API mit `PLEXON_API_BASE_URL` / `PLEXON_SERVICE_SECRET` konfiguriert ist und der Nutzer ein `plexon_user_id` hat, verlangt `POST /projects` (und Bootstrap) ein **`platform_company_id`**.

Die Web-App setzt das Feld automatisch, wenn eine der folgenden Quellen gesetzt ist (Prioritaet: URL, dann SessionStorage, dann Env-Default):

- Query-Parameter: `platformCompanyId` oder `platform_company_id` (gleiche Schluessel wie in `apps/web/lib/platform-company-context.ts`)
- SessionStorage-Schluessel: `audion_platform_company_id` (wird aus der URL beim Laden geschrieben)
- Optional: `NEXT_PUBLIC_DEFAULT_PLATFORM_COMPANY_ID` fuer Single-Tenant / Dev

Relevante Dateien siehe unten.

## Relevante Dateien

- `apps/web/lib/plexon-contract.ts`
- `apps/web/lib/plexon-auth.ts`
- `apps/web/lib/platform-company-context.ts`
- `apps/web/components/projects/project-provider.tsx`
- `apps/web/components/setup/msqdx-glass-easy-setup-panel.tsx`
- `apps/web/app/api/auth/login/route.ts`
- `apps/web/middleware.ts`
- `apps/api/app/services/usage_report.py`

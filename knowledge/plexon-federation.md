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

## Relevante Dateien

- `apps/web/lib/plexon-contract.ts`
- `apps/web/lib/plexon-auth.ts`
- `apps/web/app/api/auth/login/route.ts`
- `apps/web/middleware.ts`
- `apps/api/app/services/usage_report.py`

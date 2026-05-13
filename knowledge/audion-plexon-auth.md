# AUDION – PLEXON-Auth (zentrale User-Verwaltung)

## Übersicht

Wie CHECKION kann AUDION den Login gegen **PLEXON** validieren. User-Daten liegen nur in PLEXON; AUDION nutzt das bestehende Persona-Backend für Sessions/Tokens, ohne dass das Backend angepasst werden muss.

## Konfiguration (Web-App)

In der AUDION-Web-App (Coolify/Lokal) setzen:

| Variable | Bedeutung |
|----------|-----------|
| `PLEXON_AUTH_URL` | PLEXON-Basis-URL (z. B. `https://plexon.example.com`, ohne trailing slash) |
| `PLEXON_SERVICE_SECRET` | Derselbe Secret wie in PLEXON (min. 16 Zeichen) |
| `NEXT_PUBLIC_PLEXON_REGISTER_URL` | Optional: Link zur PLEXON-Registrierung (z. B. `https://plexon.example.com/register`). Erscheint auf der Register-Seite. |

## Ablauf Login

1. User gibt E-Mail und Passwort ein.
2. **Falls** `PLEXON_AUTH_URL` und `PLEXON_SERVICE_SECRET` gesetzt sind: Die Web-App ruft `POST /api/auth/validate-credentials` bei PLEXON auf. Bei Erfolg liefert PLEXON `{ user: { id, email, name } }`.
3. **Wenn PLEXON konfiguriert ist, aber die Validierung fehlschlägt**, wird **nicht** mehr versucht, mit dem eingegebenen Klartext-Passwort direkt im Persona-Backend einzuloggen (das würde bei reinem PLEXON-Konto ohnehin scheitern und wirkte wie „Anmeldung kaputt“). Stattdessen liefert die Login-API eine klare Fehlermeldung (z. B. falsches PLEXON-Passwort vs. falscher Service-Secret).
4. Aus der PLEXON-User-ID wird ein **deterministisches Passwort** abgeleitet (`HMAC-SHA256(secret, user_id)`), damit das Persona-Backend keinen neuen Endpoint braucht.
5. Die Web-App ruft das Persona-Backend auf: zuerst `POST /auth/login` mit E-Mail und abgeleitetem Passwort. Falls 401 (User existiert noch nicht im Backend): `POST /auth/register` mit E-Mail, Name und abgeleitetem Passwort. Das Backend gibt wie gewohnt `access_token` und optional `default_project_id` zurück.
6. Die Web-App setzt die Cookies `audion_auth_token` und `audion_project_id`; der Rest der App läuft unverändert.

**Persona-Backend:** Zusätzlich zu `/auth/login` und `/auth/register` gibt es **`POST /auth/plexon-sync`**: Wenn sich ein Nutzer per PLEXON anmeldet und die E-Mail schon im Backend existiert (409), ruft die Web-App diesen Endpoint auf. Das Backend setzt das Passwort auf das PLEXON-abgeleitete und gibt einen Token zurück. Dafür muss beim **Persona-Backend (API)** die gleiche Env **`PLEXON_SERVICE_SECRET`** gesetzt sein wie in PLEXON und in der AUDION-Web-App.

## Profil (Name, Unternehmen, Avatar, Sprache) aus PLEXON

- Wenn ein AUDION-User mit PLEXON verknüpft ist (`plexon_user_id` im Backend), liefert **GET /api/auth/me** die Profilfelder **name**, **company**, **avatar_url**, **locale** aus PLEXON (Überschreibung der Backend-Werte).
- **PATCH /api/auth/me** (Profil-Update) wird sowohl ans Persona-Backend als auch an PLEXON gesendet, sodass Änderungen zentral in PLEXON gespeichert werden und in allen Diensten (CHECKION, AUDION, …) sichtbar sind.
- `plexon_user_id` wird beim ersten PLEXON-Login gesetzt (Register oder plexon-sync). Nach dem Backend-Update muss die Migration `20260302_plexon_user_id` ausgeführt werden (`alembic upgrade head`).

## Registrierung

- Neue User registrieren sich in **PLEXON**. Auf der AUDION-Register-Seite kann optional ein Link „In PLEXON registrieren“ angezeigt werden (`NEXT_PUBLIC_PLEXON_REGISTER_URL`).

## Troubleshooting: 401 beim Login

- **`PLEXON_SERVICE_SECRET` muss an drei Stellen identisch sein:** PLEXON-App, AUDION-**Web**-App und AUDION-**API** (Persona-Backend). Wenn nur eine Stelle einen alten oder abweichenden Wert hat, schlägt entweder `validate-credentials` fehl (**Unauthorized** → die Web-App meldet dann einen Hinweis auf den Service-Secret) oder das Backend-Login mit dem **abgeleiteten** Passwort schlägt fehl.
- **PLEXON-Env muss auf der AUDION-Web-App (Runtime) ankommen:** `PLEXON_AUTH_URL` und `PLEXON_SERVICE_SECRET` werden **pro Request** aus `process.env` gelesen (nicht beim Modul-Import gecacht). So greifen Coolify-Runtime-Variablen zuverlässig; ein Build ohne diese Keys führt nicht mehr dazu, dass PLEXON „tot“ wirkt und nur noch ein direkter Backend-Login mit dem Klartext-Passwort läuft (→ 401 ohne PLEXON-Aktivität).
- **Diagnose ohne Secrets:** `GET {BASE_PATH}/api/health` der Web-App liefert unter `auth` u. a. `plexonAuthActive`, `plexonAuthUrlSet`, `plexonServiceSecretSet`, `personaBackendBaseSource`, `personaBackendInternalUrlSet`. Wenn `plexonAuthActive` **false** ist, ruft die Web-App PLEXON beim Login nicht auf (trotz gleichem Secret in PLEXON/API). Dann fehlen `PLEXON_AUTH_URL` / `PLEXON_SERVICE_SECRET` auf dem **Web**-Service in Coolify.
- **Web-Container-Logs:** Bei jedem Login-Versuch erscheint eine Zeile `[AUDION] auth/login: personaBackend=… plexonConfigured=…` (Level **warn**, wird in Production nicht von `removeConsole` entfernt). So siehst du, ob die Route das Backend erreichen will und ob PLEXON als konfiguriert gilt.
- **API-Logs (structlog, JSON):** `POST /auth/login` schreibt `auth.login` mit `outcome` (`ok` / `invalid_credentials`). `auth.register` bei Konflikt `email_conflict`, `auth.plexon_sync` bei Erfolg/Fehler. Wenn die **API** nichts loggt, erreicht der Web-Container das Persona-Backend unter `NEXT_PERSONA_BACKEND_INTERNAL_URL` nicht (falscher Hostname/Netzwerk) – dann prüfen `personaBackendBaseSource` und die erreichbare URL aus dem Web-Container.
- **PLEXON-Env in AUDION (Web) gesetzt?** In Coolify bei der **AUDION-Web-App** müssen `PLEXON_AUTH_URL` (z. B. `https://plexon.projects-a.plygrnd.tech`) und `PLEXON_SERVICE_SECRET` (gleich wie in PLEXON) gesetzt sein. Ohne diese Werte wird nur der direkte Backend-Login mit dem eingegebenen Passwort versucht; ein reiner PLEXON-Account existiert dort nicht → 401.
- **PLEXON von AUDION aus erreichbar?** Die AUDION-Web-App (Server) muss `PLEXON_AUTH_URL` per HTTPS aufrufen können. Kein lokales `localhost`; in Coolify die öffentliche PLEXON-URL verwenden.
- **Persona-Backend erreichbar?** `NEXT_PERSONA_BACKEND_INTERNAL_URL` muss aus dem AUDION-Web-Container auf das Persona-Backend zeigen (z. B. `http://audion-api:8000`). Erreichbarkeitsfehler liefern jetzt 503 mit Hinweis „Authentication service unavailable“.
- **Bereits in AUDION registriert?** Bei **409 (Email already registered)** ruft die Web-App automatisch **`POST /auth/plexon-sync`** auf: Das Backend setzt das Passwort des bestehenden Users auf das PLEXON-abgeleitete und liefert einen Token. Danach funktioniert der nächste Login mit PLEXON-Zugangsdaten. Dafür muss beim **Persona-Backend** `PLEXON_SERVICE_SECRET` (gleich wie in PLEXON und Web) gesetzt sein.
- **„Invalid credentials“ vom Persona-Backend obwohl PLEXON stimmt:** Der Server-Flow nach erfolgreicher PLEXON-Validierung macht zuerst `POST /auth/login` mit dem **abgeleiteten** Passwort. Bei 401 versucht die Web-App `POST /auth/register` – aber **nur wenn ein `name` mitgeschickt wird**. Fehlte `name` in der PLEXON-Antwort (oder war leer), wurde kein Register ausgelöst, der **409 → plexon-sync**-Pfad kam nicht zustande, und das Backend antwortete mit dem generischen 401 **Invalid credentials**. Abhilfe: Anzeigename wird serverseitig immer gesetzt (`plexonUserDisplayNameForAudion`: PLEXON-Name, sonst E-Mail-Local-Part, sonst `"User"`).

## Siehe auch

- CHECKION: `knowledge/checkion-auth-and-database.md` (gleiches PLEXON-Prinzip)
- PLEXON: `knowledge/plexon-setup.md` (zentrale User-DB, validate-credentials API)
- Coolify: `knowledge/coolify-vollstaendige-anleitung.md` (CHECKION/PLEXON; AUDION analog mit obigen Env-Variablen)

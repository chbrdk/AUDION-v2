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
3. Aus der PLEXON-User-ID wird ein **deterministisches Passwort** abgeleitet (`HMAC-SHA256(secret, user_id)`), damit das Persona-Backend keinen neuen Endpoint braucht.
4. Die Web-App ruft das Persona-Backend auf: zuerst `POST /auth/login` mit E-Mail und abgeleitetem Passwort. Falls 401 (User existiert noch nicht im Backend): `POST /auth/register` mit E-Mail, Name und abgeleitetem Passwort. Das Backend gibt wie gewohnt `access_token` und optional `default_project_id` zurück.
5. Die Web-App setzt die Cookies `audion_auth_token` und `audion_project_id`; der Rest der App läuft unverändert.

**Persona-Backend:** Zusätzlich zu `/auth/login` und `/auth/register` gibt es **`POST /auth/plexon-sync`**: Wenn sich ein Nutzer per PLEXON anmeldet und die E-Mail schon im Backend existiert (409), ruft die Web-App diesen Endpoint auf. Das Backend setzt das Passwort auf das PLEXON-abgeleitete und gibt einen Token zurück. Dafür muss beim **Persona-Backend (API)** die gleiche Env **`PLEXON_SERVICE_SECRET`** gesetzt sein wie in PLEXON und in der AUDION-Web-App.

## Profil (Name, Unternehmen, Avatar, Sprache) aus PLEXON

- Wenn ein AUDION-User mit PLEXON verknüpft ist (`plexon_user_id` im Backend), liefert **GET /api/auth/me** die Profilfelder **name**, **company**, **avatar_url**, **locale** aus PLEXON (Überschreibung der Backend-Werte).
- **PATCH /api/auth/me** (Profil-Update) wird sowohl ans Persona-Backend als auch an PLEXON gesendet, sodass Änderungen zentral in PLEXON gespeichert werden und in allen Diensten (CHECKION, AUDION, …) sichtbar sind.
- `plexon_user_id` wird beim ersten PLEXON-Login gesetzt (Register oder plexon-sync). Nach dem Backend-Update muss die Migration `20260302_plexon_user_id` ausgeführt werden (`alembic upgrade head`).

## Registrierung

- Neue User registrieren sich in **PLEXON**. Auf der AUDION-Register-Seite kann optional ein Link „In PLEXON registrieren“ angezeigt werden (`NEXT_PUBLIC_PLEXON_REGISTER_URL`).

## Troubleshooting: 401 beim Login

- **PLEXON-Env in AUDION (Web) gesetzt?** In Coolify bei der **AUDION-Web-App** müssen `PLEXON_AUTH_URL` (z. B. `https://plexon.projects-a.plygrnd.tech`) und `PLEXON_SERVICE_SECRET` (gleich wie in PLEXON) gesetzt sein. Ohne diese Werte wird das Passwort direkt ans Persona-Backend geschickt; ein reiner PLEXON-Account existiert dort nicht → 401.
- **PLEXON von AUDION aus erreichbar?** Die AUDION-Web-App (Server) muss `PLEXON_AUTH_URL` per HTTPS aufrufen können. Kein lokales `localhost`; in Coolify die öffentliche PLEXON-URL verwenden.
- **Persona-Backend erreichbar?** `NEXT_PERSONA_BACKEND_INTERNAL_URL` muss aus dem AUDION-Web-Container auf das Persona-Backend zeigen (z. B. `http://audion-api:8000`). Erreichbarkeitsfehler liefern jetzt 503 mit Hinweis „Authentication service unavailable“.
- **Bereits in AUDION registriert?** Bei **409 (Email already registered)** ruft die Web-App automatisch **`POST /auth/plexon-sync`** auf: Das Backend setzt das Passwort des bestehenden Users auf das PLEXON-abgeleitete und liefert einen Token. Danach funktioniert der nächste Login mit PLEXON-Zugangsdaten. Dafür muss beim **Persona-Backend** `PLEXON_SERVICE_SECRET` (gleich wie in PLEXON und Web) gesetzt sein.

## Siehe auch

- CHECKION: `knowledge/checkion-auth-and-database.md` (gleiches PLEXON-Prinzip)
- PLEXON: `knowledge/plexon-setup.md` (zentrale User-DB, validate-credentials API)
- Coolify: `knowledge/coolify-vollstaendige-anleitung.md` (CHECKION/PLEXON; AUDION analog mit obigen Env-Variablen)

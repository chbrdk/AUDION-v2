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

**Persona-Backend:** Es sind **keine** Änderungen nötig. Es werden weiterhin `/auth/login` und `/auth/register` mit E-Mail/Passwort verwendet; das Passwort ist bei PLEXON-Login nur ein abgeleitetes, internes Passwort.

## Registrierung

- Neue User registrieren sich in **PLEXON**. Auf der AUDION-Register-Seite kann optional ein Link „In PLEXON registrieren“ angezeigt werden (`NEXT_PUBLIC_PLEXON_REGISTER_URL`).

## Siehe auch

- CHECKION: `knowledge/checkion-auth-and-database.md` (gleiches PLEXON-Prinzip)
- PLEXON: `knowledge/plexon-setup.md` (zentrale User-DB, validate-credentials API)
- Coolify: `knowledge/coolify-vollstaendige-anleitung.md` (CHECKION/PLEXON; AUDION analog mit obigen Env-Variablen)

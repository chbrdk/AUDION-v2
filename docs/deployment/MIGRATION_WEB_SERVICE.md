# Migration: Web Service - Schritt für Schritt

Diese Anleitung zeigt dir genau, wie du den Web Service als eigenständigen Service in Coolify erstellst.

## Vorbereitung

### Schritt 1: Notiere die aktuellen Environment Variables

Aus deinem aktuellen Docker Compose Deployment:
- `NEXT_PUBLIC_BASE_PATH` (z.B. `/audion` oder leer)
- `NEXT_PUBLIC_PERSONA_BACKEND_URL` (z.B. `http://api:8000`)
- `NEXT_PUBLIC_CHAT_API_URL` (z.B. `http://chat-api:8001`)

### Schritt 2: Notiere die Service-Namen

Die anderen Services werden später erstellt, aber wir müssen die URLs schon jetzt setzen:
- API Service: `http://audion-api:8000`
- Chat API Service: `http://audion-chat-api:8001`

---

## Schritt-für-Schritt: Web Service in Coolify erstellen

### Schritt 1: Neue Application erstellen

1. Gehe zu **Coolify** → **Applications**
2. Klicke auf **"New Application"** oder **"+"** Button
3. Fülle das Formular aus:
   - **Name**: `audion-web`
   - **Description** (optional): `AUDION Web Frontend - Next.js`
   - **Team** (falls Teams aktiviert): Wähle dein Team
4. Klicke auf **"Create"** oder **"Save"**

### Schritt 2: Source konfigurieren

1. In der neuen Application, gehe zu **"Source"** oder **"Repository"**
2. Wähle **"GitHub"** als Source
3. Wähle dein Repository: **`AUDION-v2`** (oder wie dein Repository heißt)
4. Wähle **Branch**: `main` (oder `master`)
5. Klicke auf **"Save"**

### Schritt 3: Build Pack konfigurieren

1. Gehe zu **"Build"** oder **"Build Pack"**
2. Wähle **"Dockerfile"** als Build Pack
3. Konfiguriere:
   - **Dockerfile Path**: `apps/web/Dockerfile`
   - **Build Context**: `.` (Repository Root)
   - **Build Arguments** (falls verfügbar):
     - `RUN_WEB_BUILD=true`
     - `NODE_ENV=production`

### Schritt 4: Ports konfigurieren

1. Gehe zu **"Ports"** oder **"Exposed Ports"**
2. Füge einen Port hinzu:
   - **Port**: `3000`
   - **Type**: `HTTP` oder `TCP`
   - **Public** (falls verfügbar): Aktiviert (für externen Zugriff)

### Schritt 5: Environment Variables setzen

1. Gehe zu **"Environment Variables"** oder **"Env"**
2. Füge folgende Variables hinzu (eine pro Zeile oder als Key-Value-Paare):

```
NODE_ENV=production
NEXT_PUBLIC_BASE_PATH=/audion
NEXT_PUBLIC_PERSONA_BACKEND_URL=http://audion-api:8000
NEXT_PUBLIC_CHAT_API_URL=http://audion-chat-api:8001
NEXT_PERSONA_BACKEND_INTERNAL_URL=http://audion-api:8000
```

**WICHTIG**: 
- Ersetze `/audion` mit deinem tatsächlichen Base Path (falls anders)
- Die URLs `http://audion-api:8000` und `http://audion-chat-api:8001` werden später funktionieren, wenn diese Services erstellt sind
- Falls die anderen Services noch nicht existieren, kannst du sie später aktualisieren

### Schritt 6: Network konfigurieren

1. Gehe zu **"Settings"** → **"Advanced"** oder **"Networking"**
2. Suche nach **"Connect To Predefined Network"** oder **"Connect to Coolify Network"**
3. **Aktiviere** diese Option
4. Dies ermöglicht dem Web Service, andere Services über ihre Container-Namen zu erreichen

### Schritt 7: Health Check konfigurieren

1. Gehe zu **"Health Check"** oder **"Health"**
2. Konfiguriere:
   - **Path**: `/api/health`
   - **Port**: `3000`
   - **Interval**: `30s`
   - **Timeout**: `10s`
   - **Retries**: `3`
   - **Start Period**: `60s` (gibt dem Service Zeit zum Starten)

### Schritt 8: Resource Limits (optional)

1. Gehe zu **"Resources"** oder **"Limits"**
2. Setze Limits (falls gewünscht):
   - **CPU**: z.B. `1` (1 Core)
   - **Memory**: z.B. `512M` oder `1G`
   - **Disk**: Falls verfügbar

### Schritt 9: Deploy

1. Gehe zurück zur Hauptansicht der Application
2. Klicke auf **"Deploy"** oder **"Redeploy"**
3. Warte, bis der Build abgeschlossen ist
4. Prüfe die Logs auf Fehler

---

## Nach dem Deploy

### Schritt 1: Logs prüfen

1. Gehe zu **"Logs"** in der Application
2. Prüfe auf Fehler:
   - ✅ `Ready in Xms` = Erfolgreich gestartet
   - ❌ `Error` oder `Failed` = Problem

### Schritt 2: Health Check prüfen

1. Gehe zu **"Status"** oder **"Health"**
2. Prüfe, ob der Health Check erfolgreich ist:
   - ✅ `Healthy` = Alles gut
   - ❌ `Unhealthy` = Problem

### Schritt 3: Service testen

1. Gehe zu **"Domains"** oder **"URLs"**
2. Öffne die URL im Browser
3. Prüfe, ob die Anwendung lädt

---

## Troubleshooting

### Problem: Build schlägt fehl

**Mögliche Ursachen:**
- Dockerfile Path falsch
- Build Context falsch
- Build Arguments fehlen

**Lösung:**
- Prüfe, dass `Dockerfile Path` = `apps/web/Dockerfile`
- Prüfe, dass `Build Context` = `.` (Repository Root)
- Prüfe, dass `RUN_WEB_BUILD=true` als Build Argument gesetzt ist

### Problem: Service startet nicht

**Mögliche Ursachen:**
- Port bereits belegt
- Environment Variables fehlen
- Health Check schlägt fehl

**Lösung:**
- Prüfe die Logs auf Fehler
- Prüfe, ob alle Environment Variables gesetzt sind
- Prüfe, ob der Health Check Endpoint `/api/health` existiert (sollte er, wir haben ihn erstellt)

### Problem: Health Check schlägt fehl

**Mögliche Ursachen:**
- Health Check Endpoint nicht erreichbar
- Port falsch
- Service braucht länger zum Starten

**Lösung:**
- Prüfe, ob `/api/health` Endpoint existiert (sollte in `apps/web/app/api/health/route.ts`)
- Erhöhe `Start Period` auf `90s` oder `120s`
- Prüfe die Logs, ob der Service überhaupt startet

### Problem: Service kann andere Services nicht erreichen

**Mögliche Ursachen:**
- "Connect To Predefined Network" nicht aktiviert
- Service-Namen falsch in Environment Variables

**Lösung:**
- Prüfe, dass "Connect To Predefined Network" aktiviert ist
- Prüfe, dass die Service-Namen in Environment Variables korrekt sind:
  - `http://audion-api:8000` (nicht `http://api:8000`)
  - `http://audion-chat-api:8001` (nicht `http://chat-api:8001`)

---

## Checkliste

Vor dem Deploy:
- [ ] Application Name: `audion-web`
- [ ] Source: GitHub Repository `AUDION-v2`
- [ ] Branch: `main`
- [ ] Dockerfile Path: `apps/web/Dockerfile`
- [ ] Build Context: `.`
- [ ] Build Argument: `RUN_WEB_BUILD=true`
- [ ] Port: `3000`
- [ ] Environment Variables gesetzt (5 Variables)
- [ ] "Connect To Predefined Network" aktiviert
- [ ] Health Check konfiguriert (`/api/health`, Port `3000`)

Nach dem Deploy:
- [ ] Build erfolgreich
- [ ] Service startet (Logs zeigen "Ready")
- [ ] Health Check erfolgreich
- [ ] Service erreichbar über Domain/URL
- [ ] Frontend lädt im Browser

---

## Nächste Schritte

Nachdem der Web Service erfolgreich läuft:

1. **Erstelle den API Service** (`audion-api`)
2. **Erstelle den Chat API Service** (`audion-chat-api`)
3. **Aktualisiere die Environment Variables** des Web Services, falls nötig
4. **Teste die Verbindung** zwischen Web und API Services

**Viel Erfolg! 🚀**

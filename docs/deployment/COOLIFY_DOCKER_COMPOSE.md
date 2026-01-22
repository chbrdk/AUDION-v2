# Coolify Docker Compose Konfiguration

## Problem: Coolify verwendet Nixpacks statt Docker Compose

Wenn Coolify versucht, das Projekt mit Nixpacks zu bauen (siehe Fehler: "Found application type: node"), muss die Konfiguration angepasst werden.

## Lösung: Docker Compose explizit auswählen

### Schritt 1: Application löschen und neu erstellen

1. In Coolify: Gehe zu deiner Application
2. **Settings** → **General** → **Delete Application** (oder lösche sie)
3. Erstelle die Application neu

### Schritt 2: Docker Compose explizit auswählen

Beim Erstellen der neuen Application:

1. **Applications** → **New Application**
2. **WICHTIG**: Wähle explizit **"Docker Compose"** aus (nicht "Docker" oder "Node.js")
3. Repository: `chbrdk/AUDION-v2`
4. Branch: `main`
5. **Build Pack**: Sollte "Docker Compose" sein (nicht "Nixpacks" oder "Node")

### Schritt 3: Prüfen der Build-Konfiguration

Nach dem Erstellen:

1. Gehe zu **Settings** → **Build Pack**
2. Stelle sicher, dass **"Docker Compose"** ausgewählt ist
3. Falls nicht: Ändere es zu "Docker Compose"

### Schritt 4: Docker Compose Datei prüfen

Stelle sicher, dass `docker-compose.yml` im Root-Verzeichnis des Repositories ist:
- ✅ `/docker-compose.yml` (korrekt)
- ❌ Nicht in einem Unterordner

## Alternative: Build Pack manuell setzen

Falls Coolify weiterhin Nixpacks verwendet:

1. In der Application: **Settings** → **Build Pack**
2. Wähle **"Docker Compose"** aus
3. Speichere die Änderungen
4. Deploy erneut

## Troubleshooting

### "Found application type: node" erscheint weiterhin

**Problem**: Coolify erkennt immer noch Node.js statt Docker Compose.

**Lösungen**:

1. **Prüfe Build Pack Einstellung**:
   - Settings → Build Pack → Muss "Docker Compose" sein

2. **Lösche package-lock.json Cache** (falls vorhanden):
   - Coolify könnte durch `package.json` im Root auf Node.js schließen
   - Das ist normal für Monorepos - Docker Compose sollte trotzdem verwendet werden

3. **Prüfe docker-compose.yml**:
   ```bash
   # Stelle sicher, dass die Datei existiert
   ls -la docker-compose.yml
   ```

4. **Erzwinge Docker Compose**:
   - In Coolify Settings: Suche nach "Build Pack" oder "Build Configuration"
   - Setze explizit auf "Docker Compose"

### Build schlägt mit "npm ci" Fehler fehl

**Problem**: Coolify versucht `npm ci` auszuführen (Nixpacks-Verhalten).

**Lösung**: 
- Das bedeutet, dass Coolify immer noch Nixpacks verwendet
- Folge den Schritten oben, um Docker Compose zu aktivieren
- Docker Compose sollte die Services aus `docker-compose.yml` bauen, nicht `npm ci` ausführen

### "docker-compose.yml not found"

**Problem**: Coolify findet die `docker-compose.yml` nicht.

**Lösungen**:
1. Prüfe, dass die Datei im Root-Verzeichnis ist
2. Prüfe, dass sie committed und gepusht ist:
   ```bash
   git ls-files | grep docker-compose.yml
   ```
3. Prüfe den Branch: Stelle sicher, dass `main` der richtige Branch ist

## Erwartetes Verhalten mit Docker Compose

Wenn Docker Compose korrekt konfiguriert ist, solltest du in den Logs sehen:

```
Building docker image started.
Building services: web, api, chat-api, ...
```

**NICHT**:
```
Found application type: node
npm ci
```

## Nächste Schritte

Nach erfolgreicher Docker Compose Konfiguration:
1. Setze die [Environment Variables](../environment-variables.md)
2. Erstelle die [Database Resources](QUICKSTART.md#schritt-1-database-resources-erstellen)
3. Deploy!

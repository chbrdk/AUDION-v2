# Debugging: Logs analysieren in Coolify

## Problem: Anwendung startet immer wieder neu

Wenn die Anwendung kontinuierlich neu startet, musst du herausfinden, welcher Service genau das Problem verursacht.

## Schritt 1: Logs einzelner Services in Coolify anzeigen

In Coolify v4.0.0-beta kannst du die Logs einzelner Services so anzeigen:

### Option A: Über den Logs-Tab (Empfohlen)
1. Gehe zu deiner **Application** in Coolify
2. Klicke auf **"Logs"** im linken Menü (mit Warnsymbol ⚠️)
3. Die Logs zeigen normalerweise den Container-Namen am Anfang jeder Zeile
4. Suche nach Fehlermeldungen oder nach dem Container-Namen, der neu startet
5. **WICHTIG**: Die Logs zeigen alle Services kombiniert - filtere nach Container-Namen:
   - `audion-web`
   - `audion-api`
   - `audion-chat-api`
   - `audion-indexing-api`
   - `audion-celery-worker`
   - `audion-celery-beat`
   - `audion-qdrant`
   - `audion-neo4j`

### Option B: Über Docker Compose Services
1. Gehe zu deiner **Application** in Coolify
2. Klicke auf **"Services"** oder **"Containers"** (je nach Coolify-Version)
3. Du solltest eine Liste aller Services sehen
4. Klicke auf einen Service, um dessen Logs zu sehen

### Option C: Über die Logs-Ansicht
1. Gehe zu **Application** → **Logs**
2. Suche nach einem Filter oder Dropdown, um einzelne Services auszuwählen
3. Falls nicht verfügbar: Die Logs zeigen normalerweise den Container-Namen am Anfang jeder Zeile

### Option C: Über die Terminal/SSH-Funktion
1. Gehe zu **Application** → **Terminal** oder **SSH**
2. Führe aus: `docker ps -a` (zeigt alle Container mit Status)
3. Führe aus: `docker logs <container-name>` (z.B. `docker logs audion-api`)

## Schritt 2: Prüfe, welche Services neu starten

### In Coolify UI:
1. Gehe zu **Application** → **Services** oder **Containers**
2. Schaue auf die **Status**-Spalte:
   - **"Restarting"** = Service startet kontinuierlich neu
   - **"Running"** = Service läuft normal
   - **"Exited"** = Service ist gestoppt

### Über Terminal:
```bash
docker ps -a | grep audion
```

Schaue auf die Spalte **"STATUS"**:
- `Restarting (1) 2 seconds ago` = Service startet neu
- `Up 5 minutes` = Service läuft normal
- `Exited (1) 2 seconds ago` = Service ist gestoppt (Exit Code 1 = Fehler)

## Schritt 3: Analysiere die Logs

### Was du in den Logs suchen solltest:

1. **Exit Codes**:
   ```
   Exited (1) 2 seconds ago
   ```
   - Exit Code 0 = Erfolgreich beendet
   - Exit Code 1 = Fehler
   - Exit Code 2 = Fehler
   - Exit Code 130 = Beendet durch Signal (z.B. Ctrl+C)

2. **Connection Errors**:
   ```
   Connection refused
   Temporary failure in name resolution
   could not connect to database
   ```

3. **Health Check Failures**:
   ```
   Health check failed
   ```

4. **Import Errors**:
   ```
   ImportError
   ModuleNotFoundError
   ```

5. **Database Errors**:
   ```
   sqlalchemy.exc.NoSuchModuleError
   Can't load plugin: sqlalchemy.dialects:postgres
   ```

## Schritt 4: Häufige Probleme und Lösungen

### Problem: Service startet, crasht sofort, startet neu

**Symptom**: Logs zeigen:
```
Service started
[Error message]
Service exited with code 1
Service restarting...
```

**Lösung**: 
- Prüfe die Fehlermeldung in den Logs
- Prüfe, ob alle Environment Variables gesetzt sind
- Prüfe, ob alle Dependencies (Database, Redis) erreichbar sind

### Problem: Health Check schlägt fehl

**Symptom**: Logs zeigen:
```
Service started
Health check failed
Service restarting...
```

**Lösung**:
- Prüfe, ob der Health Check Endpoint erreichbar ist
- Erhöhe `start_period` im `docker-compose.yml` (Service braucht länger zum Starten)
- Prüfe, ob der Service tatsächlich läuft (nicht nur gestartet)

### Problem: Service wartet auf Dependency

**Symptom**: Logs zeigen:
```
Waiting for database...
Connection refused
Service restarting...
```

**Lösung**:
- Prüfe, ob die Dependency läuft: `docker ps | grep <dependency-name>`
- Prüfe, ob die Connection String korrekt ist
- Prüfe, ob "Connect To Predefined Network" aktiviert ist

## Schritt 5: Logs filtern

Wenn du die kombinierten Logs aller Services siehst, kannst du sie filtern:

### Nach Service filtern:
- Suche nach dem Container-Namen (z.B. `audion-api`)
- Oder nach dem Service-Namen (z.B. `api`)

### Nach Fehlertyp filtern:
- Suche nach `ERROR`, `CRITICAL`, `FATAL`
- Suche nach `Exit code`
- Suche nach `Connection refused`

## Beispiel: Logs analysieren

### Gute Logs (Service läuft normal):
```
[2026-01-26 16:45:53,510: INFO/MainProcess] beat: Starting...
celery beat v5.5.3 (immunity) is starting.
```

### Schlechte Logs (Service crasht):
```
[2026-01-26 16:45:53,510: ERROR] Failed to connect to database
[2026-01-26 16:45:53,511: ERROR] Service exiting with code 1
```

### Warnungen (normal, kein Problem):
```
Failed to read config: Unrecognized setting. No declared setting with name: URI
```
→ Das sind nur Warnungen von Neo4j, kein Problem!

## Nächste Schritte

1. **Identifiziere den problematischen Service**: Welcher Service zeigt "Restarting"?
2. **Prüfe dessen Logs**: Suche nach Fehlermeldungen
3. **Prüfe Dependencies**: Läuft die Database? Läuft Redis?
4. **Prüfe Environment Variables**: Sind alle gesetzt?
5. **Teile die Logs**: Kopiere die letzten 50-100 Zeilen der Logs des problematischen Services

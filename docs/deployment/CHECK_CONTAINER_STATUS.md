# Container Status prüfen

## Problem: Anwendung startet immer wieder neu, aber Logs zeigen keine Fehler

Wenn die Anwendung kontinuierlich neu startet, aber die Logs keine klaren Fehler zeigen, liegt das Problem möglicherweise an:

1. **Health Checks schlagen fehl** (werden nicht in den normalen Logs angezeigt)
2. **Container crasht nach dem Start** (Exit Code wird nicht in Logs angezeigt)
3. **Resource Limits** (Memory/CPU werden überschritten)

## Lösung: Container Status prüfen

### Option 1: Über das Script (empfohlen)

Falls du SSH/Terminal-Zugriff auf den Coolify-Server hast:

```bash
# Script ausführen
cd /path/to/AUDION
./scripts/check-container-status.sh
```

Das Script zeigt:
- Container Status (running, restarting, exited)
- Health Check Status (healthy, unhealthy, starting)
- Restart Count (wie oft wurde neu gestartet)
- Exit Codes (warum Container gestoppt wurde)
- Letzte Log-Zeilen für restarting Container

### Option 2: Manuell über Docker Commands

```bash
# Alle Container Status anzeigen
docker ps -a --filter "name=audion"

# Health Check Status für einen Container
docker inspect --format='{{.State.Health.Status}}' audion-api

# Restart Count
docker inspect --format='{{.RestartCount}}' audion-api

# Exit Code (warum Container gestoppt wurde)
docker inspect --format='{{.State.ExitCode}}' audion-api

# Health Check Logs (wenn unhealthy)
docker inspect --format='{{json .State.Health.Log}}' audion-api | jq -r '.[-5:]'
```

### Option 3: In Coolify UI

1. Gehe zu **Application** → **Services** oder **Containers**
2. Schaue auf die **Status**-Spalte:
   - **"Restarting"** = Container startet kontinuierlich neu
   - **"Unhealthy"** = Health Check schlägt fehl
   - **"Exited"** = Container ist gestoppt (mit Exit Code)
3. Klicke auf einen Container, um Details zu sehen:
   - **Restart Count**: Wie oft wurde neu gestartet
   - **Health Status**: Health Check Status
   - **Exit Code**: Warum Container gestoppt wurde

## Was die Status bedeuten

### Container Status

- **Running**: Container läuft normal ✅
- **Restarting**: Container startet kontinuierlich neu ⚠️
- **Exited**: Container ist gestoppt (prüfe Exit Code) ❌
- **Created**: Container wurde erstellt, aber noch nicht gestartet
- **Paused**: Container ist pausiert

### Health Check Status

- **healthy**: Health Check erfolgreich ✅
- **unhealthy**: Health Check schlägt fehl ❌
- **starting**: Health Check läuft noch (innerhalb start_period)
- **no-health-check**: Kein Health Check konfiguriert

### Exit Codes

- **0**: Erfolgreich beendet (normal)
- **1**: Allgemeiner Fehler
- **2**: Fehlerhafte Verwendung
- **130**: Beendet durch Signal (z.B. SIGINT)
- **137**: Beendet durch SIGKILL (OOM Killer)

## Häufige Probleme

### Problem: Container Status = "Restarting"

**Ursachen:**
1. Health Check schlägt fehl → Container wird neu gestartet
2. Container crasht sofort nach Start → Exit Code != 0
3. Resource Limits überschritten → OOM Killer beendet Container

**Lösung:**
```bash
# Prüfe Health Check Status
docker inspect --format='{{.State.Health.Status}}' <container-name>

# Prüfe Exit Code
docker inspect --format='{{.State.ExitCode}}' <container-name>

# Prüfe letzte Logs
docker logs --tail 50 <container-name>
```

### Problem: Health Status = "unhealthy"

**Ursachen:**
1. Health Check Endpunkt nicht erreichbar
2. Health Check Endpunkt gibt nicht 200 OK zurück
3. Health Check Timeout (Service braucht zu lange zum Starten)

**Lösung:**
```bash
# Prüfe Health Check Logs
docker inspect --format='{{json .State.Health.Log}}' <container-name> | jq -r '.[-5:]'

# Teste Health Check Endpunkt manuell
docker exec <container-name> curl http://localhost:8000/health
```

### Problem: Restart Count > 0

**Ursachen:**
1. Container crasht beim Start
2. Health Check schlägt fehl
3. Dependency nicht verfügbar (Database, Redis)

**Lösung:**
```bash
# Prüfe Restart Count
docker inspect --format='{{.RestartCount}}' <container-name>

# Prüfe Exit Code
docker inspect --format='{{.State.ExitCode}}' <container-name>

# Prüfe Logs vor dem letzten Restart
docker logs --tail 100 <container-name>
```

## Nächste Schritte

1. **Führe das Script aus** oder prüfe manuell den Container Status
2. **Identifiziere den problematischen Container**:
   - Status = "Restarting"?
   - Health = "unhealthy"?
   - Restart Count > 0?
3. **Prüfe die Details**:
   - Exit Code
   - Health Check Logs
   - Container Logs
4. **Teile die Ergebnisse**: Kopiere die Ausgabe des Scripts oder die manuellen Befehle

## Beispiel-Ausgabe

```
1. Container Status:
NAME                STATUS              PORTS                    IMAGE
audion-api          Restarting (1)      0.0.0.0:8000->8000/tcp   audion-api:latest
audion-web          Running             0.0.0.0:3000->3000/tcp   audion-web:latest

2. Health Check Status:
  audion-api:
    Status: restarting
    Health: unhealthy
    Restart Count: 5
    Exit Code: 1
    Last 5 log lines:
      [ERROR] Failed to connect to database
      [ERROR] Service exiting with code 1

3. Recent Restarts:
  audion-api: 5 restarts

4. Unhealthy Containers:
  audion-api:
    Health Check Logs:
      Health check failed: connection refused
      Health check failed: timeout
```

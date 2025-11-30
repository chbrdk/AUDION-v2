# Manuelle Docker Cleanup Anleitung

## Problem
OrbStack startet nicht richtig - wahrscheinlich wegen vollem Volume oder Docker-Daemon-Problemen.

## Lösung

### Option 1: Script ausführen
```bash
./cleanup-docker-builds.sh
```

### Option 2: Manuell Schritt für Schritt

1. **OrbStack komplett neu starten:**
   ```bash
   killall -9 OrbStack
   open -a OrbStack
   # Warten bis OrbStack vollständig gestartet ist (30-60 Sekunden)
   ```

2. **Docker-Verbindung prüfen:**
   ```bash
   docker ps
   ```

3. **Alte Builds löschen:**
   ```bash
   cd infrastructure
   docker compose down
   docker system prune -a --volumes -f
   docker builder prune -a -f
   ```

4. **Services neu starten:**
   ```bash
   docker compose up -d
   ```

5. **Web Service neu starten:**
   ```bash
   docker compose restart web
   ```

### Option 3: OrbStack komplett neu installieren

Falls OrbStack gar nicht startet:
1. OrbStack komplett deinstallieren
2. Neu installieren
3. Dann Script ausführen

## Nach dem Cleanup

- Prüfe: `docker system df` - sollte weniger Speicher zeigen
- Teste Route: http://192.168.50.101/admin/journeys

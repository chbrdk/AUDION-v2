# Quick Fix: Journeys Route aktivieren

## Auf dem Server (192.168.50.101) ausführen:

### Option 1: Script verwenden
```bash
# Script auf Server kopieren und ausführen
./restart-web-service.sh
```

### Option 2: Manuell
```bash
cd infrastructure
docker compose restart web
```

### Option 3: Mit Build (falls Production Mode)
```bash
cd infrastructure
docker compose up -d --build web
```

## Nach dem Neustart:

1. **Browser Cache leeren:** Cmd+Shift+R (Mac) oder Ctrl+Shift+R (Windows)
2. **Route testen:** http://192.168.50.101/admin/journeys
3. **Navigation prüfen:** "Journeys" sollte in der Sidebar sichtbar sein

## Falls Route immer noch nicht funktioniert:

```bash
# Logs prüfen
docker compose logs web --tail=50

# Prüfen ob Route-Dateien vorhanden sind
ls -la apps/web/app/admin/journeys/

# Next.js Development Server neu starten (falls im Dev Mode)
docker compose exec web npm run dev
```

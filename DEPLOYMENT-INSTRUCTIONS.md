# Deployment-Anweisungen: Settings-Routen

## ✅ Lokale Vorbereitung abgeschlossen

- ✅ Deployment-Skript erstellt und committed
- ✅ Code zu GitHub gepusht
- ✅ Alle Settings-Routen existieren lokal:
  - `/admin/settings/prompts`
  - `/admin/settings/providers`
  - `/admin/settings/theme`

## 🚀 Deployment auf Server (192.168.50.101)

### Schritt 1: SSH auf Server
```bash
ssh user@192.168.50.101
```

### Schritt 2: Ins Projekt-Verzeichnis wechseln
```bash
cd /path/to/AUDION  # Bitte den tatsächlichen Pfad anpassen!
```

### Schritt 3: Code aktualisieren
```bash
git pull origin main
```

### Schritt 4: Web-Container neu bauen
```bash
cd infrastructure
WEB_RUN_BUILD=true docker compose build web
```

### Schritt 5: Web-Container neu starten
```bash
docker compose up -d web
```

### Schritt 6: Logs prüfen
```bash
docker compose logs -f web
```

### Schritt 7: Route testen
```bash
# Im Browser öffnen:
https://192.168.50.101/admin/settings/prompts

# Oder per curl:
curl -I https://192.168.50.101/admin/settings/prompts
```

## 🔍 Troubleshooting

Falls die Route nicht erreichbar ist:

1. **Prüfe ob Container läuft:**
   ```bash
   docker compose ps web
   ```

2. **Prüfe Logs auf Fehler:**
   ```bash
   docker compose logs web --tail=100
   ```

3. **Prüfe ob Route-Dateien existieren:**
   ```bash
   ls -la apps/web/app/admin/settings/
   ```

4. **Prüfe nginx-Logs:**
   ```bash
   docker compose logs nginx --tail=50
   ```

5. **Container komplett neu starten:**
   ```bash
   docker compose down web
   docker compose up -d web
   ```

## 📝 Alternative: Nur Web-Service neu starten

Falls der Code bereits auf dem Server ist:

```bash
cd /path/to/AUDION/infrastructure
docker compose restart web
```


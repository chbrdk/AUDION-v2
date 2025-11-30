#!/bin/bash

# Deployment-Skript für Settings-Routen (Prompts, Providers, Theme)
# Deployed die neuen Admin-Settings-Routen auf den Server

set -e

SERVER="192.168.50.101"
PROJECT_PATH="/path/to/AUDION"  # Bitte anpassen!

echo "🚀 Deploy Settings Routes"
echo "========================"
echo ""

echo "📋 Route: /admin/settings/prompts"
echo "📋 Route: /admin/settings/providers"
echo "📋 Route: /admin/settings/theme"
echo ""

# Prüfe ob wir lokal sind oder auf dem Server
if [ "$(hostname)" != "$(echo $SERVER | cut -d'@' -f2)" ]; then
    echo "📍 Lokales Deployment - bereite vor..."
    echo ""
    echo "⚠️  Für Server-Deployment bitte auf dem Server ausführen:"
    echo "   ssh user@$SERVER"
    echo "   cd $PROJECT_PATH"
    echo "   ./deploy-settings-routes.sh"
    echo ""
    read -p "Möchtest du jetzt auf den Server deployen? (j/n): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[JjYy]$ ]]; then
        echo "🔄 Starte Deployment auf Server..."
        ssh user@$SERVER "cd $PROJECT_PATH && ./deploy-settings-routes.sh"
        exit 0
    else
        echo "❌ Deployment abgebrochen"
        exit 1
    fi
fi

# Auf dem Server ausführen
echo "🔍 Prüfe Projekt-Struktur..."
if [ ! -d "apps/web/app/admin/settings" ]; then
    echo "❌ Fehler: Settings-Ordner nicht gefunden!"
    echo "   Bitte sicherstellen, dass du im Projekt-Root bist"
    exit 1
fi

echo "✅ Settings-Ordner gefunden"
echo ""

echo "📦 Prüfe Git-Status..."
git status --short
echo ""

echo "🔄 Aktualisiere Code..."
git pull origin main || echo "⚠️  Git pull fehlgeschlagen - fahre fort mit lokalem Code"
echo ""

echo "🏗️  Baue TypeScript Types..."
npm run build --workspace packages/types || echo "⚠️  Types-Build fehlgeschlagen"
echo ""

echo "🏗️  Baue Web-App..."
cd infrastructure

echo "🔄 Baue Web-Container neu (mit Build)..."
WEB_RUN_BUILD=true docker compose build web

echo "🔄 Starte Web-Container neu..."
docker compose up -d web

echo "⏳ Warte auf Container-Start..."
sleep 5

echo "📊 Prüfe Container-Status..."
docker compose ps web

echo "📋 Zeige Logs (letzte 50 Zeilen)..."
docker compose logs --tail=50 web

echo ""
echo "✅ Deployment abgeschlossen!"
echo ""
echo "🧪 Teste Routen:"
echo "   - https://$SERVER/admin/settings"
echo "   - https://$SERVER/admin/settings/prompts"
echo "   - https://$SERVER/admin/settings/providers"
echo "   - https://$SERVER/admin/settings/theme"
echo ""
echo "💡 Falls Routen nicht erreichbar sind:"
echo "   1. Prüfe Logs: docker compose logs -f web"
echo "   2. Prüfe nginx: docker compose logs nginx"
echo "   3. Prüfe ob Route-Dateien existieren: ls -la apps/web/app/admin/settings/"


#!/bin/bash

# Lokales Deployment-Skript - bereitet alles vor und gibt Anweisungen
# für das Server-Deployment

set -e

echo "🚀 Deploy Settings Routes - Vorbereitung"
echo "=========================================="
echo ""

# Prüfe ob wir im richtigen Verzeichnis sind
if [ ! -d "apps/web/app/admin/settings" ]; then
    echo "❌ Fehler: Bitte im Projekt-Root ausführen!"
    exit 1
fi

echo "✅ Projekt-Struktur gefunden"
echo ""

# Prüfe Git-Status
echo "📋 Git-Status:"
git status --short
echo ""

# Prüfe ob Settings-Routen existieren
echo "🔍 Prüfe Settings-Routen..."
if [ -f "apps/web/app/admin/settings/prompts/page.tsx" ]; then
    echo "   ✅ /admin/settings/prompts"
else
    echo "   ❌ /admin/settings/prompts fehlt!"
fi

if [ -f "apps/web/app/admin/settings/providers/page.tsx" ]; then
    echo "   ✅ /admin/settings/providers"
else
    echo "   ❌ /admin/settings/providers fehlt!"
fi

if [ -f "apps/web/app/admin/settings/theme/page.tsx" ]; then
    echo "   ✅ /admin/settings/theme"
else
    echo "   ❌ /admin/settings/theme fehlt!"
fi

echo ""
echo "📦 Bereite Deployment vor..."
echo ""

# Prüfe ob Änderungen committed sind
if ! git diff-index --quiet HEAD --; then
    echo "⚠️  Es gibt uncommitted Änderungen!"
    read -p "Möchtest du sie jetzt committen? (j/n): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[JjYy]$ ]]; then
        git add .
        git commit -m "Deploy settings routes"
        echo "✅ Änderungen committed"
    fi
fi

# Prüfe ob gepusht werden muss
LOCAL=$(git rev-parse @)
REMOTE=$(git rev-parse @{u} 2>/dev/null || echo "")

if [ -z "$REMOTE" ] || [ "$LOCAL" != "$REMOTE" ]; then
    echo "📤 Pushe Änderungen zu Remote..."
    read -p "Möchtest du jetzt pushen? (j/n): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[JjYy]$ ]]; then
        git push origin main
        echo "✅ Änderungen gepusht"
    else
        echo "⚠️  Bitte später manuell pushen: git push origin main"
    fi
else
    echo "✅ Code ist bereits auf Remote"
fi

echo ""
echo "=========================================="
echo "📋 Nächste Schritte auf dem Server:"
echo "=========================================="
echo ""
echo "1. SSH auf den Server:"
echo "   ssh user@192.168.50.101"
echo ""
echo "2. Ins Projekt-Verzeichnis wechseln:"
echo "   cd /path/to/AUDION  # Bitte Pfad anpassen!"
echo ""
echo "3. Code aktualisieren:"
echo "   git pull origin main"
echo ""
echo "4. Web-Container neu bauen und starten:"
echo "   cd infrastructure"
echo "   WEB_RUN_BUILD=true docker compose build web"
echo "   docker compose up -d web"
echo ""
echo "5. Logs prüfen:"
echo "   docker compose logs -f web"
echo ""
echo "6. Route testen:"
echo "   curl -I https://192.168.50.101/admin/settings/prompts"
echo ""
echo "=========================================="
echo "✅ Vorbereitung abgeschlossen!"
echo ""


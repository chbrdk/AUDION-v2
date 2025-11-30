#!/bin/bash

# Deployment-Skript für Settings-Routen (Prompts, Providers, Theme)
# Deployed die neuen Admin-Settings-Routen auf den Server

set -e

SERVER="192.168.50.101"
# Automatische Pfad-Erkennung
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_PATH="$SCRIPT_DIR"

echo "🚀 Deploy Settings Routes"
echo "========================"
echo ""

echo "📋 Route: /admin/settings/prompts"
echo "📋 Route: /admin/settings/providers"
echo "📋 Route: /admin/settings/theme"
echo ""

# Prüfe ob wir auf dem Server sind (basierend auf IP oder Hostname)
# Wenn nicht, versuche automatisch zu deployen
CURRENT_IP=$(hostname -I 2>/dev/null | awk '{print $1}' || echo "")
if [[ "$CURRENT_IP" != *"192.168.50.101"* ]] && [[ "$(hostname)" != *"192.168.50.101"* ]]; then
    echo "📍 Lokales System erkannt"
    echo "🔄 Versuche automatisches Deployment auf Server..."
    echo ""
    
    # Versuche verschiedene SSH-User
    for SSH_USER in "m4-dev" "user" "root" "$USER"; do
        echo "   Versuche: $SSH_USER@$SERVER"
        if ssh -o ConnectTimeout=5 -o BatchMode=yes "$SSH_USER@$SERVER" "echo 'SSH-Verbindung erfolgreich'" 2>/dev/null; then
            echo "   ✅ SSH-Verbindung zu $SSH_USER@$SERVER erfolgreich!"
            echo ""
            echo "🔄 Starte Deployment auf Server..."
            ssh "$SSH_USER@$SERVER" "cd $PROJECT_PATH 2>/dev/null || cd ~/AUDION 2>/dev/null || cd /home/*/AUDION 2>/dev/null || cd /opt/AUDION 2>/dev/null || (echo 'Bitte Projekt-Pfad anpassen!' && exit 1) && ./deploy-settings-routes.sh" || {
                echo ""
                echo "⚠️  Automatisches Deployment fehlgeschlagen"
                echo "📋 Bitte manuell auf dem Server ausführen:"
                echo "   ssh $SSH_USER@$SERVER"
                echo "   cd /path/to/AUDION"
                echo "   ./deploy-settings-routes.sh"
                exit 1
            }
            exit 0
        fi
    done
    
    echo "❌ Keine SSH-Verbindung möglich"
    echo "📋 Bitte manuell auf dem Server ausführen:"
    echo "   ssh user@$SERVER"
    echo "   cd /path/to/AUDION"
    echo "   ./deploy-settings-routes.sh"
    exit 1
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


#!/bin/bash
set -e

echo "🔄 Restarting Web Service..."

# Find infrastructure directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
INFRA_DIR="$SCRIPT_DIR/infrastructure"

if [ ! -d "$INFRA_DIR" ]; then
    echo "❌ Infrastructure directory not found at $INFRA_DIR"
    echo "Please run this script from the project root or adjust the path"
    exit 1
fi

cd "$INFRA_DIR"

echo "📋 Current web service status:"
docker compose ps web || echo "Service not running"

echo ""
echo "🔄 Restarting web service..."
docker compose restart web

echo ""
echo "⏳ Waiting for service to be ready..."
sleep 5

echo ""
echo "📋 Service status after restart:"
docker compose ps web

echo ""
echo "✅ Web service restarted!"
echo ""
echo "🌐 Test the route: http://192.168.50.101/admin/journeys"
echo "📝 Check logs if needed: docker compose logs web --tail=50"


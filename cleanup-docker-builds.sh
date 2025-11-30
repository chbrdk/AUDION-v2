#!/bin/bash
set -e

echo "🧹 Cleaning up Docker builds and freeing space..."

# Step 1: Stop OrbStack if running
echo "1️⃣ Stopping OrbStack..."
killall -9 OrbStack 2>/dev/null || echo "OrbStack not running"
sleep 2

# Step 2: Clean up OrbStack data (optional - be careful!)
echo "2️⃣ Cleaning OrbStack cache..."
rm -rf ~/.orbstack/run/docker.sock 2>/dev/null || true
# Don't delete entire .orbstack directory as it contains important data

# Step 3: Start OrbStack
echo "3️⃣ Starting OrbStack..."
open -a OrbStack
echo "⏳ Waiting for OrbStack to start (30 seconds)..."
sleep 30

# Step 4: Check if Docker is ready
echo "4️⃣ Checking Docker connection..."
if ! docker ps > /dev/null 2>&1; then
    echo "❌ Docker still not ready. Please check OrbStack manually."
    echo "   Try: open -a OrbStack"
    exit 1
fi

echo "✅ Docker is ready!"

# Step 5: Stop all containers
echo "5️⃣ Stopping all containers..."
cd "$(dirname "$0")/infrastructure"
docker compose down 2>/dev/null || echo "No containers to stop"

# Step 6: Remove unused images, containers, networks, and volumes
echo "6️⃣ Removing unused Docker resources..."
docker system prune -a --volumes -f

# Step 7: Show disk usage
echo ""
echo "7️⃣ Docker disk usage after cleanup:"
docker system df

# Step 8: Remove old build cache
echo ""
echo "8️⃣ Removing build cache..."
docker builder prune -a -f

# Step 9: Show final disk usage
echo ""
echo "📊 Final Docker disk usage:"
docker system df

echo ""
echo "✅ Cleanup complete!"
echo ""
echo "🔄 Now restarting services..."
docker compose up -d

echo ""
echo "✅ Services restarted!"
echo "🌐 Test: http://192.168.50.101/admin/journeys"


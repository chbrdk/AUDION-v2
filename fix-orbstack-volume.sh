#!/bin/bash
set -e

echo "🔧 Fixing OrbStack volume issues..."
echo ""
echo "⚠️  WARNING: This will stop OrbStack and may require manual intervention."
echo ""

# Stop OrbStack
echo "1️⃣ Stopping OrbStack..."
killall -9 OrbStack 2>/dev/null || echo "   OrbStack not running"
sleep 3

# Check OrbStack data directory size
echo "2️⃣ Checking OrbStack data directory size:"
du -sh ~/.orbstack 2>/dev/null || echo "   Cannot check size"

# Check for large files
echo ""
echo "3️⃣ Finding large files in OrbStack directory:"
find ~/.orbstack -type f -size +100M 2>/dev/null | head -10 || echo "   No large files found"

# Instructions
echo ""
echo "📋 Manual steps to fix:"
echo ""
echo "Option 1: Clean OrbStack data (WARNING: This will delete all containers/images)"
echo "  1. Open OrbStack app"
echo "  2. Go to Settings > Advanced"
echo "  3. Click 'Reset OrbStack' or 'Clean up disk space'"
echo ""
echo "Option 2: Increase OrbStack disk size"
echo "  1. Open OrbStack app"
echo "  2. Go to Settings > Resources"
echo "  3. Increase disk size"
echo ""
echo "Option 3: Reinstall OrbStack"
echo "  1. Uninstall OrbStack"
echo "  2. Delete ~/.orbstack directory"
echo "  3. Reinstall OrbStack"
echo ""
echo "After fixing, restart OrbStack and run:"
echo "  ./cleanup-docker-builds.sh"

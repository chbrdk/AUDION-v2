#!/bin/bash
# Script zum Messen der Baseline-Performance-Metriken
# Usage: ./scripts/measure-baseline.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
OUTPUT_FILE="$PROJECT_ROOT/tests/baseline_performance.json"

echo "🔍 Measuring Baseline Performance Metrics..."
echo "Output: $OUTPUT_FILE"
echo ""

# Frontend Bundle Size
echo "📦 Measuring Frontend Bundle Size..."
cd "$PROJECT_ROOT/apps/web"
if [ -f "package.json" ]; then
    echo "  Running: npm run build"
    BUILD_START=$(date +%s)
    npm run build 2>&1 | tee /tmp/web-build.log
    BUILD_END=$(date +%s)
    BUILD_TIME=$((BUILD_END - BUILD_START))
    echo "  Build time: ${BUILD_TIME}s"
    
    # Try to extract bundle size from .next/analyze if available
    if [ -d ".next" ]; then
        echo "  Bundle analysis available in .next directory"
    fi
else
    echo "  ⚠️  package.json not found, skipping frontend metrics"
fi

echo ""

# Backend API Response Times (requires services to be running)
echo "🚀 Measuring Backend API Response Times..."
echo "  ⚠️  Note: Services must be running for this measurement"
echo "  Use: wrk -t4 -c100 -d30s http://localhost:8000/personas"
echo "  Or: ab -n 1000 -c 10 http://localhost:8000/personas"
echo ""

# Database Query Performance (requires database connection)
echo "🗄️  Measuring Database Query Performance..."
echo "  ⚠️  Note: Database must be accessible for this measurement"
echo "  Use: psql -d persona -c 'EXPLAIN ANALYZE SELECT ...'"
echo ""

# Docker Build Times
echo "🐳 Measuring Docker Build Times..."
if command -v docker &> /dev/null; then
    echo "  ⚠️  Note: Run manually: time docker compose -f infrastructure/compose.yml build"
    echo "  This will take several minutes..."
else
    echo "  ⚠️  Docker not found, skipping Docker metrics"
fi

echo ""
echo "✅ Baseline measurement script completed"
echo ""
echo "📝 Next steps:"
echo "  1. Fill in the NULL values in $OUTPUT_FILE with actual measurements"
echo "  2. Run API load tests: wrk or Apache Bench"
echo "  3. Run database query analysis: EXPLAIN ANALYZE"
echo "  4. Run Lighthouse: lighthouse http://localhost:3000"
echo ""
echo "💡 Tip: Use the measurement results to update $OUTPUT_FILE"

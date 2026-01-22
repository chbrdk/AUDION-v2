#!/bin/bash
# Quick check of build status and errors

LOG_FILE="/tmp/audion-direct-build.log"

if [ ! -f "$LOG_FILE" ]; then
    echo "❌ Build log not found. Is the build running?"
    exit 1
fi

echo "📊 Build Status Check"
echo "=========================================="
echo "📄 Log file: $LOG_FILE"
echo "📏 Log size: $(wc -l < "$LOG_FILE") lines"
echo ""

# Check if build is still running
if ps aux | grep -q "docker build.*audion-web-test" | grep -v grep; then
    echo "🔄 Build is still running..."
    echo ""
else
    echo "⏹️  Build process not found (may have completed)"
    echo ""
fi

# Show last 20 lines
echo "📋 Last 20 lines:"
echo "-----------------------------------"
tail -n 20 "$LOG_FILE"
echo ""

# Check for errors
ERRORS=$(grep -i "error\|failed\|Type error" "$LOG_FILE" | wc -l | tr -d ' ')

if [ "$ERRORS" -gt 0 ]; then
    echo "❌ Found $ERRORS error(s)!"
    echo "🔍 Recent errors:"
    echo "-----------------------------------"
    grep -i "error\|failed\|Type error" "$LOG_FILE" | tail -n 10
    echo ""
    echo "📄 Full error context:"
    tail -n 200 "$LOG_FILE" | grep -A 15 -B 5 -i "error\|failed\|Type error" | tail -n 50
else
    echo "✅ No errors found so far"
fi

# Check build progress
if grep -q "Compiled successfully\|Running TypeScript\|Generating static pages" "$LOG_FILE"; then
    echo ""
    echo "🎯 Build Progress:"
    grep -E "Compiled|Running TypeScript|Generating static pages|DONE.*builder" "$LOG_FILE" | tail -n 5
fi

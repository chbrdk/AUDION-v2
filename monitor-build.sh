#!/bin/bash
# Monitor the isolated build and show errors in real-time

TEMP_DIR=$(ls -td /tmp/audion-build-test-* 2>/dev/null | head -n 1)

if [ -z "$TEMP_DIR" ]; then
    echo "❌ No build test directory found. Run ./test-build-isolated.sh first."
    exit 1
fi

LOG_FILE="$TEMP_DIR/build-output.log"

echo "📊 Monitoring build progress..."
echo "📁 Log file: $LOG_FILE"
echo ""

if [ -f "$LOG_FILE" ]; then
    # Show last 50 lines
    echo "📋 Last 50 lines of build output:"
    echo "=========================================="
    tail -n 50 "$LOG_FILE"
    echo ""
    
    # Check for errors
    ERROR_COUNT=$(grep -i "error\|failed\|failed to solve" "$LOG_FILE" | wc -l | tr -d ' ')
    if [ "$ERROR_COUNT" -gt 0 ]; then
        echo ""
        echo "❌ $ERROR_COUNT error(s) detected in build!"
        echo "🔍 Recent errors:"
        grep -i "error\|failed\|failed to solve" "$LOG_FILE" | tail -n 10
    else
        echo "✅ No errors found so far..."
    fi
else
    echo "⏳ Build log not yet created. Build may still be initializing..."
fi

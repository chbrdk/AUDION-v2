#!/bin/bash
# Watch build logs and extract errors in real-time

LOG_FILE="/tmp/audion-direct-build.log"
MAX_WAIT=600  # 10 minutes
CHECK_INTERVAL=5

echo "👀 Watching build for errors..."
echo "📄 Log file: $LOG_FILE"
echo "⏱️  Will check every ${CHECK_INTERVAL}s for up to ${MAX_WAIT}s"
echo ""

ELAPSED=0
LAST_LINE_COUNT=0

while [ $ELAPSED -lt $MAX_WAIT ]; do
    if [ -f "$LOG_FILE" ]; then
        CURRENT_LINE_COUNT=$(wc -l < "$LOG_FILE" 2>/dev/null || echo "0")
        
        if [ "$CURRENT_LINE_COUNT" -gt "$LAST_LINE_COUNT" ]; then
            # New lines added, check for errors
            NEW_LINES=$((CURRENT_LINE_COUNT - LAST_LINE_COUNT))
            tail -n "$NEW_LINES" "$LOG_FILE" | grep -i "error\|failed\|Type error" && {
                echo ""
                echo "❌ ERROR DETECTED! Showing context:"
                echo "=========================================="
                tail -n 50 "$LOG_FILE" | grep -A 15 -B 5 -i "error\|failed\|Type error"
                echo ""
                echo "📄 Full log: $LOG_FILE"
                exit 1
            }
            LAST_LINE_COUNT=$CURRENT_LINE_COUNT
        fi
        
        # Check if build completed
        if grep -q "DONE\|ERROR\|failed to solve" "$LOG_FILE" 2>/dev/null; then
            if grep -qi "error\|failed" "$LOG_FILE"; then
                echo ""
                echo "❌ Build completed with errors!"
                echo "=========================================="
                tail -n 100 "$LOG_FILE" | grep -A 10 -B 5 -i "error\|failed\|Type error"
                exit 1
            else
                echo ""
                echo "✅ Build completed successfully!"
                exit 0
            fi
        fi
    fi
    
    sleep $CHECK_INTERVAL
    ELAPSED=$((ELAPSED + CHECK_INTERVAL))
    echo -n "."
done

echo ""
echo "⏱️  Timeout reached. Checking final status..."
if [ -f "$LOG_FILE" ]; then
    if grep -qi "error\|failed" "$LOG_FILE"; then
        echo "❌ Errors found in log:"
        tail -n 100 "$LOG_FILE" | grep -A 10 -B 5 -i "error\|failed\|Type error"
        exit 1
    else
        echo "✅ No errors found (build may still be running)"
    fi
fi

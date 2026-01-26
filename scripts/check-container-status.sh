#!/bin/bash
# Script to check status of all AUDION containers
# This helps identify which containers are restarting or unhealthy

echo "=========================================="
echo "AUDION Container Status Check"
echo "=========================================="
echo ""

# Check if we're in a Docker environment
if ! command -v docker &> /dev/null; then
    echo "ERROR: docker command not found. This script must be run on a system with Docker."
    exit 1
fi

echo "1. Container Status (docker ps -a):"
echo "-----------------------------------"
docker ps -a --filter "name=audion" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}\t{{.Image}}" 2>/dev/null || docker ps -a | grep audion

echo ""
echo "2. Health Check Status:"
echo "-----------------------------------"
# Check health status for each container
for container in audion-web audion-api audion-chat-api audion-indexing-api audion-celery-worker audion-celery-beat audion-qdrant audion-neo4j; do
    if docker ps -a --format "{{.Names}}" | grep -q "^${container}$"; then
        health=$(docker inspect --format='{{.State.Health.Status}}' "${container}" 2>/dev/null || echo "no-health-check")
        status=$(docker inspect --format='{{.State.Status}}' "${container}" 2>/dev/null || echo "unknown")
        restart_count=$(docker inspect --format='{{.RestartCount}}' "${container}" 2>/dev/null || echo "0")
        exit_code=$(docker inspect --format='{{.State.ExitCode}}' "${container}" 2>/dev/null || echo "N/A")
        
        echo "  ${container}:"
        echo "    Status: ${status}"
        echo "    Health: ${health}"
        echo "    Restart Count: ${restart_count}"
        echo "    Exit Code: ${exit_code}"
        
        # Show last few log lines if container is restarting
        if [ "${status}" = "restarting" ] || [ "${restart_count}" -gt 0 ]; then
            echo "    Last 5 log lines:"
            docker logs --tail 5 "${container}" 2>/dev/null | sed 's/^/      /' || echo "      (no logs available)"
        fi
        echo ""
    fi
done

echo ""
echo "3. Recent Restarts (containers with restart_count > 0):"
echo "-----------------------------------"
docker ps -a --filter "name=audion" --format "{{.Names}}\t{{.RestartCount}}" | awk '$2 > 0 {print "  " $1 ": " $2 " restarts"}'

echo ""
echo "4. Unhealthy Containers:"
echo "-----------------------------------"
unhealthy=$(docker ps -a --filter "name=audion" --filter "health=unhealthy" --format "{{.Names}}" 2>/dev/null)
if [ -z "$unhealthy" ]; then
    echo "  No unhealthy containers found."
else
    echo "$unhealthy" | while read -r container; do
        echo "  ${container}:"
        echo "    Health Check Logs:"
        docker inspect --format='{{json .State.Health.Log}}' "${container}" 2>/dev/null | jq -r '.[-3:] | .[] | "      " + .Output' || echo "      (no health check logs)"
    done
fi

echo ""
echo "5. Container Resource Usage:"
echo "-----------------------------------"
docker stats --no-stream --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.NetIO}}" $(docker ps -a --filter "name=audion" --format "{{.Names}}" | tr '\n' ' ') 2>/dev/null || echo "  (stats not available)"

echo ""
echo "=========================================="
echo "Done. Check above for containers with:"
echo "  - Status: 'restarting'"
echo "  - Health: 'unhealthy'"
echo "  - Restart Count > 0"
echo "=========================================="

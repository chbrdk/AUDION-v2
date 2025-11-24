# Troubleshooting 502 Bad Gateway Errors

## Problem

When accessing Persona Backend API endpoints through nginx, you may encounter 502 Bad Gateway errors:

```
GET https://192.168.50.101/api/persona-backend/personas/{id}/avatar 502 (Bad Gateway)
POST https://192.168.50.101/api/persona-backend/personas/{id}/documents/{docId}/retry 502 (Bad Gateway)
```

## Root Causes

A 502 Bad Gateway error means nginx (the reverse proxy) cannot communicate with the backend service. Common causes:

1. **Backend service not running**: The `persona-api` container is not running or has crashed
2. **Service not reachable**: Network connectivity issues between nginx and persona-api
3. **Service crashing**: The backend service starts but crashes on requests
4. **URL rewrite issues**: nginx configuration incorrectly rewrites URLs

## Diagnosis Steps

### 1. Check if Backend Service is Running

```bash
docker compose -f infrastructure/compose.yml ps persona-api
```

Expected output should show `Up` status. If it shows `Exit` or `Restarting`, the service has issues.

### 2. Check Backend Service Logs

```bash
docker compose -f infrastructure/compose.yml logs persona-api --tail=50
```

Look for:
- Startup errors
- Database connection errors
- Import errors
- Runtime exceptions

### 3. Test Direct Backend Access

From within the nginx container or host:

```bash
# Test if service is reachable
curl http://persona-api:8000/docs

# Test specific endpoint
curl http://persona-api:8000/personas/{persona_id}/avatar
```

If these fail, the service is not running or not accessible.

### 4. Check nginx Error Logs

```bash
docker compose -f infrastructure/compose.yml logs nginx --tail=50
```

Look for connection refused errors or upstream errors.

### 5. Verify nginx Configuration

The nginx configuration should have:

```nginx
location /api/persona-backend/ {
    rewrite ^/api/persona-backend(.*)$ $1 break;
    proxy_pass http://persona-api;
    # ... other settings
}
```

This rewrites `/api/persona-backend/personas/123/avatar` to `/personas/123/avatar` before proxying.

## Solutions

### Solution 1: Restart Backend Service

```bash
docker compose -f infrastructure/compose.yml restart persona-api
```

### Solution 2: Check Service Dependencies

Ensure all dependencies are running:

```bash
docker compose -f infrastructure/compose.yml ps
```

All services should be `Up`:
- `postgres` (database)
- `redis` (cache)
- `qdrant` (vector store)
- `neo4j` (graph database)
- `persona-api` (backend)

### Solution 3: Rebuild and Restart

If the service keeps crashing:

```bash
# Rebuild the service
docker compose -f infrastructure/compose.yml build persona-api

# Restart
docker compose -f infrastructure/compose.yml up -d persona-api
```

### Solution 4: Check Database Connection

The backend requires a database connection. Verify:

```bash
# Check if database is accessible
docker compose -f infrastructure/compose.yml exec persona-api \
  python -c "from app.db import get_session; next(get_session())"
```

### Solution 5: Verify Environment Variables

Check that required environment variables are set:

```bash
docker compose -f infrastructure/compose.yml exec persona-api env | grep -E "(DATABASE_URL|REDIS_URL|QDRANT_URL)"
```

### Solution 6: Check Port Conflicts

Ensure port 8000 is not already in use:

```bash
docker compose -f infrastructure/compose.yml ps persona-api
# Check the port mapping
```

## Common Issues

### Issue: Service Starts Then Immediately Exits

**Cause**: Missing environment variables or database connection failure

**Solution**:
1. Check `.env` file exists and has all required variables
2. Verify database is running: `docker compose ps postgres`
3. Check database connection string format

### Issue: Service Runs But Returns 502

**Cause**: Service is running but not listening on expected port or host

**Solution**:
1. Verify `API_HOST=0.0.0.0` and `API_PORT=8000` in environment
2. Check service logs for binding errors
3. Test direct connection: `curl http://persona-api:8000/docs`

### Issue: Intermittent 502 Errors

**Cause**: Service is crashing under load or timeout issues

**Solution**:
1. Increase nginx timeouts (already configured to 300s)
2. Check service resource limits in compose.yml
3. Review service logs for memory/CPU issues

## Prevention

1. **Health Checks**: Add health check endpoints to monitor service status
2. **Logging**: Ensure structured logging is enabled for easier debugging
3. **Monitoring**: Set up monitoring to alert on service failures
4. **Graceful Shutdown**: Ensure services handle shutdown signals correctly

## Related Documentation

- `Docs/backend-ingestion-fixes.md`: Backend service configuration
- `infrastructure/compose.yml`: Service definitions
- `infrastructure/nginx/nginx.conf`: nginx configuration


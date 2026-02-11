# Coolify Deployment Guide

This guide walks you through deploying AUDION on Coolify, a self-hosted deployment platform.

## Prerequisites

- Coolify instance running and accessible
- GitHub repository with AUDION code
- Domain name (optional, can use Coolify-provided domain)

## Step 1: Database Resources Setup

AUDION requires PostgreSQL and Redis. In Coolify, create these as **Database Resources**:

### PostgreSQL Database

1. Navigate to **Resources** → **Databases** → **PostgreSQL**
2. Click **Create Resource**
3. Configure:
   - **Name**: `audion-postgres` (or your preferred name)
   - **Version**: 16+ (recommended)
   - **Database Name**: `audion`
   - **Username**: `audion` (or your preferred username)
   - **Password**: Generate a strong password (save this!)
4. Note the connection details:
   - **Host**: `audion-postgres` (internal service name)
   - **Port**: `5432`
   - **Database**: `audion`
   - **User**: `audion`
   - **Password**: (the one you generated)

### Redis Database

1. Navigate to **Resources** → **Databases** → **Redis**
2. Click **Create Resource**
3. Configure:
   - **Name**: `audion-redis` (or your preferred name)
   - **Version**: 7.4+ (recommended)
4. Note the connection details:
   - **Host**: `audion-redis` (internal service name)
   - **Port**: `6379`
   - **Password**: (if set, otherwise empty)

## Step 2: Create New Application

1. In Coolify, navigate to **Applications**
2. Click **New Application**
3. Select **Docker Compose**
4. Configure:
   - **Name**: `audion`
   - **Repository**: Your GitHub repository URL
   - **Branch**: `main` (or your default branch)
   - **Build Pack**: Docker Compose

## Step 3: Configure Environment Variables

In the application settings, add the following environment variables:

### Database Configuration

```bash
# PostgreSQL (from Database Resource)
DATABASE_URL=postgresql://audion:YOUR_PASSWORD@audion-postgres:5432/audion

# Redis (from Database Resource)
REDIS_URL=redis://audion-redis:6379/0
```

### Vector & Graph Databases

```bash
# Qdrant (internal service)
QDRANT_URL=http://qdrant:6333

# Neo4j – Hostname must match your Neo4j resource/service name in Coolify
# If you see "Failed to DNS resolve address audion-neo4j", set NEO4J_URI to your actual Neo4j host (e.g. neo4j if the service is named neo4j)
NEO4J_URI=bolt://neo4j:7687
NEO4J_USER=neo4j
NEO4J_PASSWORD=YOUR_NEO4J_PASSWORD
```

### AI API Keys

```bash
# Required
OPENAI_API_KEY=sk-proj-...

# Optional (for Claude support)
CLAUDE_API_KEY=sk-ant-...
```

### Application Configuration

```bash
# Environment
APP_ENV=production

# Frontend Base Path (leave empty for root domain, or set to /audion for sub-path)
NEXT_PUBLIC_BASE_PATH=

# Internal Service URLs (use Docker Compose service names)
NEXT_PUBLIC_PERSONA_BACKEND_URL=http://api:8000
NEXT_PUBLIC_CHAT_API_URL=http://chat-api:8001
NEXT_PERSONA_BACKEND_INTERNAL_URL=http://api:8000
```

### API service: public URL for avatars and downloads

Set this **on the api service** (not the web service) so avatar and document URLs in API responses use HTTPS and your domain instead of `http://localhost:8000` (which causes Mixed Content on HTTPS pages):

```bash
# Example: app at https://audion.example.com, API proxied under /api
PERSONA_BACKEND_PUBLIC_URL=https://audion.example.com/api
```

If you don’t set this, the frontend will still try to avoid Mixed Content by loading avatars via the same-origin proxy (`/api/persona-admin/:id/avatar`).

### Coolify-Specific Notes

- **Database Resources**: When using Coolify Database Resources, the hostname is the resource name (e.g., `audion-postgres`, `audion-redis`)
- **Internal Networking**: Services communicate using Docker Compose service names (`api`, `chat-api`, `qdrant`, `neo4j`)
- **External Access**: Only `web` service needs external port exposure (Coolify handles this automatically)

## Step 4: Configure Docker Compose

Coolify will use the `docker-compose.yml` file in the repository root. Ensure it's configured correctly:

- All services use internal networking
- Database connections use service names
- Health checks are configured
- Volumes are defined for persistent data

## Step 5: Domain Configuration

1. In Coolify application settings, navigate to **Domains**
2. Add your domain (or use Coolify-provided domain)
3. Configure SSL (Coolify handles Let's Encrypt automatically)
4. If deploying at root:
   - Set `NEXT_PUBLIC_BASE_PATH=` (empty)
5. If deploying at sub-path (e.g., `/audion`):
   - Set `NEXT_PUBLIC_BASE_PATH=/audion`

## Step 6: Deploy

1. Click **Deploy** in Coolify
2. Monitor the build logs
3. Wait for all services to start (check health checks)

## Step 7: Database Migration

After the first deployment, run database migrations:

1. Open a terminal in the `api` service container:
   ```bash
   # In Coolify, navigate to the application → Services → api → Terminal
   ```

2. Run migrations:
   ```bash
   alembic upgrade head
   ```

Alternatively, you can add a migration step to your deployment process or use an init container.

## Step 8: Verification

### Check Service Health

1. In Coolify, navigate to **Services**
2. Verify all services show as **Healthy**:
   - `web`: Frontend
   - `api`: Backend API
   - `chat-api`: Chat API
   - `indexing-api`: Indexing API
   - `celery-worker`: Background jobs
   - `celery-beat`: Scheduled tasks
   - `qdrant`: Vector database
   - `neo4j`: Graph database

### Test Endpoints

1. **Frontend**: `https://your-domain.com` (or `https://your-domain.com/audion`)
2. **API Health**: `https://your-domain.com/api/health`
3. **Chat API Health**: Check logs or internal endpoint

### Check Logs

```bash
# In Coolify, navigate to Services → [service-name] → Logs
```

Look for:
- Database connection success
- Service startup completion
- Health check passes
- No critical errors

## Troubleshooting

### Services Not Starting

**Problem**: Services fail to start or crash immediately.

**Solutions**:
1. Check environment variables are set correctly
2. Verify database resources are running and accessible
3. Review service logs for specific errors
4. Ensure all required environment variables are present

### Database Connection Errors

**Problem**: `Connection refused` or `authentication failed`.

**Solutions**:
1. Verify `DATABASE_URL` uses the correct Database Resource hostname
2. Check database resource is running in Coolify
3. Ensure username/password match the database resource configuration
4. Test connection from within the container:
   ```bash
   docker-compose exec api python -c "from app.db import engine; engine.connect()"
   ```

### Port Conflicts

**Problem**: Port already in use.

**Solutions**:
1. Coolify manages ports automatically - ensure no manual port mappings conflict
2. Check if another application is using the same ports
3. Use Coolify's port management features

### AI Features Not Working

**Problem**: AI assist or chat features return errors.

**Solutions**:
1. Verify `OPENAI_API_KEY` is set and valid
2. Check API key has sufficient credits/quota
3. Review API service logs for specific error messages
4. Test API key directly:
   ```bash
   curl https://api.openai.com/v1/models -H "Authorization: Bearer $OPENAI_API_KEY"
   ```

### Frontend Not Loading

**Problem**: Frontend returns 404 or blank page.

**Solutions**:
1. Verify `NEXT_PUBLIC_BASE_PATH` matches your domain configuration
2. Check Next.js build completed successfully
3. Review frontend logs for build errors
4. Ensure `NEXT_PUBLIC_PERSONA_BACKEND_URL` and `NEXT_PUBLIC_CHAT_API_URL` are set correctly

## Maintenance

### Updating the Application

1. Push changes to your GitHub repository
2. In Coolify, click **Redeploy**
3. Monitor build and deployment logs
4. Verify services restart successfully

### Database Backups

1. Use Coolify's built-in backup features for Database Resources
2. Or configure automated backups:
   ```bash
   # PostgreSQL backup
   pg_dump -h audion-postgres -U audion -d audion > backup.sql
   ```

### Scaling

Coolify supports horizontal scaling:
1. Navigate to **Services** → **[service-name]** → **Settings**
2. Adjust replica count
3. Ensure load balancer is configured (Coolify handles this)

### Monitoring

- Use Coolify's built-in monitoring dashboard
- Check service health status
- Review logs regularly
- Set up alerts for service failures

## Next Steps

- Configure custom domains and SSL
- Set up automated backups
- Configure monitoring and alerts
- Review and optimize resource usage
- Set up CI/CD pipelines for automated deployments

## Additional Resources

- [Coolify Documentation](https://coolify.io/docs)
- [AUDION Environment Variables](environment-variables.md)
- [AUDION README](../README.md)

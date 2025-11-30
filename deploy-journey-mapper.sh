#!/bin/bash
set -e

echo "🚀 Deploying Journey Mapper Feature..."

cd "$(dirname "$0")/infrastructure"

echo "📦 Building persona-api image..."
docker compose build persona-api

echo "🔄 Starting services..."
docker compose up -d persona-api

echo "⏳ Waiting for service to be ready..."
sleep 10

echo "🗄️  Running database migration..."
docker compose exec persona-api python -m alembic upgrade head

echo "✅ Migration completed! Checking current version..."
docker compose exec persona-api python -m alembic current

echo "🎉 Journey Mapper Feature deployed successfully!"
echo ""
echo "Next steps:"
echo "1. Frontend build (if needed): cd apps/web && npm run build"
echo "2. Restart web service: cd infrastructure && docker compose restart web"
echo "3. Check API docs: http://localhost/api/persona-backend/docs"


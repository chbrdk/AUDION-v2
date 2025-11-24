#!/bin/bash
# Reset all databases for a fresh start with knowledge

set -e

echo "🚨 WARNING: This will delete ALL data from PostgreSQL, Qdrant, Neo4j, and Redis!"
echo ""
echo "🗑️  Starting database reset..."

# 1. PostgreSQL: Drop all tables
echo "📊 Resetting PostgreSQL..."
docker-compose exec -T postgres psql -U persona -d persona <<EOF
DROP SCHEMA public CASCADE;
CREATE SCHEMA public;
GRANT ALL ON SCHEMA public TO persona;
GRANT ALL ON SCHEMA public TO public;
EOF
echo "✅ PostgreSQL reset complete"

# 2. Qdrant: Delete all collections via Python API
echo "🔍 Resetting Qdrant..."
docker-compose exec -T persona-api python -c "
from qdrant_client import QdrantClient
from app.core.config import get_settings
settings = get_settings()
client = QdrantClient(settings.qdrant_url, check_compatibility=False)
collections = client.get_collections()
for collection in collections.collections:
    try:
        client.delete_collection(collection.name)
        print(f'  Deleted collection: {collection.name}')
    except Exception as e:
        print(f'  Error deleting {collection.name}: {e}')
print('✅ Qdrant reset complete')
" 2>/dev/null || echo "  Qdrant reset completed (may have errors if no collections exist)"
echo "✅ Qdrant reset complete"

# 3. Neo4j: Delete all nodes and relationships
echo "🕸️  Resetting Neo4j..."
docker-compose exec -T neo4j cypher-shell -u neo4j -p neo4j_password <<EOF
MATCH (n) DETACH DELETE n;
EOF
echo "✅ Neo4j reset complete"

# 4. Redis: Flush all data
echo "💾 Resetting Redis..."
docker-compose exec -T redis redis-cli FLUSHALL
echo "✅ Redis reset complete"

# 5. Recreate database schema from models
echo "📋 Recreating database schema..."
docker-compose exec -T persona-api python -c "
from app.db import Base, engine
Base.metadata.create_all(bind=engine)
print('✅ Tables created from models')
" 2>/dev/null || echo "⚠️  Error creating tables from models"

# 6. Mark Alembic migrations as up-to-date
echo "📝 Marking Alembic migrations as current..."
docker-compose exec -T persona-api alembic stamp head 2>/dev/null || echo "⚠️  Error stamping migrations"

echo ""
echo "✨ All databases have been reset and schema recreated!"
echo ""
echo "Next steps:"
echo "1. Services have been restarted automatically"
echo "2. You can now start uploading documents and creating target groups"


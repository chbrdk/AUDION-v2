#!/usr/bin/env python3
"""Script to migrate existing Qdrant points with target_group_id."""

import os
import sys

# Set default environment variables if not set
os.environ.setdefault("DATABASE_URL", "postgresql+psycopg://persona:persona@localhost:55432/persona")
os.environ.setdefault("REDIS_URL", "redis://localhost:6380/0")
os.environ.setdefault("QDRANT_URL", "http://localhost:6333")
os.environ.setdefault("NEO4J_URI", "bolt://localhost:7687")
os.environ.setdefault("NEO4J_USER", "neo4j")
os.environ.setdefault("NEO4J_PASSWORD", "neo4j_password")
os.environ.setdefault("CLAUDE_API_KEY", "test")

from app.services.qdrant_migration import QdrantMigrationService

if __name__ == "__main__":
    print("Starting Qdrant migration...")
    service = QdrantMigrationService()
    
    try:
        result = service.migrate_existing_points()
        print(f"\n✅ Migration completed!")
        print(f"   Total points: {result['total_points']}")
        print(f"   Updated: {result['updated']}")
        print(f"   Skipped: {result['skipped']}")
        print(f"   Errors: {result['errors']}")
    except Exception as e:
        print(f"\n❌ Migration failed: {e}", file=sys.stderr)
        sys.exit(1)


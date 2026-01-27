"""
Database Initialization Script
Handles schema creation, fresh table setup, and migrations.
"""
import logging
import sys
from sqlalchemy import text
from alembic.config import Config
from alembic import command
from app.db import engine, Base, SessionLocal

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def init_db():
    try:
        # 1. Create schema if not exists
        with engine.connect() as conn:
            logger.info("Ensuring schema 'audion' exists...")
            conn.execute(text("CREATE SCHEMA IF NOT EXISTS audion"))
            conn.commit()

        # 2. Emergency partial fix: Ensure object_key column exists
        # We run this BEFORE Alembic to guarantee the column is present even if migrations fail
        try:
            with engine.connect() as conn:
                logger.info("Verifying schema integrity for 'documents' table...")
                # Check if table exists first
                table_check = conn.execute(text(
                    "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'audion' AND table_name = 'documents')"
                ))
                if table_check.scalar():
                    # Check if column exists
                    col_check = conn.execute(text(
                        "SELECT column_name FROM information_schema.columns "
                        "WHERE table_schema = 'audion' AND table_name = 'documents' AND column_name = 'object_key'"
                    ))
                    if not col_check.scalar():
                        logger.warning("CRITICAL: 'object_key' column missing from 'audion.documents'. Applying emergency fix...")
                        conn.execute(text("ALTER TABLE audion.documents ADD COLUMN IF NOT EXISTS object_key VARCHAR(512)"))
                        conn.commit()
                        logger.info("Emergency fix applied: 'object_key' column added.")
                    else:
                        logger.info("Schema verification passed: 'object_key' column exists.")

                # 2b. Emergency fix: Ensure target_groups tables exist (Migration 20251121_2138 might have failed)
                logger.info("Verifying schema integrity for 'target_groups'...")
                tg_check = conn.execute(text(
                    "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'audion' AND table_name = 'target_groups')"
                ))
                if not tg_check.scalar():
                    logger.warning("CRITICAL: 'target_groups' table missing. Creating tables...")
                    conn.execute(text("""
                        CREATE TABLE IF NOT EXISTS audion.target_groups (
                            id UUID PRIMARY KEY,
                            project_id UUID NOT NULL,
                            name VARCHAR(128) NOT NULL,
                            description TEXT,
                            segment VARCHAR(128) NOT NULL,
                            created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT now() NOT NULL,
                            updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT now() NOT NULL,
                            updated_by VARCHAR(128)
                        );
                        CREATE TABLE IF NOT EXISTS audion.target_group_sources (
                            id UUID PRIMARY KEY,
                            target_group_id UUID NOT NULL REFERENCES audion.target_groups(id) ON DELETE CASCADE,
                            chunk_id UUID NOT NULL REFERENCES audion.document_chunks(id),
                            relevance_score FLOAT DEFAULT 1.0 NOT NULL,
                            rationale TEXT,
                            created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT now() NOT NULL
                        );
                        CREATE TABLE IF NOT EXISTS audion.target_group_knowledge_entries (
                            id UUID PRIMARY KEY,
                            target_group_id UUID NOT NULL REFERENCES audion.target_groups(id) ON DELETE CASCADE,
                            title VARCHAR(256) NOT NULL,
                            content TEXT NOT NULL,
                            metadata JSONB,
                            created_by VARCHAR(128) NOT NULL,
                            created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT now() NOT NULL
                        );
                    """))
                    conn.commit()
                    logger.info("Emergency fix applied: 'target_groups' and related tables created.")
                
                # Check personas.target_group_id column
                logger.info("Verifying schema integrity for 'personas.target_group_id'...")
                p_tg_check = conn.execute(text(
                    "SELECT column_name FROM information_schema.columns "
                    "WHERE table_schema = 'audion' AND table_name = 'personas' AND column_name = 'target_group_id'"
                ))
                if not p_tg_check.scalar():
                    logger.warning("CRITICAL: 'target_group_id' missing in 'personas'. Adding column...")
                    conn.execute(text("ALTER TABLE audion.personas ADD COLUMN IF NOT EXISTS target_group_id UUID REFERENCES audion.target_groups(id) ON DELETE SET NULL"))
                    conn.commit()
                    logger.info("Emergency fix applied: 'personas.target_group_id' added.")

        except Exception as e:
            logger.error(f"Emergency fix failed (ignoring to proceed with normal init): {e}")

        # 3. Check if alembic_version table exists
        with engine.connect() as conn:
            result = conn.execute(text(
                "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'audion' AND table_name = 'alembic_version')"
            ))
            exists = result.scalar()

        alembic_cfg = Config("alembic.ini")

        if not exists:
            logger.info("Fresh database detected. Creating all tables from models...")
            # Use the engine to create all tables defined in Base.metadata
            # The search_path is set to 'audion, public' in engine events (db.py)
            Base.metadata.create_all(bind=engine)
            
            logger.info("Stamping database with current migration version...")
            command.stamp(alembic_cfg, "head")
            logger.info("Existing database detected. Running migrations...")
            command.upgrade(alembic_cfg, "head")

        # 3. Emergency partial fix: Ensure object_key column exists
        # This bypasses Alembic to guarantee the column is present regardless of migration history state
        with engine.connect() as conn:
            logger.info("Verifying schema integrity for 'documents' table...")
            
            # Check if column exists in the correct schema
            result = conn.execute(text(
                "SELECT column_name FROM information_schema.columns "
                "WHERE table_schema = 'audion' AND table_name = 'documents' AND column_name = 'object_key'"
            ))
            if not result.scalar():
                logger.warning("CRITICAL: 'object_key' column missing from 'audion.documents'. Applying emergency fix...")
                conn.execute(text("ALTER TABLE audion.documents ADD COLUMN IF NOT EXISTS object_key VARCHAR(512)"))
                conn.commit()
                logger.info("Emergency fix applied: 'object_key' column added.")
            else:
                logger.info("Schema verification passed: 'object_key' column exists.")

        logger.info("Database initialization completed successfully.")

    except Exception as e:
        logger.error(f"Database initialization failed: {e}")
        sys.exit(1)

if __name__ == "__main__":
    init_db()

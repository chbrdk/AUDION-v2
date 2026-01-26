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

        # 2. Check if alembic_version table exists
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
        else:
            logger.info("Existing database detected. Running migrations...")
            command.upgrade(alembic_cfg, "head")

        logger.info("Database initialization completed successfully.")

    except Exception as e:
        logger.error(f"Database initialization failed: {e}")
        sys.exit(1)

if __name__ == "__main__":
    init_db()

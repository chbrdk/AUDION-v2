"""
Database Configuration
SQLAlchemy setup for Chat API database.
Now uses STORION database with audion schema.
"""
from __future__ import annotations

from contextlib import contextmanager
from sqlalchemy import create_engine, event, text
from sqlalchemy.orm import Session, declarative_base, sessionmaker
import logging
import re

from .core.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()

# Database URL - ensure psycopg driver and set search_path to audion schema
# Coolify returns postgres:// but SQLAlchemy needs postgresql:// or postgresql+psycopg://
def normalize_database_url(url: str) -> str:
    """Normalize database URL to ensure SQLAlchemy compatibility."""
    if not url:
        raise ValueError("Database URL is empty!")
    if url.startswith("postgres://"):
        return url.replace("postgres://", "postgresql+psycopg://", 1)
    elif url.startswith("postgresql://") and "+psycopg" not in url:
        return url.replace("postgresql://", "postgresql+psycopg://", 1)
    elif url.startswith("postgresql+psycopg2://"):
        return url.replace("postgresql+psycopg2://", "postgresql+psycopg://", 1)
    return url

database_url = settings.database_url or ""
if not database_url:
    raise ValueError("DATABASE_URL environment variable is not set!")

logger.info(f"Original database URL: {database_url.split('@')[0] if '@' in database_url else database_url[:50]}@***")
database_url = normalize_database_url(database_url)
logger.info(f"Final database URL: {database_url.split('@')[0]}@***")

# Create engine with search_path set to audion schema
engine = create_engine(
    database_url,
    pool_pre_ping=True,
    pool_size=5,
    max_overflow=10,
    pool_recycle=3600,
    pool_timeout=30,
    echo=settings.app_env == "development",
    future=True,
    connect_args={
        "options": "-c search_path=audion,public"
    },
)

# Set PostgreSQL connection parameters and search_path to audion schema
@event.listens_for(engine, "connect")
def set_postgres_params(dbapi_conn, connection_record):
    """Set PostgreSQL connection parameters and search_path to audion schema."""
    with dbapi_conn.cursor() as cursor:
        cursor.execute("SET statement_timeout = '30s'")
        cursor.execute("SET idle_in_transaction_session_timeout = '60s'")
        # Set search_path to audion schema so all queries use audion.* tables
        cursor.execute("SET search_path = audion, public")
        logger.info("Set search_path to audion schema")

# Also set search_path on checkout to ensure it's always set
@event.listens_for(engine, "checkout")
def set_search_path_on_checkout(dbapi_conn, connection_record, connection_proxy):
    """Set search_path when connection is checked out from pool."""
    with dbapi_conn.cursor() as cursor:
        cursor.execute("SET search_path = audion, public")

SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, future=True)
Base = declarative_base()


@contextmanager
def get_session() -> Session:
    """Context manager for database sessions."""
    session: Session = SessionLocal()
    try:
        # Ensure search_path is set for this session
        session.execute(text("SET search_path = audion, public"))
        yield session
    finally:
        session.close()


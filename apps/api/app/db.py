"""
Database Configuration
SQLAlchemy setup for AUDION database.
Uses PostgreSQL with audion schema.
"""
from __future__ import annotations

from contextlib import contextmanager
from sqlalchemy import create_engine, event
from sqlalchemy.orm import Session, declarative_base, sessionmaker
import logging
import os
import re

from .core.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()

# Database URL - ensure psycopg driver and set search_path to audion schema
# Coolify returns postgres:// but SQLAlchemy needs postgresql:// or postgresql+psycopg://
database_url = settings.database_url or ""
if not database_url:
    raise ValueError("DATABASE_URL environment variable is not set!")

# Log original URL (without password) for debugging
original_url_preview = database_url.split("@")[0] if "@" in database_url else database_url[:50]
logger.info(f"Original database URL: {original_url_preview}@***")

# Convert postgres:// to postgresql+psycopg:// for SQLAlchemy compatibility
# SQLAlchemy 2.0+ requires postgresql:// or postgresql+psycopg://, not postgres://
if database_url.startswith("postgres://"):
    database_url = database_url.replace("postgres://", "postgresql+psycopg://", 1)
    logger.info("Converted postgres:// to postgresql+psycopg://")
elif database_url.startswith("postgresql://") and "+psycopg" not in database_url:
    database_url = database_url.replace("postgresql://", "postgresql+psycopg://", 1)
    logger.info("Converted postgresql:// to postgresql+psycopg://")
elif database_url.startswith("postgresql+psycopg2://"):
    database_url = database_url.replace("postgresql+psycopg2://", "postgresql+psycopg://", 1)
    logger.info("Converted postgresql+psycopg2:// to postgresql+psycopg://")

# Ensure we're using postgresql:// not postgres://
if database_url.startswith("postgres://"):
    raise ValueError(
        f"Database URL still starts with 'postgres://' after conversion! "
        f"This will cause SQLAlchemy errors. URL: {database_url.split('@')[0]}@***"
    )

logger.info(f"Final database URL: {database_url.split('@')[0]}@***")  # Log without password

# Use DATABASE_URL directly - no STORION dependencies
# All STORION-specific logic has been removed for autonomous operation

# Create engine with search_path set to audion schema
# Use connect_args to set search_path at connection time (for psycopg)
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
        # This must be done BEFORE any queries are executed
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
        # Ensure search_path is set to audion schema for this session
        # This is a safety measure in case connect_args didn't work
        from sqlalchemy import text
        session.execute(text("SET search_path = audion, public"))
        yield session
    finally:
        session.close()


def get_db():
    """FastAPI dependency for database sessions."""
    with get_session() as session:
        yield session


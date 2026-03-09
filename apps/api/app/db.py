"""
Database Configuration
SQLAlchemy setup for AUDION database.
Uses PostgreSQL with audion schema.
"""
from __future__ import annotations

from contextlib import contextmanager
from sqlalchemy import create_engine as sqlalchemy_create_engine, event
from sqlalchemy.orm import Session, declarative_base, sessionmaker
import logging

from .core.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()

# Wrapper function to ensure database URL is always normalized before create_engine
def create_engine(url, *args, **kwargs):
    """
    Wrapper around SQLAlchemy's create_engine that ensures postgres:// URLs
    are converted to postgresql+psycopg:// before passing to SQLAlchemy.
    
    This is CRITICAL because Coolify returns postgres:// URLs, but SQLAlchemy 2.0+
    requires postgresql:// or postgresql+psycopg://.
    """
    # CRITICAL: Always normalize the URL, even if it was already normalized
    if not isinstance(url, str):
        raise TypeError(f"Database URL must be a string, got {type(url)}")
    
    if not url:
        raise ValueError("Database URL is empty!")
    
    original_url_for_logging = url.split("@")[0] if "@" in url else url[:50]
    
    # CRITICAL: Convert postgres:// to postgresql+psycopg://
    # This MUST happen before passing to SQLAlchemy, otherwise we get:
    # sqlalchemy.exc.NoSuchModuleError: Can't load plugin: sqlalchemy.dialects:postgres
    if url.startswith("postgres://"):
        logger.critical(f"create_engine wrapper: Converting postgres:// URL! Original: {original_url_for_logging}@***")
        url = url.replace("postgres://", "postgresql+psycopg://", 1)
        logger.critical(f"create_engine wrapper: Converted to: {url.split('@')[0] if '@' in url else url[:50]}@***")
    elif url.startswith("postgresql://") and "+psycopg" not in url:
        logger.info("create_engine wrapper: Converting postgresql:// to postgresql+psycopg://")
        url = url.replace("postgresql://", "postgresql+psycopg://", 1)
    
    # Final safety check - this should NEVER happen after conversion
    if url.startswith("postgres://"):
        raise RuntimeError(
            f"CRITICAL: URL still starts with 'postgres://' after wrapper conversion! "
            f"This should NEVER happen. URL: {original_url_for_logging}@***"
        )
    
    logger.info(f"create_engine wrapper: Calling SQLAlchemy with URL starting with: {url[:30]}...")
    return sqlalchemy_create_engine(url, *args, **kwargs)

# Database URL - ensure psycopg driver and set search_path to audion schema
# Coolify returns postgres:// but SQLAlchemy needs postgresql:// or postgresql+psycopg://
def normalize_database_url(url: str) -> str:
    """
    Normalize database URL to ensure SQLAlchemy compatibility.
    Converts postgres:// to postgresql+psycopg://
    """
    if not url:
        raise ValueError("Database URL is empty!")
    
    original_url = url
    
    # Convert postgres:// to postgresql+psycopg:// for SQLAlchemy compatibility
    # SQLAlchemy 2.0+ requires postgresql:// or postgresql+psycopg://, not postgres://
    if url.startswith("postgres://"):
        url = url.replace("postgres://", "postgresql+psycopg://", 1)
        logger.info("Converted postgres:// to postgresql+psycopg://")
    elif url.startswith("postgresql://") and "+psycopg" not in url:
        url = url.replace("postgresql://", "postgresql+psycopg://", 1)
        logger.info("Converted postgresql:// to postgresql+psycopg://")
    elif url.startswith("postgresql+psycopg2://"):
        url = url.replace("postgresql+psycopg2://", "postgresql+psycopg://", 1)
        logger.info("Converted postgresql+psycopg2:// to postgresql+psycopg://")
    
    # Final validation - ensure we never use postgres://
    if url.startswith("postgres://"):
        error_msg = (
            f"Database URL still starts with 'postgres://' after conversion! "
            f"Original: {original_url.split('@')[0] if '@' in original_url else original_url[:50]}@***, "
            f"Converted: {url.split('@')[0] if '@' in url else url[:50]}@***. "
            f"This will cause SQLAlchemy errors: 'Can't load plugin: sqlalchemy.dialects:postgres'"
        )
        logger.error(error_msg)
        raise ValueError(error_msg)
    
    return url

try:
    database_url = settings.database_url
except Exception as e:
    logger.error(f"Failed to get database_url from settings: {e}")
    raise ValueError("DATABASE_URL environment variable is not set!") from e

if not database_url:
    raise ValueError("DATABASE_URL environment variable is empty or not set!")

# Log original URL (without password) for debugging
original_url_preview = database_url.split("@")[0] if "@" in database_url else database_url[:50]
logger.info(f"Original database URL: {original_url_preview}@***")

# Normalize the database URL - CRITICAL: This must happen before create_engine
database_url = normalize_database_url(database_url)

logger.info(f"Final database URL: {database_url.split('@')[0]}@***")  # Log without password

# CRITICAL: Double-check that normalization worked
# If this check fails, the URL was not properly normalized
if database_url.startswith("postgres://"):
    logger.critical(f"FATAL: Database URL normalization failed! URL still starts with 'postgres://': {original_url_preview}@***")
    # Force re-normalization as last resort
    database_url = normalize_database_url(database_url)
    if database_url.startswith("postgres://"):
        raise RuntimeError(
            f"Database URL normalization completely failed! "
            f"Original: {original_url_preview}@***, "
            f"After normalization: {database_url.split('@')[0] if '@' in database_url else database_url[:50]}@***"
        )

# Use DATABASE_URL directly - no STORION dependencies
# All STORION-specific logic has been removed for autonomous operation

# Create engine with search_path set to audion schema
# Use connect_args to set search_path at connection time (for psycopg)
# CRITICAL: Final check before create_engine - if URL still starts with postgres://, something is very wrong
if database_url.startswith("postgres://"):
    logger.critical("FATAL ERROR: Database URL still starts with 'postgres://' right before create_engine!")
    logger.critical(f"URL value: {database_url.split('@')[0] if '@' in database_url else database_url[:100]}@***")
    logger.critical("This should NEVER happen if normalization worked correctly!")
    # Force one more normalization attempt
    database_url = normalize_database_url(database_url)
    if database_url.startswith("postgres://"):
        raise RuntimeError(
            "CRITICAL: Database URL normalization failed completely! "
            "The URL still starts with 'postgres://' after multiple normalization attempts. "
            "This will cause SQLAlchemy to fail with 'Can't load plugin: sqlalchemy.dialects:postgres'"
        )

logger.info(f"Creating SQLAlchemy engine with URL: {database_url.split('@')[0]}@***")

# ABSOLUTE FINAL CHECK: Print the actual URL string to verify it's correct
# This will help us debug if the URL is somehow being modified
logger.info(f"DEBUG: database_url type: {type(database_url)}, length: {len(database_url)}")
logger.info(f"DEBUG: database_url starts with 'postgres://': {database_url.startswith('postgres://')}")
logger.info(f"DEBUG: database_url starts with 'postgresql': {database_url.startswith('postgresql')}")

# If somehow we still have postgres://, force convert it one more time
if database_url.startswith("postgres://"):
    logger.critical("EMERGENCY: URL still has postgres:// - forcing conversion!")
    database_url = database_url.replace("postgres://", "postgresql+psycopg://", 1)
    logger.critical(f"EMERGENCY: After forced conversion: {database_url.split('@')[0]}@***")

# CRITICAL: Convert URL directly in create_engine call as absolute last resort
# This ensures the URL is ALWAYS normalized, even if something went wrong before
final_url = database_url
if final_url.startswith("postgres://"):
    logger.critical("LAST RESORT: Converting postgres:// in create_engine call!")
    final_url = final_url.replace("postgres://", "postgresql+psycopg://", 1)

logger.info(f"FINAL: About to call create_engine with URL starting with: {final_url[:20]}...")

# Pool sizing: avoid TimeoutError when many concurrent requests need a connection.
# Override via DATABASE_POOL_SIZE, DATABASE_POOL_MAX_OVERFLOW, etc. if needed.
engine = create_engine(
    final_url,
    pool_pre_ping=True,
    pool_size=settings.database_pool_size,
    max_overflow=settings.database_pool_max_overflow,
    pool_recycle=settings.database_pool_recycle_seconds,
    pool_timeout=settings.database_pool_timeout_seconds,
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


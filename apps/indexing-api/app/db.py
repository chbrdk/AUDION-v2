from __future__ import annotations

from contextlib import contextmanager

from sqlalchemy import create_engine
from sqlalchemy.orm import Session, declarative_base, sessionmaker

from .core.config import get_settings

settings = get_settings()

# Database URL - ensure psycopg driver
# Coolify returns postgres:// but SQLAlchemy needs postgresql:// or postgresql+psycopg://
database_url = settings.database_url or ""
if not database_url:
    raise ValueError("DATABASE_URL environment variable is not set!")

# Convert postgres:// to postgresql+psycopg:// for SQLAlchemy compatibility
if database_url.startswith("postgres://"):
    database_url = database_url.replace("postgres://", "postgresql+psycopg://", 1)
elif database_url.startswith("postgresql://") and "+psycopg" not in database_url:
    database_url = database_url.replace("postgresql://", "postgresql+psycopg://", 1)
elif database_url.startswith("postgresql+psycopg2://"):
    database_url = database_url.replace("postgresql+psycopg2://", "postgresql+psycopg://", 1)

engine = create_engine(database_url, pool_pre_ping=True)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)
Base = declarative_base()


@contextmanager
def get_session() -> Session:
    session: Session = SessionLocal()
    try:
        yield session
    finally:
        session.close()


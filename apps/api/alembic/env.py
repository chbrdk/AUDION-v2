from __future__ import annotations

import sys
from pathlib import Path

from alembic import context
from sqlalchemy import engine_from_config, pool

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT / "app") not in sys.path:
    sys.path.append(str(ROOT / "app"))

from app.core.config import get_settings
from app.db import Base  # noqa: E402
from app import models  # noqa: F401,E402  # ensure metadata is loaded

config = context.config
settings = get_settings()

if settings.database_url:
    config.set_main_option("sqlalchemy.url", settings.database_url)

target_metadata = Base.metadata


def run_migrations_offline() -> None:
    context.configure(
        url=settings.database_url,
        target_metadata=target_metadata,
        literal_binds=True,
        compare_type=True,
        dialect_opts={"paramstyle": "named"},
        version_table_schema="audion",  # Store version in audion schema
    )

    with context.begin_transaction():
        # Note: search_path is set in db.py connection handler
        context.run_migrations()


def run_migrations_online() -> None:
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    with connectable.connect() as connection:
        # Set search_path to audion schema before running migrations
        connection.execute("SET search_path = audion, public")
        context.configure(
            connection=connection, 
            target_metadata=target_metadata, 
            compare_type=True,
            version_table_schema="audion",  # Store version in audion schema
        )

        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()



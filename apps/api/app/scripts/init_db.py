"""
Database Initialization Script
Handles schema creation, fresh table setup, and migrations.
"""
import logging
import sys
from sqlalchemy import text
from alembic.config import Config
from alembic import command
from app.db import engine, Base
# CRITICAL: Must import models for Base.metadata.create_all to work!

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def init_db():
    try:
        # 1. Create schema if not exists
        with engine.connect() as conn:
            logger.info("Ensuring schema 'audion' exists...")
            conn.execute(text("CREATE SCHEMA IF NOT EXISTS audion"))
            conn.execute(text("SET search_path = audion, public"))
            conn.commit()
            
            # DEBUG: List all tables in audion schema
            tables = conn.execute(text(
                "SELECT table_name FROM information_schema.tables WHERE table_schema = 'audion'"
            )).fetchall()
            logger.info(f"DEBUG: Tables in 'audion' schema: {[t[0] for t in tables]}")

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
                # CRITICAL: Only run this if document_chunks exists (dependency)
                chunks_check = conn.execute(text(
                    "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'audion' AND table_name = 'document_chunks')"
                ))
                if chunks_check.scalar():
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
                else:
                    logger.info("Skipping target_groups emergency fix because 'document_chunks' table is missing (fresh DB? will use create_all).")
                
                # Check personas.target_group_id column (only if personas table exists)
                personas_check = conn.execute(text(
                    "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'audion' AND table_name = 'personas')"
                ))
                if personas_check.scalar():
                    logger.info("Verifying schema integrity for 'personas.target_group_id'...")
                    p_tg_check = conn.execute(text(
                        "SELECT column_name FROM information_schema.columns "
                        "WHERE table_schema = 'audion' AND table_name = 'personas' AND column_name = 'target_group_id'"
                    ))
                    if not p_tg_check.scalar():
                        logger.warning("CRITICAL: 'target_group_id' missing in 'personas'. Adding column...")
                        # Ensure target_groups exists before adding FK
                        conn.execute(text("ALTER TABLE audion.personas ADD COLUMN IF NOT EXISTS target_group_id UUID REFERENCES audion.target_groups(id) ON DELETE SET NULL"))
                        conn.commit()
                        logger.info("Emergency fix applied: 'personas.target_group_id' added.")

                # Check persona_prompts.template_metadata column (Fix for 500 error)
                prompts_check = conn.execute(text(
                    "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'audion' AND table_name = 'persona_prompts')"
                ))
                if prompts_check.scalar():
                    logger.info("Verifying schema integrity for 'persona_prompts.template_metadata'...")
                    pp_tm_check = conn.execute(text(
                        "SELECT column_name FROM information_schema.columns "
                        "WHERE table_schema = 'audion' AND table_name = 'persona_prompts' AND column_name = 'template_metadata'"
                    ))
                    if not pp_tm_check.scalar():
                        logger.warning("CRITICAL: 'template_metadata' missing in 'persona_prompts'. Adding column...")
                        conn.execute(text("ALTER TABLE audion.persona_prompts ADD COLUMN IF NOT EXISTS template_metadata JSONB"))
                        conn.commit()
                        logger.info("Emergency fix applied: 'persona_prompts.template_metadata' added.")

                # Check users profile columns (company/avatar_url/locale)
                users_check = conn.execute(text(
                    "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'audion' AND table_name = 'users')"
                ))
                if users_check.scalar():
                    logger.info("Verifying schema integrity for 'users' profile fields...")
                    u_company_check = conn.execute(text(
                        "SELECT column_name FROM information_schema.columns "
                        "WHERE table_schema = 'audion' AND table_name = 'users' AND column_name = 'company'"
                    ))
                    if not u_company_check.scalar():
                        logger.warning("CRITICAL: 'company' missing in 'users'. Adding column...")
                        conn.execute(text("ALTER TABLE audion.users ADD COLUMN IF NOT EXISTS company VARCHAR(256)"))
                        conn.commit()
                        logger.info("Emergency fix applied: 'users.company' added.")

                    u_avatar_check = conn.execute(text(
                        "SELECT column_name FROM information_schema.columns "
                        "WHERE table_schema = 'audion' AND table_name = 'users' AND column_name = 'avatar_url'"
                    ))
                    if not u_avatar_check.scalar():
                        logger.warning("CRITICAL: 'avatar_url' missing in 'users'. Adding column...")
                        conn.execute(text("ALTER TABLE audion.users ADD COLUMN IF NOT EXISTS avatar_url VARCHAR(512)"))
                        conn.commit()
                        logger.info("Emergency fix applied: 'users.avatar_url' added.")

                    u_locale_check = conn.execute(text(
                        "SELECT column_name FROM information_schema.columns "
                        "WHERE table_schema = 'audion' AND table_name = 'users' AND column_name = 'locale'"
                    ))
                    if not u_locale_check.scalar():
                        logger.warning("CRITICAL: 'locale' missing in 'users'. Adding column...")
                        conn.execute(text("ALTER TABLE audion.users ADD COLUMN IF NOT EXISTS locale VARCHAR(8)"))
                        conn.commit()
                        logger.info("Emergency fix applied: 'users.locale' added.")

                    u_plexon_check = conn.execute(text(
                        "SELECT column_name FROM information_schema.columns "
                        "WHERE table_schema = 'audion' AND table_name = 'users' AND column_name = 'plexon_user_id'"
                    ))
                    if not u_plexon_check.scalar():
                        logger.warning("CRITICAL: 'plexon_user_id' missing in 'users'. Adding column...")
                        conn.execute(text("ALTER TABLE audion.users ADD COLUMN IF NOT EXISTS plexon_user_id VARCHAR(128)"))
                        conn.commit()
                        logger.info("Emergency fix applied: 'users.plexon_user_id' added.")

                # Check documents.object_key column (Fix for 500 error on upload)
                docs_check = conn.execute(text(
                    "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'audion' AND table_name = 'documents')"
                ))
                if docs_check.scalar():
                    logger.info("Verifying schema integrity for 'documents.object_key'...")
                    d_ok_check = conn.execute(text(
                        "SELECT column_name FROM information_schema.columns "
                        "WHERE table_schema = 'audion' AND table_name = 'documents' AND column_name = 'object_key'"
                    ))
                    if not d_ok_check.scalar():
                        logger.warning("CRITICAL: 'object_key' missing in 'documents'. Adding column...")
                        conn.execute(text("ALTER TABLE audion.documents ADD COLUMN IF NOT EXISTS object_key VARCHAR(512)"))
                        conn.execute(text("UPDATE audion.documents SET object_key = file_path WHERE object_key IS NULL")) # Backfill
                        conn.commit()
                        logger.info("Emergency fix applied: 'documents.object_key' added.")

                    # Check for uploaded_by
                    d_ub_check = conn.execute(text(
                        "SELECT column_name FROM information_schema.columns "
                        "WHERE table_schema = 'audion' AND table_name = 'documents' AND column_name = 'uploaded_by'"
                    ))
                    if not d_ub_check.scalar():
                        logger.warning("CRITICAL: 'uploaded_by' missing in 'documents'. Adding column...")
                        conn.execute(text("ALTER TABLE audion.documents ADD COLUMN IF NOT EXISTS uploaded_by VARCHAR(128)"))
                        conn.commit()
                        logger.info("Emergency fix applied: 'documents.uploaded_by' added.")

                    # Check for insight_summary
                    d_is_check = conn.execute(text(
                        "SELECT column_name FROM information_schema.columns "
                        "WHERE table_schema = 'audion' AND table_name = 'documents' AND column_name = 'insight_summary'"
                    ))
                    if not d_is_check.scalar():
                        logger.warning("CRITICAL: 'insight_summary' missing in 'documents'. Adding column...")
                        conn.execute(text("ALTER TABLE audion.documents ADD COLUMN IF NOT EXISTS insight_summary TEXT"))
                        conn.commit()
                        logger.info("Emergency fix applied: 'documents.insight_summary' added.")

                    # Check for target_group_id (CRITICAL for upload)
                    d_tg_check = conn.execute(text(
                        "SELECT column_name FROM information_schema.columns "
                        "WHERE table_schema = 'audion' AND table_name = 'documents' AND column_name = 'target_group_id'"
                    ))
                    if not d_tg_check.scalar():
                        logger.warning("CRITICAL: 'target_group_id' missing in 'documents'. Adding column...")
                        conn.execute(text("ALTER TABLE audion.documents ADD COLUMN IF NOT EXISTS target_group_id UUID REFERENCES audion.target_groups(id) ON DELETE SET NULL"))
                        conn.commit()
                        logger.info("Emergency fix applied: 'documents.target_group_id' added.")

                    # Check for persona_id
                    d_p_check = conn.execute(text(
                        "SELECT column_name FROM information_schema.columns "
                        "WHERE table_schema = 'audion' AND table_name = 'documents' AND column_name = 'persona_id'"
                    ))
                    if not d_p_check.scalar():
                        logger.warning("CRITICAL: 'persona_id' missing in 'documents'. Adding column...")
                        conn.execute(text("ALTER TABLE audion.documents ADD COLUMN IF NOT EXISTS persona_id UUID REFERENCES audion.personas(id) ON DELETE SET NULL"))
                        conn.commit()
                        logger.info("Emergency fix applied: 'documents.persona_id' added.")

                # Check for processing_jobs table (Fix for 500 error on upload)
                pj_check = conn.execute(text(
                    "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'audion' AND table_name = 'processing_jobs')"
                ))
                if not pj_check.scalar():
                    logger.warning("CRITICAL: 'processing_jobs' table missing. Creating table...")
                    # Manually create table to avoid complex metadata binding issues inside migration script
                    conn.execute(text("""
                        CREATE TABLE audion.processing_jobs (
                            id UUID PRIMARY KEY,
                            document_id UUID NOT NULL REFERENCES audion.documents(id),
                            status VARCHAR(32) NOT NULL,
                            progress FLOAT NOT NULL DEFAULT 0.0,
                            error TEXT,
                            created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT now(),
                            updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT now()
                        )
                    """))
                    conn.commit()
                    logger.info("Emergency fix applied: 'processing_jobs' table created.")

                # Check for document_status enum values (Fix for invalid input value: "pending")
                try:
                    # Attempt to add 'pending' to the enum type.
                    # This command will fail if 'pending' already exists, so we wrap it in a transaction block or just try/except
                    # but ALTER TYPE ADD VALUE IF NOT EXISTS is only supported in newer Postgres (12+).
                    # We can query pg_enum to check first.
                    enum_check = conn.execute(text(
                        "SELECT 1 FROM pg_enum JOIN pg_type ON pg_enum.enumtypid = pg_type.oid "
                        "WHERE pg_type.typname = 'document_status' AND pg_enum.enumlabel = 'pending'"
                    ))
                    if not enum_check.scalar():
                         logger.warning("CRITICAL: 'pending' missing from 'document_status' enum. Adding value...")
                         # We must run this outside a transaction block usually, but SQLAlchemy execute might handle it.
                         # Actually ALTER TYPE ADD VALUE cannot run inside a transaction block that has other commands?
                         # "ALTER TYPE ... ADD VALUE ... cannot run inside a transaction block" is a common error.
                         # However, we are in `with engine.connect() as conn`.
                         # We need to commit current transaction first.
                         conn.commit()
                         conn.execute(text("ALTER TYPE audion.document_status ADD VALUE 'pending'"))
                         conn.commit()
                         logger.info("Emergency fix applied: 'pending' added to 'document_status'.")
                except Exception as e:
                     logger.warning(f"Could not patch document_status enum (might already exist or permission issue): {e}")

        except Exception as e:
            logger.error(f"Emergency fix failed (ignoring to proceed with normal init): {e}")

        # 2c. ORM columns on projects / target_groups when migrations were not applied (e.g. legacy stamp
        # without upgrade). SQLAlchemy SELECTs these on every list — must exist before Alembic runs.
        # Mirrors: 20260309_company_ctx, 20260418_project_tg_bilingual_de, 20260418_proj_tg_pub_stat,
        # 20260421_chk_proj_id (checkion_project_id).
        try:
            with engine.connect() as conn:
                proj_tbl = conn.execute(
                    text(
                        "SELECT EXISTS (SELECT 1 FROM information_schema.tables "
                        "WHERE table_schema = 'audion' AND table_name = 'projects')"
                    )
                ).scalar()
                if proj_tbl:
                    conn.execute(
                        text("ALTER TABLE audion.projects ADD COLUMN IF NOT EXISTS description TEXT NULL")
                    )
                    conn.execute(
                        text("ALTER TABLE audion.projects ADD COLUMN IF NOT EXISTS company_context TEXT NULL")
                    )
                    conn.execute(
                        text("ALTER TABLE audion.projects ADD COLUMN IF NOT EXISTS name_de VARCHAR(128) NULL")
                    )
                    conn.execute(
                        text("ALTER TABLE audion.projects ADD COLUMN IF NOT EXISTS description_de TEXT NULL")
                    )
                    conn.execute(
                        text(
                            "ALTER TABLE audion.projects ADD COLUMN IF NOT EXISTS company_context_de TEXT NULL"
                        )
                    )
                    if not conn.execute(
                        text(
                            "SELECT 1 FROM information_schema.columns "
                            "WHERE table_schema = 'audion' AND table_name = 'projects' AND column_name = 'status'"
                        )
                    ).scalar():
                        conn.execute(
                            text(
                                "ALTER TABLE audion.projects ADD COLUMN status VARCHAR(32) "
                                "NOT NULL DEFAULT 'draft'"
                            )
                        )
                        conn.execute(text("ALTER TABLE audion.projects ALTER COLUMN status DROP DEFAULT"))

                    conn.execute(
                        text(
                            "ALTER TABLE audion.projects ADD COLUMN IF NOT EXISTS checkion_project_id VARCHAR(40) NULL"
                        )
                    )

                tg_tbl = conn.execute(
                    text(
                        "SELECT EXISTS (SELECT 1 FROM information_schema.tables "
                        "WHERE table_schema = 'audion' AND table_name = 'target_groups')"
                    )
                ).scalar()
                if tg_tbl:
                    conn.execute(
                        text("ALTER TABLE audion.target_groups ADD COLUMN IF NOT EXISTS name_de VARCHAR(128) NULL")
                    )
                    conn.execute(
                        text(
                            "ALTER TABLE audion.target_groups ADD COLUMN IF NOT EXISTS segment_de VARCHAR(128) NULL"
                        )
                    )
                    conn.execute(
                        text(
                            "ALTER TABLE audion.target_groups ADD COLUMN IF NOT EXISTS description_de TEXT NULL"
                        )
                    )
                    if not conn.execute(
                        text(
                            "SELECT 1 FROM information_schema.columns "
                            "WHERE table_schema = 'audion' AND table_name = 'target_groups' "
                            "AND column_name = 'status'"
                        )
                    ).scalar():
                        conn.execute(
                            text(
                                "ALTER TABLE audion.target_groups ADD COLUMN status VARCHAR(32) "
                                "NOT NULL DEFAULT 'draft'"
                            )
                        )
                        conn.execute(text("ALTER TABLE audion.target_groups ALTER COLUMN status DROP DEFAULT"))

                conn.commit()
                logger.info(
                    "Ensured projects/target_groups ORM columns (bilingual DE mirrors, context, publication status, checkion_project_id)."
                )
        except Exception as e:
            logger.warning(f"Projects/target_groups ORM column ensure failed: {e}")

        # 2d. Persona bilingual ORM columns when 20260417_persona_bilingual_de was not applied (legacy stamp).
        try:
            with engine.connect() as conn:
                per_tbl = conn.execute(
                    text(
                        "SELECT EXISTS (SELECT 1 FROM information_schema.tables "
                        "WHERE table_schema = 'audion' AND table_name = 'personas')"
                    )
                ).scalar()
                if per_tbl:
                    conn.execute(
                        text("ALTER TABLE audion.personas ADD COLUMN IF NOT EXISTS headline_de TEXT NULL")
                    )
                    conn.execute(
                        text("ALTER TABLE audion.personas ADD COLUMN IF NOT EXISTS profile_de JSONB NULL")
                    )
                    conn.execute(
                        text("ALTER TABLE audion.personas ADD COLUMN IF NOT EXISTS profile_card_de JSONB NULL")
                    )
                pp_tbl = conn.execute(
                    text(
                        "SELECT EXISTS (SELECT 1 FROM information_schema.tables "
                        "WHERE table_schema = 'audion' AND table_name = 'persona_prompts')"
                    )
                ).scalar()
                if pp_tbl:
                    conn.execute(
                        text(
                            "ALTER TABLE audion.persona_prompts ADD COLUMN IF NOT EXISTS system_prompt_de TEXT NULL"
                        )
                    )
                conn.commit()
                logger.info(
                    "Ensured personas/persona_prompts bilingual DE columns (headline_de, profile_de, …)."
                )
        except Exception as e:
            logger.warning(f"Persona bilingual ORM column ensure failed: {e}")

        # 3. Migration Logic
        # Check if core tables exist. If so, we assume the schema is initialized.
        with engine.connect() as conn:
            personas_exists = conn.execute(text(
                "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'audion' AND table_name = 'personas')"
            )).scalar()
            
            # Check if alembic version table exists
            alembic_exists = conn.execute(text(
                "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'audion' AND table_name = 'alembic_version')"
            )).scalar()

        alembic_cfg = Config("alembic.ini")
        ran_create_all = False
        # Legacy DBs had app tables but no audion.alembic_version; we stamp to head without running
        # migrations. A following `upgrade head` would replay the full chain from base and collide with
        # existing enums/tables — skip upgrade in that case (emergency DDL + app handle drift).
        stamped_legacy_without_alembic = False

        if not personas_exists:
            logger.info("Fresh database detected (no personas table). Creating all tables from models...")
            # Use the engine to create all tables defined in Base.metadata
            Base.metadata.create_all(bind=engine)
            
            logger.info("Stamping database with current migration version...")
            command.stamp(alembic_cfg, "head")
            ran_create_all = True
        else:
            logger.info("Existing database detected.")
            if not alembic_exists:
                # Legacy DB: no version table. Stamp declares current line; emergency DDL below may add
                # columns missing from older images. A final `upgrade head` (after ensures) is idempotent.
                logger.info("No alembic_version table found. Stamping to head to capture current state...")
                command.stamp(alembic_cfg, "head")
                stamped_legacy_without_alembic = True
            else:
                logger.info("Alembic version table found.")

        # Coolify / unattended deploys: reconcile to head when alembic already tracks revisions.
        # Skip when we only stamped a legacy DB (would replay migrations from base → duplicate types/tables).
        # Fresh DBs used create_all + stamp; running upgrade would collide with create_all.
        if not ran_create_all and not stamped_legacy_without_alembic:
            try:
                logger.info("Running alembic upgrade head (idempotent)...")
                command.upgrade(alembic_cfg, "head")
            except Exception as e:
                logger.error(f"Alembic upgrade head failed: {e}")
                raise
        elif stamped_legacy_without_alembic:
            logger.info(
                "Skipping alembic upgrade head after legacy stamp (schema already matches production; "
                "replay would conflict). Use scripts/coolify-migrate.sh if you intentionally reset version."
            )

        logger.info("Database initialization completed successfully.")

    except Exception as e:
        logger.error(f"Database initialization failed: {e}")
        sys.exit(1)

if __name__ == "__main__":
    init_db()

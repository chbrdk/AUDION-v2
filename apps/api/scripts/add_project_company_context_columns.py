#!/usr/bin/env python3
"""
One-off script to add description and company_context to audion.projects.
Use if alembic upgrade head is not possible (e.g. version table issues).

Run from API container (e.g. Coolify):
  cd /app/apps/api && python -c "
  from app.db import get_session
  from sqlalchemy import text
  with get_session() as s:
      s.execute(text('ALTER TABLE audion.projects ADD COLUMN IF NOT EXISTS description TEXT NULL'))
      s.execute(text('ALTER TABLE audion.projects ADD COLUMN IF NOT EXISTS company_context TEXT NULL'))
      s.commit()
  print('Done.')
  "
"""
from __future__ import annotations

import sys
import os

# Ensure app is importable when run as script from apps/api
if __name__ == "__main__":
    sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    from app.db import get_session
    from sqlalchemy import text

    with get_session() as session:
        session.execute(text("ALTER TABLE audion.projects ADD COLUMN IF NOT EXISTS description TEXT NULL"))
        session.execute(text("ALTER TABLE audion.projects ADD COLUMN IF NOT EXISTS company_context TEXT NULL"))
        session.commit()
    print("Added description and company_context to audion.projects", flush=True)

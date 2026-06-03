# Target group lifecycle (active / archived)

Target groups no longer use **draft / published**. Publication status applies only to **projects**.

## Status values

| Value | Meaning |
|-------|---------|
| `active` | Default. Visible in library lists. |
| `archived` | Hidden from default library; shown when “Show archived” is enabled. |

Legacy DB values `draft` and `published` are coerced to `active` on read and normalized to `active` on write.

## Code paths

- **API:** `apps/api/app/services/target_group_lifecycle.py`
- **Migration:** `apps/api/alembic/versions/20260603_target_group_lifecycle_status.py`
- **Web helpers:** `apps/web/lib/target-group-lifecycle.ts`
- **List filter:** `include_archived=true` query param on `GET /target-groups`
- **Admin UI:** Archive / Restore in `msqdx-glass-target-group-admin-panel.tsx`
- **Library UI:** “Show archived” in `msqdx-glass-target-groups-overview.tsx`

## Related

- Projects still use draft/published — see `knowledge/project-target-group-publication-status.md` (target group section is obsolete for publication).

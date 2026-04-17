# Project & target group publication status

- **DB**: `audion.projects.status` and `audion.target_groups.status`, `String(32)`, values `draft` | `published`, default `draft` (Alembic revision `20260418_proj_tg_pub_stat`, file `20260418_project_target_group_publication_status.py`).
- **Validation**: `apps/api/app/services/resource_bilingual_utils.py` — `validate_project_bilingual_publish` / `validate_target_group_bilingual_publish` when status is `published` (DE mirrors required where EN text is set). `normalize_publication_status` coerces input.
- **API**: Schemas expose `status`; create/update paths run validation before commit. Target group logic lives in `TargetGroupService` (`target_group_store.py`).

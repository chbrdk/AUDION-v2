# Coolify: Deploy schlägt fehl — `api` unhealthy / `dependency failed to start`

Symptom in den Deploy-Logs:

```text
Container api-… Waiting
…
Container api-… Error
dependency failed to start: container api-… is unhealthy
```

`web` (Next.js) wartet in `docker-compose.yml` auf `api: condition: service_healthy`. Wenn der **API-Container beendet wird** (Exit Code ≠ 0) oder der **Healthcheck** dauerhaft fehlschlägt, bricht `docker compose up -d` ab.

## 1. Sofort: Logs der API lesen

Auf dem Ziel-Server (oder in Coolify → Application → **Logs** des `api`-Services):

```bash
docker logs <name-des-api-containers> 2>&1 | tail -n 200
```

Suche nach der **letzten** Phase aus `apps/api/start.sh` (jede Zeile ist mit `[audion-api/start.sh]` markiert):

1. `starting uvicorn` → `waiting for GET /health` → Uvicorn läuft.
2. `waiting for PostgreSQL` → Verbindung zu `DATABASE_URL`.
3. `running Alembic upgrade head` → Migrationen.
4. `running init_db.py` / `seed_prompts.py` → Schema / Seeds.

**Die letzte ausgeführte Phase** zeigt, wo es hängen blieb bzw. welcher Schritt mit Fehler beendet wurde.

## 2. Typische Ursachen

| Phase | Typische Ursache |
|--------|------------------|
| Vor / während `/health` | Uvicorn startet nicht (Importfehler, fehlende Pflicht-Env wie `DATABASE_URL` / `REDIS_URL` / `AUTH_JWT_SECRET` beim Laden von `app.core.config`). |
| PostgreSQL-Wartezeit | `DATABASE_URL` falsch, DB nicht erreichbar (Firewall, falscher Host/Port), TLS/SSL-Mismatch. |
| Alembic | Migration schlägt fehl (konkurrierende Revision, fehlende Extension, fehlende Rechte). |
| `init_db.py` | Schema-Konflikt, fehlende Tabellen, DB-User ohne DDL-Rechte. |

**Hinweis Compose:** `api` setzt `NEO4J_PASSWORD=${GRAPH_DB_PASSWORD}`. In Coolify muss **`GRAPH_DB_PASSWORD`** (oder das, was ihr dort verwendet) gesetzt sein, sonst ist Neo4j-Passwort leer — kann je nach Codepfad später zu Fehlern führen.

## 3. Healthcheck (Docker)

Der Healthcheck ruft `GET http://localhost:8000/health` auf. Diese Route ist absichtlich **ohne** DB-Zugriff, damit sie schon läuft, während im Hintergrund Migrationen laufen.

- **`start_period`** (im Repo: 240s): In dieser Zeit werden Healthcheck-Fehler nicht sofort als „unhealthy“ gewertet; wenn der Container aber **crasht**, hilft das nicht.
- Wenn Migrationen **sehr** lange dauern, kann `start_period` / `retries` in `docker-compose.yml` weiter erhöht werden.

## 4. Env-Timeouts (optional)

In den Environment Variables der **API**-App (Coolify):

| Variable | Bedeutung | Default |
|----------|-----------|---------|
| `API_HEALTHWAIT_TIMEOUT_SECONDS` | Warten auf erreichbares `/health` nach Uvicorn-Start | `120` |
| `DB_WAIT_TIMEOUT_SECONDS` | Warten auf `SELECT 1` gegen Postgres | `60` |
| `DB_WAIT_INTERVAL_SECONDS` | Pause zwischen Versuchen | `2` |

Bei langsamer Managed-DB: `DB_WAIT_TIMEOUT_SECONDS=120` setzen und erneut deployen.

## 5. Alembic: `version_num` VARCHAR(32)

Die Tabelle `audion.alembic_version` nutzt `version_num VARCHAR(32)`. **Jede** `revision = "…"` in `apps/api/alembic/versions/*.py` darf daher **höchstens 32 Zeichen** haben (siehe auch `tests/test_alembic_revision_id_lengths.py`). Längere IDs führen zu `StringDataRightTruncation` beim `UPDATE audion.alembic_version …`.

## 6. Kurzfassung

1. **`docker logs` des `api`-Containers** — letzte `[audion-api/start.sh]`-Zeile + Python-Traceback lesen.  
2. **`DATABASE_URL`, `REDIS_URL`, `AUTH_JWT_SECRET`** in Coolify prüfen (Pflicht für die API).  
3. **Postgres** von einem Hilfscontainer aus mit derselben URL testen.  
4. Bei **Alembic-Fehlern** Migration und DB-Stand abgleichen (ggf. manuell `alembic upgrade head` in einer Admin-Shell).

Siehe auch: `knowledge/troubleshooting-503-auth-me.md` (wenn die **Web**-App die API nicht erreicht — anderes Problem als „api unhealthy beim Deploy“).

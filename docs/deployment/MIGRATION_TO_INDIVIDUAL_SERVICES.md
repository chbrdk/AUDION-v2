# Migration: Docker Compose → Einzelne Services

Diese Anleitung zeigt, wie du alle Services von einem Docker Compose Deployment zu einzelnen Services in Coolify migrierst.

## Übersicht

**Zu migrierende Services:**
1. `web` - Next.js Frontend
2. `api` - FastAPI Backend
3. `chat-api` - FastAPI Chat Service
4. `indexing-api` - FastAPI Document Processing
5. `celery-worker` - Background Jobs
6. `celery-beat` - Scheduled Tasks

**Bereits als Database Resources:**
- ✅ PostgreSQL
- ✅ Redis

**Als Container Services (optional):**
- `qdrant` - Vector Database (kann als Container Service bleiben oder als Database Resource)
- `neo4j` - Graph Database (kann als Container Service bleiben oder als Database Resource)

---

## Vorbereitung

### Schritt 1: Environment Variables sammeln

Sammle alle Environment Variables aus deinem aktuellen Docker Compose Deployment:

**Gemeinsame Variables:**
- `DATABASE_URL` - PostgreSQL Connection String
- `REDIS_URL` - Redis Connection String
- `QDRANT_URL` - Qdrant URL (z.B. `http://qdrant:6333`)
- `NEO4J_URI` - Neo4j URI (z.B. `bolt://neo4j:7687`)
- `NEO4J_USER` - Neo4j Username (z.B. `neo4j`)
- `NEO4J_PASSWORD` - Neo4j Password
- `OPENAI_API_KEY` - OpenAI API Key
- `CLAUDE_API_KEY` - Claude API Key (optional)
- `APP_ENV=production`

**Service-spezifische Variables:**
- `web`: `NEXT_PUBLIC_BASE_PATH`, `NEXT_PUBLIC_PERSONA_BACKEND_URL`, `NEXT_PUBLIC_CHAT_API_URL`
- `api`: Alle gemeinsamen + keine zusätzlichen
- `chat-api`: Alle gemeinsamen + `INDEXING_API_URL`
- `indexing-api`: Alle gemeinsamen + keine zusätzlichen
- `celery-worker`: Alle gemeinsamen + keine zusätzlichen
- `celery-beat`: Alle gemeinsamen + keine zusätzlichen

### Schritt 2: Container-Namen für Database Resources notieren

Notiere die generierten Container-Namen für:
- PostgreSQL: `y4cos8wkk0sg0k88sgoscwso` (Beispiel)
- Redis: `xgc8okk8gskock08wskwkwks` (Beispiel)

Diese findest du in den Database Resources unter "Connection Details" oder "Internal URL".

---

## Migration: Service für Service

### Service 1: Web (Next.js Frontend)

#### In Coolify:

1. **Neue Application erstellen:**
   - Gehe zu **Applications** → **New Application**
   - **Name**: `audion-web`
   - **Build Pack**: `Dockerfile`
   - **Source**: GitHub Repository (AUDION-v2)
   - **Branch**: `main`

2. **Dockerfile konfigurieren:**
   - **Dockerfile Path**: `apps/web/Dockerfile`
   - **Build Context**: Repository Root (`.`)
   - **Build Arguments**:
     - `RUN_WEB_BUILD=true`

3. **Ports:**
   - **Port**: `3000`

4. **Environment Variables:**
   ```
   NODE_ENV=production
   NEXT_PUBLIC_BASE_PATH=/audion
   NEXT_PUBLIC_PERSONA_BACKEND_URL=http://audion-api:8000
   NEXT_PUBLIC_CHAT_API_URL=http://audion-chat-api:8001
   NEXT_PERSONA_BACKEND_INTERNAL_URL=http://audion-api:8000
   ```

5. **Network:**
   - Gehe zu **Settings** → **Advanced**
   - Aktiviere **"Connect To Predefined Network"**

6. **Health Check:**
   - **Path**: `/api/health`
   - **Port**: `3000`
   - **Interval**: `30s`
   - **Timeout**: `10s`
   - **Retries**: `3`
   - **Start Period**: `60s`

7. **Deploy:**
   - Klicke auf **"Save"** und dann **"Deploy"**

---

### Service 2: API (FastAPI Backend)

#### In Coolify:

1. **Neue Application erstellen:**
   - Gehe zu **Applications** → **New Application**
   - **Name**: `audion-api`
   - **Build Pack**: `Dockerfile`
   - **Source**: GitHub Repository (AUDION-v2)
   - **Branch**: `main`

2. **Dockerfile konfigurieren:**
   - **Dockerfile Path**: `apps/api/Dockerfile`
   - **Build Context**: Repository Root (`.`)

3. **Ports:**
   - **Port**: `8000`

4. **Environment Variables:**
   ```
   DATABASE_URL=postgres://postgres:PASSWORD@y4cos8wkk0sg0k88sgoscwso:5432/audion
   REDIS_URL=redis://default:PASSWORD@xgc8okk8gskock08wskwkwks:6379/0
   QDRANT_URL=http://audion-qdrant:6333
   NEO4J_URI=bolt://audion-neo4j:7687
   NEO4J_USER=neo4j
   NEO4J_PASSWORD=dein-neo4j-password
   OPENAI_API_KEY=dein-openai-key
   CLAUDE_API_KEY=dein-claude-key
   APP_ENV=production
   ```

   **WICHTIG**: 
   - Ersetze `PASSWORD` mit den tatsächlichen Passwörtern
   - Ersetze die Container-Namen mit den tatsächlichen Namen aus deinen Database Resources
   - `DATABASE_URL` muss `postgresql+psycopg://` sein (wird automatisch konvertiert im Code)

5. **Network:**
   - Gehe zu **Settings** → **Advanced**
   - Aktiviere **"Connect To Predefined Network"**

6. **Health Check:**
   - **Path**: `/health`
   - **Port**: `8000`
   - **Interval**: `30s`
   - **Timeout**: `10s`
   - **Retries**: `3`
   - **Start Period**: `60s`

7. **Deploy:**
   - Klicke auf **"Save"** und dann **"Deploy"**

---

### Service 3: Chat API (FastAPI Chat Service)

#### In Coolify:

1. **Neue Application erstellen:**
   - Gehe zu **Applications** → **New Application**
   - **Name**: `audion-chat-api`
   - **Build Pack**: `Dockerfile`
   - **Source**: GitHub Repository (AUDION-v2)
   - **Branch**: `main`

2. **Dockerfile konfigurieren:**
   - **Dockerfile Path**: `apps/chat-api/Dockerfile`
   - **Build Context**: Repository Root (`.`)

3. **Ports:**
   - **Port**: `8001`

4. **Environment Variables:**
   ```
   DATABASE_URL=postgres://postgres:PASSWORD@y4cos8wkk0sg0k88sgoscwso:5432/audion
   QDRANT_URL=http://audion-qdrant:6333
   NEO4J_URI=bolt://audion-neo4j:7687
   NEO4J_USER=neo4j
   NEO4J_PASSWORD=dein-neo4j-password
   OPENAI_API_KEY=dein-openai-key
   INDEXING_API_URL=http://audion-indexing-api:8000
   APP_ENV=production
   ```

5. **Network:**
   - Gehe zu **Settings** → **Advanced**
   - Aktiviere **"Connect To Predefined Network"**

6. **Health Check:**
   - **Path**: `/health`
   - **Port**: `8001`
   - **Interval**: `30s`
   - **Timeout**: `10s`
   - **Retries**: `3`
   - **Start Period**: `60s`

7. **Deploy:**
   - Klicke auf **"Save"** und dann **"Deploy"**

---

### Service 4: Indexing API (FastAPI Document Processing)

#### In Coolify:

1. **Neue Application erstellen:**
   - Gehe zu **Applications** → **New Application**
   - **Name**: `audion-indexing-api`
   - **Build Pack**: `Dockerfile`
   - **Source**: GitHub Repository (AUDION-v2)
   - **Branch**: `main`

2. **Dockerfile konfigurieren:**
   - **Dockerfile Path**: `apps/indexing-api/Dockerfile`
   - **Build Context**: Repository Root (`.`)

3. **Ports:**
   - **Port**: `8000` (intern, kein externer Port nötig)

4. **Environment Variables:**
   ```
   DATABASE_URL=postgres://postgres:PASSWORD@y4cos8wkk0sg0k88sgoscwso:5432/audion
   QDRANT_URL=http://audion-qdrant:6333
   APP_ENV=production
   ```

5. **Network:**
   - Gehe zu **Settings** → **Advanced**
   - Aktiviere **"Connect To Predefined Network"**

6. **Health Check:**
   - **Path**: `/health`
   - **Port**: `8000`
   - **Interval**: `30s`
   - **Timeout**: `10s`
   - **Retries**: `3`
   - **Start Period**: `60s`

7. **Deploy:**
   - Klicke auf **"Save"** und dann **"Deploy"**

---

### Service 5: Celery Worker (Background Jobs)

#### In Coolify:

1. **Neue Application erstellen:**
   - Gehe zu **Applications** → **New Application**
   - **Name**: `audion-celery-worker`
   - **Build Pack**: `Dockerfile`
   - **Source**: GitHub Repository (AUDION-v2)
   - **Branch**: `main`

2. **Dockerfile konfigurieren:**
   - **Dockerfile Path**: `apps/api/Dockerfile` (nutzt dasselbe Dockerfile wie API)
   - **Build Context**: Repository Root (`.`)

3. **Command überschreiben:**
   - Gehe zu **Settings** → **Advanced**
   - **Command**: `celery -A app.celery_app worker --loglevel=info --concurrency=2`

4. **Ports:**
   - Keine Ports nötig (intern)

5. **Environment Variables:**
   ```
   DATABASE_URL=postgres://postgres:PASSWORD@y4cos8wkk0sg0k88sgoscwso:5432/audion
   REDIS_URL=redis://default:PASSWORD@xgc8okk8gskock08wskwkwks:6379/0
   QDRANT_URL=http://audion-qdrant:6333
   NEO4J_URI=bolt://audion-neo4j:7687
   NEO4J_USER=neo4j
   NEO4J_PASSWORD=dein-neo4j-password
   OPENAI_API_KEY=dein-openai-key
   CLAUDE_API_KEY=dein-claude-key
   APP_ENV=production
   ```

6. **Network:**
   - Gehe zu **Settings** → **Advanced**
   - Aktiviere **"Connect To Predefined Network"**

7. **Health Check:**
   - **Deaktiviert** (Celery Worker hat keinen HTTP Endpoint)

8. **Deploy:**
   - Klicke auf **"Save"** und dann **"Deploy"**

9. **Skalierung (optional):**
   - Du kannst mehrere Instanzen dieses Services erstellen für bessere Performance
   - Jede Instanz verarbeitet Jobs aus der gleichen Redis Queue

---

### Service 6: Celery Beat (Scheduled Tasks)

#### In Coolify:

1. **Neue Application erstellen:**
   - Gehe zu **Applications** → **New Application**
   - **Name**: `audion-celery-beat`
   - **Build Pack**: `Dockerfile`
   - **Source**: GitHub Repository (AUDION-v2)
   - **Branch**: `main`

2. **Dockerfile konfigurieren:**
   - **Dockerfile Path**: `apps/api/Dockerfile` (nutzt dasselbe Dockerfile wie API)
   - **Build Context**: Repository Root (`.`)

3. **Command überschreiben:**
   - Gehe zu **Settings** → **Advanced**
   - **Command**: `celery -A app.celery_app beat --loglevel=info`

4. **Ports:**
   - Keine Ports nötig (intern)

5. **Environment Variables:**
   ```
   DATABASE_URL=postgres://postgres:PASSWORD@y4cos8wkk0sg0k88sgoscwso:5432/audion
   REDIS_URL=redis://default:PASSWORD@xgc8okk8gskock08wskwkwks:6379/0
   APP_ENV=production
   ```

6. **Network:**
   - Gehe zu **Settings** → **Advanced**
   - Aktiviere **"Connect To Predefined Network"**

7. **Health Check:**
   - **Deaktiviert** (Celery Beat hat keinen HTTP Endpoint)

8. **Deploy:**
   - Klicke auf **"Save"** und dann **"Deploy"**

9. **WICHTIG:**
   - **Nur 1 Instanz** von Celery Beat sollte laufen!
   - Mehrere Instanzen würden zu doppelten Scheduled Tasks führen

---

## Service-Namen für Inter-Service-Kommunikation

**WICHTIG**: Die Service-Namen in den Environment Variables müssen mit den **Application-Namen** in Coolify übereinstimmen!

**Beispiel:**
- Wenn dein Service `audion-api` heißt, verwende `http://audion-api:8000`
- Wenn dein Service `audion-chat-api` heißt, verwende `http://audion-chat-api:8001`

Coolify erstellt automatisch DNS-Einträge für jeden Service basierend auf dem Application-Namen.

---

## Qdrant und Neo4j

### Option A: Als Container Services (behalten)

Falls du Qdrant und Neo4j als Container Services behalten willst:

1. **Qdrant Container Service:**
   - Name: `audion-qdrant`
   - Image: `qdrant/qdrant:v1.11.3`
   - Ports: `6333`, `6334`
   - Network: "Connect To Predefined Network"

2. **Neo4j Container Service:**
   - Name: `audion-neo4j`
   - Image: `neo4j:5.22.0`
   - Ports: `7474`, `7687`
   - Environment Variables:
     ```
     NEO4J_AUTH=neo4j/dein-password
     NEO4J_PLUGINS=["apoc"]
     NEO4J_server_config_strict_validation_enabled=false
     ```
   - Network: "Connect To Predefined Network"

### Option B: Als Database Resources (empfohlen)

Falls du Qdrant und Neo4j als Database Resources erstellen willst (ähnlich wie PostgreSQL/Redis):

1. **Qdrant Database Resource:**
   - Gehe zu **Resources** → **Database** → **New Database**
   - Wähle **Qdrant** (falls verfügbar)
   - Oder erstelle als Container Service

2. **Neo4j Database Resource:**
   - Gehe zu **Resources** → **Database** → **New Database**
   - Wähle **Neo4j** (falls verfügbar)
   - Oder erstelle als Container Service

---

## Nach der Migration

### Schritt 1: Alle Services testen

1. Prüfe die Logs jedes Services
2. Prüfe, ob Health Checks erfolgreich sind
3. Teste die API-Endpunkte
4. Teste die Frontend-Anwendung

### Schritt 2: Docker Compose Deployment löschen (optional)

Falls alles funktioniert:
1. Gehe zu deinem alten Docker Compose Deployment
2. **Stoppe** den Service
3. **Lösche** das Deployment (optional, für lokale Entwicklung behalten)

### Schritt 3: Monitoring einrichten

1. Prüfe regelmäßig die Logs jedes Services
2. Prüfe die Health Checks
3. Prüfe die Resource Usage (CPU, Memory)

---

## Troubleshooting

### Problem: Services können sich nicht erreichen

**Lösung:**
- Prüfe, dass "Connect To Predefined Network" für alle Services aktiviert ist
- Prüfe, dass die Service-Namen in Environment Variables korrekt sind
- Prüfe, dass die Ports korrekt sind

### Problem: Database Connection Fehler

**Lösung:**
- Prüfe, dass "Connect To Predefined Network" aktiviert ist
- Prüfe, dass die Container-Namen der Database Resources korrekt sind
- Prüfe, dass die Connection Strings korrekt sind

### Problem: Health Checks schlagen fehl

**Lösung:**
- Prüfe, dass die Health Check Endpunkte existieren
- Prüfe, dass die Ports korrekt sind
- Erhöhe `start_period` falls der Service länger zum Starten braucht

---

## Checkliste

Vor dem Start:
- [ ] Alle Environment Variables gesammelt
- [ ] Container-Namen der Database Resources notiert
- [ ] GitHub Repository Zugriff konfiguriert

Während der Migration:
- [ ] Web Service erstellt und deployed
- [ ] API Service erstellt und deployed
- [ ] Chat API Service erstellt und deployed
- [ ] Indexing API Service erstellt und deployed
- [ ] Celery Worker Service erstellt und deployed
- [ ] Celery Beat Service erstellt und deployed
- [ ] Qdrant Container Service erstellt (oder Database Resource)
- [ ] Neo4j Container Service erstellt (oder Database Resource)

Nach der Migration:
- [ ] Alle Services laufen
- [ ] Health Checks erfolgreich
- [ ] API-Endpunkte funktionieren
- [ ] Frontend funktioniert
- [ ] Background Jobs funktionieren
- [ ] Scheduled Tasks funktionieren

---

## Nächste Schritte

1. **Beginne mit einem Service**: Z.B. `web` oder `api`
2. **Teste**: Prüfe, ob alles funktioniert
3. **Migriere weitere**: Einer nach dem anderen
4. **Dokumentiere**: Notiere alle Environment Variables und Konfigurationen

**Viel Erfolg! 🚀**

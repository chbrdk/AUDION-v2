# Environment Variables Template

Diese Datei enthält alle Environment Variables, die für jeden Service benötigt werden.

## Gemeinsame Variables

Diese Variables werden von mehreren Services verwendet:

```bash
# Database
DATABASE_URL=postgres://postgres:PASSWORD@CONTAINER_NAME:5432/audion
REDIS_URL=redis://default:PASSWORD@CONTAINER_NAME:6379/0

# Vector & Graph Database
QDRANT_URL=http://audion-qdrant:6333
NEO4J_URI=bolt://audion-neo4j:7687
NEO4J_USER=neo4j
NEO4J_PASSWORD=dein-neo4j-password

# API Keys
OPENAI_API_KEY=dein-openai-key
CLAUDE_API_KEY=dein-claude-key

# Environment
APP_ENV=production
```

**WICHTIG**: 
- Ersetze `PASSWORD` mit den tatsächlichen Passwörtern
- Ersetze `CONTAINER_NAME` mit den tatsächlichen Container-Namen aus deinen Database Resources
- `DATABASE_URL` wird automatisch von `postgres://` zu `postgresql+psycopg://` konvertiert

---

## Service-spezifische Variables

### Web Service (`audion-web`)

```bash
NODE_ENV=production
NEXT_PUBLIC_BASE_PATH=/audion
NEXT_PUBLIC_PERSONA_BACKEND_URL=http://audion-api:8000
NEXT_PUBLIC_CHAT_API_URL=http://audion-chat-api:8001
NEXT_PERSONA_BACKEND_INTERNAL_URL=http://audion-api:8000
```

### API Service (`audion-api`)

```bash
# Alle gemeinsamen Variables +
# (keine zusätzlichen)
```

### Chat API Service (`audion-chat-api`)

```bash
# Alle gemeinsamen Variables +
INDEXING_API_URL=http://audion-indexing-api:8000
```

### Indexing API Service (`audion-indexing-api`)

```bash
# Alle gemeinsamen Variables +
# (keine zusätzlichen)
```

### Celery Worker Service (`audion-celery-worker`)

```bash
# Alle gemeinsamen Variables +
# (keine zusätzlichen)
```

### Celery Beat Service (`audion-celery-beat`)

```bash
# Alle gemeinsamen Variables +
# (keine zusätzlichen)
```

---

## Vollständige Variable-Listen pro Service

### Web Service - Komplette Liste

```bash
NODE_ENV=production
NEXT_PUBLIC_BASE_PATH=/audion
NEXT_PUBLIC_PERSONA_BACKEND_URL=http://audion-api:8000
NEXT_PUBLIC_CHAT_API_URL=http://audion-chat-api:8001
NEXT_PERSONA_BACKEND_INTERNAL_URL=http://audion-api:8000
```

### API Service - Komplette Liste

```bash
DATABASE_URL=postgres://postgres:PASSWORD@CONTAINER_NAME:5432/audion
REDIS_URL=redis://default:PASSWORD@CONTAINER_NAME:6379/0
QDRANT_URL=http://audion-qdrant:6333
NEO4J_URI=bolt://audion-neo4j:7687
NEO4J_USER=neo4j
NEO4J_PASSWORD=dein-neo4j-password
OPENAI_API_KEY=dein-openai-key
CLAUDE_API_KEY=dein-claude-key
APP_ENV=production
```

### Chat API Service - Komplette Liste

```bash
DATABASE_URL=postgres://postgres:PASSWORD@CONTAINER_NAME:5432/audion
QDRANT_URL=http://audion-qdrant:6333
NEO4J_URI=bolt://audion-neo4j:7687
NEO4J_USER=neo4j
NEO4J_PASSWORD=dein-neo4j-password
OPENAI_API_KEY=dein-openai-key
INDEXING_API_URL=http://audion-indexing-api:8000
APP_ENV=production
```

### Indexing API Service - Komplette Liste

```bash
DATABASE_URL=postgres://postgres:PASSWORD@CONTAINER_NAME:5432/audion
QDRANT_URL=http://audion-qdrant:6333
APP_ENV=production
```

### Celery Worker Service - Komplette Liste

```bash
DATABASE_URL=postgres://postgres:PASSWORD@CONTAINER_NAME:5432/audion
REDIS_URL=redis://default:PASSWORD@CONTAINER_NAME:6379/0
QDRANT_URL=http://audion-qdrant:6333
NEO4J_URI=bolt://audion-neo4j:7687
NEO4J_USER=neo4j
NEO4J_PASSWORD=dein-neo4j-password
OPENAI_API_KEY=dein-openai-key
CLAUDE_API_KEY=dein-claude-key
APP_ENV=production
```

### Celery Beat Service - Komplette Liste

```bash
DATABASE_URL=postgres://postgres:PASSWORD@CONTAINER_NAME:5432/audion
REDIS_URL=redis://default:PASSWORD@CONTAINER_NAME:6379/0
APP_ENV=production
```

---

## Service-Namen Mapping

**WICHTIG**: Die Service-Namen in den Environment Variables müssen mit den **Application-Namen** in Coolify übereinstimmen!

| Service | Application Name in Coolify | URL in Environment Variables |
|---------|----------------------------|------------------------------|
| Web | `audion-web` | `http://audion-web:3000` |
| API | `audion-api` | `http://audion-api:8000` |
| Chat API | `audion-chat-api` | `http://audion-chat-api:8001` |
| Indexing API | `audion-indexing-api` | `http://audion-indexing-api:8000` |
| Celery Worker | `audion-celery-worker` | (kein HTTP Endpoint) |
| Celery Beat | `audion-celery-beat` | (kein HTTP Endpoint) |
| Qdrant | `audion-qdrant` | `http://audion-qdrant:6333` |
| Neo4j | `audion-neo4j` | `bolt://audion-neo4j:7687` |

---

## Database Resource Container-Namen

**WICHTIG**: Diese Container-Namen findest du in deinen Database Resources:

1. Gehe zu **Resources** → **Database**
2. Klicke auf deine PostgreSQL Database Resource
3. Suche nach **"Connection Details"** oder **"Internal URL"**
4. Der Container-Name ist der Hostname in der Connection String

**Beispiel:**
- PostgreSQL: `y4cos8wkk0sg0k88sgoscwso` (dein Container-Name)
- Redis: `xgc8okk8gskock08wskwkwks` (dein Container-Name)

**Ersetze in den Environment Variables:**
- `CONTAINER_NAME` → Dein tatsächlicher Container-Name

---

## Copy-Paste Templates

### Für Coolify Environment Variables (Web Service)

```
NODE_ENV=production
NEXT_PUBLIC_BASE_PATH=/audion
NEXT_PUBLIC_PERSONA_BACKEND_URL=http://audion-api:8000
NEXT_PUBLIC_CHAT_API_URL=http://audion-chat-api:8001
NEXT_PERSONA_BACKEND_INTERNAL_URL=http://audion-api:8000
```

### Für Coolify Environment Variables (API Service)

```
DATABASE_URL=postgres://postgres:DEIN_PASSWORD@DEIN_CONTAINER_NAME:5432/audion
REDIS_URL=redis://default:DEIN_PASSWORD@DEIN_CONTAINER_NAME:6379/0
QDRANT_URL=http://audion-qdrant:6333
NEO4J_URI=bolt://audion-neo4j:7687
NEO4J_USER=neo4j
NEO4J_PASSWORD=dein-neo4j-password
OPENAI_API_KEY=dein-openai-key
CLAUDE_API_KEY=dein-claude-key
APP_ENV=production
```

**Ersetze:**
- `DEIN_PASSWORD` → Dein PostgreSQL/Redis Password
- `DEIN_CONTAINER_NAME` → Dein Container-Name aus Database Resource

---

## Sicherheit

**WICHTIG**: 
- Speichere diese Datei **NICHT** im Git Repository mit echten Passwörtern!
- Verwende Environment Variables in Coolify, nicht in der Datei
- Diese Datei ist nur ein Template - ersetze alle Platzhalter mit echten Werten

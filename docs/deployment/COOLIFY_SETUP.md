# Coolify Setup-Anleitung für Audion

Diese Anleitung erklärt, wie du Audion vollständig in Coolify einrichtest.

## Übersicht

Audion benötigt folgende Komponenten:
- **Application**: Docker Compose Deployment (bereits erstellt)
- **Database Resources**: PostgreSQL, Redis
- **Container Services**: Qdrant, Neo4j (können auch als Database Resources erstellt werden)
- **Environment Variables**: API Keys und Service URLs

---

## Schritt 1: Database Resources erstellen

In Coolify kannst du Database Resources erstellen, die automatisch verwaltet werden.

### 1.1 PostgreSQL erstellen

1. Gehe zu **Resources** → **Database** → **New Database**
2. Wähle **PostgreSQL**
3. Konfiguration:
   - **Name**: `audion-postgres` (oder wie du möchtest)
   - **Version**: `16` oder neuer
   - **Database Name**: `audion` (optional, wird automatisch erstellt)
   - **User**: postgres
   - **Password**: 57DxyBIglyI5qKVTX6gx6D63KSPCTT5WrztWJsdE6lcjN03VPKUTjQIXHeXf53fI
4. Klicke auf **Create**
5. **WICHTIG**: Nach dem Erstellen findest du die Connection-Informationen:
   - Gehe zur erstellten Database Resource
   - Suche nach **"Connection String"**, **"Connection URL"** oder **"Database URL"**
   - Falls nicht sichtbar: Die Connection String setzt sich zusammen aus:
     ```
     postgresql://USER:PASSWORD@HOST:5432/DATABASE
     ```
   - **Host**: Der Name der Database Resource (z.B. `audion-postgres`)
   - **Port**: `5432` (Standard PostgreSQL Port)
   - **User**: `postgres` (oder der von dir gesetzte User)
   - **Password**: Das von dir gesetzte Passwort
   - **Database**: `audion` (oder der von dir gesetzte Name)
   
   **Beispiel Connection String**:
   ```
postgres://postgres:57DxyBIglyI5qKVTX6gx6D63KSPCTT5WrztWJsdE6lcjN03VPKUTjQIXHeXf53fI@y4cos8wkk0sg0k88sgoscwso:5432/audion
   ```

### 1.2 Redis erstellen

1. Gehe zu **Resources** → **Database** → **New Database**
2. Wähle **Redis**
3. Konfiguration:
   - **Name**: `audion-redis`
   - **Version**: `7` oder neuer
4. Klicke auf **Create**
5. **WICHTIG**: Nach dem Erstellen findest du die Connection-Informationen:
   - Gehe zur erstellten Database Resource
   - Suche nach **"Connection String"**, **"Connection URL"** oder **"Redis URL"**
   - Falls nicht sichtbar: Die Connection String setzt sich zusammen aus:
     ```
     redis://HOST:6379/0

     redis://default:PJcQx4QWITPjBOelnVvHxNcOw7kR78hrqPg9rDc419RKjD5ffUqOHIMFg6YwX4oN@xgc8okk8gskock08wskwkwks:6379/0
     ```
   - **Host**: Der Name der Database Resource (z.B. `audion-redis`)
   - **Port**: `6379` (Standard Redis Port)
   - **Database**: `0` (Standard Redis Database)
   
   **Beispiel Connection String**:
   ```
   redis://audion-redis:6379/0
   ```

---

## Schritt 2: Container Services erstellen (Qdrant & Neo4j)

Qdrant und Neo4j können als normale Docker Container in Coolify erstellt werden.

### 2.1 Qdrant (Vector Database) erstellen

1. Gehe zu **Resources** → **One-Click Apps** oder **New Resource**
2. Wähle **Docker Image** oder **One-Click App**
3. Konfiguration:
   - **Name**: `audion-qdrant`
   - **Image**: `qdrant/qdrant:v1.11.3`
   - **Ports**:
     - `6333:6333` (HTTP API)
     - `6334:6334` (gRPC)
   - **Volumes**: 
     - `/qdrant/storage` (für Persistenz)
   - **Environment Variables**:
     - `QDRANT__SERVICE__GRPC_PORT=6334`
4. Klicke auf **Create**

**Alternative**: Du kannst Qdrant auch als Database Resource erstellen, falls Coolify das unterstützt.

### 2.2 Neo4j (Graph Database) erstellen

1. Gehe zu **Resources** → **One-Click Apps** oder **New Resource**
2. Wähle **Docker Image** oder **One-Click App**
3. Konfiguration:
   - **Name**: `audion-neo4j`
   - **Image**: `neo4j:5.22.0`
   - **Ports**:
     - `7474:7474` (HTTP)
     - `7687:7687` (Bolt)
   - **Volumes**:
     - `/data` (für Daten)
     - `/logs` (für Logs)
   - **Environment Variables**:
     - `NEO4J_AUTH=neo4j/DEIN_PASSWORT` (ersetze DEIN_PASSWORT mit einem sicheren Passwort!)
     - `NEO4J_PLUGINS=["apoc"]`
     - `NEO4J_dbms_security_procedures_unrestricted=apoc.*`
     - `NEO4J_dbms_security_procedures_allowlist=apoc.*`
4. Klicke auf **Create**

**WICHTIG**: Notiere dir das Neo4j-Passwort, du brauchst es für die Environment Variables!

---

## Schritt 3: Environment Variables konfigurieren

Gehe zu deiner **Application** → **Settings** → **Environment Variables**

### 3.1 Database URLs

Füge die Connection Strings von Schritt 1 hinzu:

```bash
# PostgreSQL (von Database Resource)
# Format: postgres://USER:PASSWORD@HOST:5432/DATABASE
# Hinweis: Coolify gibt "postgres://" zurück, nicht "postgresql://"
# Der Code konvertiert automatisch "postgres://" zu "postgresql+psycopg://" für SQLAlchemy
DATABASE_URL=postgres://postgres:57DxyBIglyI5qKVTX6gx6D63KSPCTT5WrztWJsdE6lcjN03VPKUTjQIXHeXf53fI@y4cos8wkk0sg0k88sgoscwso:5432/audion

# Redis (von Database Resource)
# Format: redis://USER:PASSWORD@HOST:6379/0
REDIS_URL=redis://default:PJcQx4QWITPjBOelnVvHxNcOw7kR78hrqPg9rDc419RKjD5ffUqOHIMFg6YwX4oN@xgc8okk8gskock08wskwkwks:6379/0
```

**WICHTIG**: 
- Ersetze die Werte mit deinen tatsächlichen Credentials
- **Host**: Verwende den Namen der Database Resource (z.B. `audion-postgres`, `audion-redis`)
- In Coolify können Services über ihre Namen erreicht werden (Docker Service Discovery)
- Falls du die Connection String nicht findest, konstruiere sie manuell mit dem Format oben

### 3.2 Vector & Graph Database URLs

```bash
# Qdrant (von Container Service)
QDRANT_URL=http://audion-qdrant:6333

# Neo4j (von Container Service)
NEO4J_URI=bolt://audion-neo4j:7687
NEO4J_USER=neo4j
NEO4J_PASSWORD=DEIN_NEO4J_PASSWORT  # Das Passwort, das du in Schritt 2.2 gesetzt hast
```

### 3.3 API Keys

```bash
# OpenAI API Key (erforderlich)
OPENAI_API_KEY=sk-...

# Claude API Key (optional, falls du Claude verwenden möchtest)
CLAUDE_API_KEY=sk-ant-...
```

### 3.4 Application Environment

```bash
# Application Mode
APP_ENV=production
```

### 3.5 Frontend URLs (für Next.js)

```bash
# Base Path (falls Audion unter einem Subpfad läuft, z.B. /audion)
NEXT_PUBLIC_BASE_PATH=/audion

# Backend URLs (interne Service-Namen in Coolify)
NEXT_PUBLIC_PERSONA_BACKEND_URL=http://audion-api:8000
NEXT_PUBLIC_CHAT_API_URL=http://audion-chat-api:8001

# Internal Backend URL (für Server-Side Requests)
NEXT_PERSONA_BACKEND_INTERNAL_URL=http://audion-api:8000
```

**WICHTIG**: 
- Die Service-Namen (`audion-api`, `audion-chat-api`) müssen mit den Container-Namen in deinem Docker Compose übereinstimmen
- In Coolify werden Services über ihre Container-Namen erreichbar

---

## Schritt 4: Docker Compose Service-Namen prüfen

Stelle sicher, dass die Service-Namen in `docker-compose.yml` mit den Environment Variables übereinstimmen:

```yaml
services:
  web:
    container_name: audion-web
  api:
    container_name: audion-api
  chat-api:
    container_name: audion-chat-api
  indexing-api:
    container_name: audion-indexing-api
```

Die Environment Variables sollten diese Namen verwenden:
- `NEXT_PUBLIC_PERSONA_BACKEND_URL=http://audion-api:8000`
- `NEXT_PUBLIC_CHAT_API_URL=http://audion-chat-api:8001`

---

## Schritt 5: Netzwerk-Konfiguration

In Coolify sollten alle Services im gleichen Netzwerk sein. Prüfe:

1. **Application Settings** → **Networking**
2. Stelle sicher, dass alle Services im gleichen Netzwerk sind
3. Falls nicht: Coolify erstellt automatisch ein Netzwerk für Docker Compose

---

## Schritt 6: Deploy!

1. Gehe zu deiner **Application**
2. Klicke auf **Deploy** oder **Redeploy**
3. Warte, bis alle Services gebaut und gestartet sind
4. Prüfe die Logs auf Fehler

---

## Troubleshooting

### Services können sich nicht erreichen

**Problem**: `Connection refused` oder `Name resolution failed`

**Lösungen**:
1. Prüfe, dass alle Services im gleichen Netzwerk sind
2. Verwende die Container-Namen (z.B. `audion-api`) statt `localhost` oder IPs
3. Prüfe, dass die Ports korrekt sind (z.B. `8000` für API, `8001` für Chat-API)

### Database Connection Fehler

**Problem**: `could not connect to database`

**Lösungen**:
1. Prüfe, dass die Database Resources laufen
2. Prüfe die Connection Strings (User, Password, Host, Port)
3. In Coolify: Database Resources sind über ihren Namen erreichbar (z.B. `audion-postgres:5432`)

### Neo4j Connection Fehler

**Problem**: `Unable to connect to Neo4j`

**Lösungen**:
1. Prüfe, dass Neo4j Container läuft
2. Prüfe `NEO4J_URI`, `NEO4J_USER`, `NEO4J_PASSWORD`
3. Prüfe, dass der Bolt-Port (`7687`) erreichbar ist

### Qdrant Connection Fehler

**Problem**: `Connection to Qdrant failed`

**Lösungen**:
1. Prüfe, dass Qdrant Container läuft
2. Prüfe `QDRANT_URL` (sollte `http://audion-qdrant:6333` sein)
3. Prüfe, dass Port `6333` erreichbar ist

---

## Checkliste

Vor dem Deploy:

- [ ] PostgreSQL Database Resource erstellt
- [ ] Redis Database Resource erstellt
- [ ] Qdrant Container Service erstellt
- [ ] Neo4j Container Service erstellt
- [ ] Alle Environment Variables gesetzt:
  - [ ] `DATABASE_URL`
  - [ ] `REDIS_URL`
  - [ ] `QDRANT_URL`
  - [ ] `NEO4J_URI`, `NEO4J_USER`, `NEO4J_PASSWORD`
  - [ ] `OPENAI_API_KEY`
  - [ ] `CLAUDE_API_KEY` (optional)
  - [ ] `APP_ENV=production`
  - [ ] `NEXT_PUBLIC_BASE_PATH`
  - [ ] `NEXT_PUBLIC_PERSONA_BACKEND_URL`
  - [ ] `NEXT_PUBLIC_CHAT_API_URL`
- [ ] Service-Namen in Environment Variables stimmen mit Docker Compose überein
- [ ] Alle Services sind im gleichen Netzwerk

---

## Nächste Schritte

Nach erfolgreichem Deploy:

1. Prüfe die Health Checks der Services
2. Teste die API-Endpunkte
3. Prüfe die Logs auf Fehler
4. Teste die Frontend-Anwendung

---

## Hilfe

Falls du Probleme hast:
1. Prüfe die Logs aller Services
2. Prüfe die Network-Konfiguration
3. Prüfe die Environment Variables
4. Prüfe, dass alle Database Resources laufen

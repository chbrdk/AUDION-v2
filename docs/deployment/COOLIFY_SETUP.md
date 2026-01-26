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
     - `NEO4J_AUTH=neo4j/DEIN_PASSWORT` (ersetze DEIN_PASSWORT mit einem sicheren Passwort! **WICHTIG: Passwort darf nicht leer sein!**)
     - `NEO4J_PLUGINS=["apoc"]`
     - `NEO4J_dbms_security_procedures_unrestricted=apoc.*`
     - `NEO4J_dbms_security_procedures_allowlist=apoc.*`
4. Klicke auf **Create**

**WICHTIG**: 
- Notiere dir das Neo4j-Passwort, du brauchst es für die Environment Variables!
- Das Passwort **MUSS** gesetzt sein - `neo4j/` ohne Passwort funktioniert nicht!
- Verwende ein sicheres Passwort (mindestens 8 Zeichen)

---

## Schritt 3: Environment Variables konfigurieren

### 3.0 Wo setze ich die Environment Variables?

**WICHTIG**: Es gibt zwei Stellen, wo du Environment Variables setzen musst:

1. **Application Environment Variables** (für deine Docker Compose Services):
   - Gehe zu deiner **Application** → **Settings** → **Environment Variables**
   - Hier setzt du alle Variablen, die deine Services (api, chat-api, indexing-api, etc.) brauchen

2. **Neo4j Container Environment Variables** (nur für Neo4j):
   - Gehe zu deinem **Neo4j Container** (in docker-compose.yml oder als separater Service)
   - Oder: In Coolify → **Resources** → **One-Click Apps** → dein Neo4j Service → **Environment Variables**
   - Hier setzt du `NEO4J_AUTH=neo4j/DEIN_PASSWORT`

### 3.1 Application Environment Variables setzen

Gehe zu deiner **Application** → **Settings** → **Environment Variables**

### 3.1 Database URLs finden und setzen

#### Schritt 1: PostgreSQL Connection String finden

1. Gehe zu **Resources** → **Database** → deine PostgreSQL Resource (z.B. `audion-postgres`)
2. Suche nach **"Connection String"**, **"Connection URL"**, **"Internal URL"** oder **"Connection Details"**
3. Klicke auf das **Auge-Icon** (👁️) neben der URL, um sie anzuzeigen
4. **WICHTIG**: Notiere dir den **Container-Namen** (z.B. `y4cos8wkk0sg0k88sgoscwso`)
   - Das ist NICHT der Resource-Name (`audion-postgres`), sondern der generierte Container-Name!
5. Falls keine Connection String angezeigt wird, konstruiere sie manuell:
   ```
   postgres://USER:PASSWORD@CONTAINER_NAME:5432/DATABASE
   ```
   - **USER**: Meist `postgres`
   - **PASSWORD**: Das Passwort, das du beim Erstellen gesetzt hast
   - **CONTAINER_NAME**: Der generierte Container-Name (z.B. `y4cos8wkk0sg0k88sgoscwso`)
   - **DATABASE**: Meist `postgres` oder `audion`

#### Schritt 2: Redis Connection String finden

1. Gehe zu **Resources** → **Database** → deine Redis Resource (z.B. `audion-redis`)
2. Suche nach **"Connection String"**, **"Redis URL"**, **"Internal URL"** oder **"Connection Details"**
3. Klicke auf das **Auge-Icon** (👁️) neben der URL, um sie anzuzeigen
4. **WICHTIG**: Notiere dir den **Container-Namen** (z.B. `xgc8okk8gskock08wskwkwks`)
5. Falls keine Connection String angezeigt wird, konstruiere sie manuell:
   ```
   redis://default:PASSWORD@CONTAINER_NAME:6379/0
   ```
   - **PASSWORD**: Das Passwort, das du beim Erstellen gesetzt hast (oder `default` für Redis)
   - **CONTAINER_NAME**: Der generierte Container-Name

#### Schritt 3: Environment Variables in Application setzen

1. Gehe zu deiner **Application** → **Settings** → **Environment Variables**
2. Klicke auf **"Add Environment Variable"** oder **"+"**
3. Füge die folgenden Variablen hinzu:

```bash
# PostgreSQL (von Database Resource)
# Format: postgres://USER:PASSWORD@CONTAINER_NAME:5432/DATABASE
# Hinweis: Coolify gibt "postgres://" zurück, nicht "postgresql://"
# Der Code konvertiert automatisch "postgres://" zu "postgresql+psycopg://" für SQLAlchemy
DATABASE_URL=postgres://postgres:DEIN_PASSWORT@CONTAINER_NAME:5432/audion

# Redis (von Database Resource)
# Format: redis://default:PASSWORD@CONTAINER_NAME:6379/0
REDIS_URL=redis://default:DEIN_PASSWORT@CONTAINER_NAME:6379/0
```

**WICHTIG**: 
- Ersetze `DEIN_PASSWORT` mit deinen tatsächlichen Passwörtern
- Ersetze `CONTAINER_NAME` mit den generierten Container-Namen (nicht den Resource-Namen!)
- **Host**: Verwende den **Container-Namen**, nicht den Resource-Namen
- **Netzwerk**: Stelle sicher, dass "Connect To Predefined Network" aktiviert ist (siehe Schritt 4)

### 3.2 Vector & Graph Database URLs

Füge diese Variablen in **Application** → **Settings** → **Environment Variables** hinzu:

```bash
# Qdrant (von Container Service im docker-compose.yml)
QDRANT_URL=http://qdrant:6333

# Neo4j (von Container Service im docker-compose.yml)
NEO4J_URI=bolt://neo4j:7687
NEO4J_USER=neo4j
NEO4J_PASSWORD=DEIN_NEO4J_PASSWORT  # Das Passwort, das du für Neo4j setzt (siehe unten)
```

**WICHTIG für Neo4j**:
- `NEO4J_PASSWORD` muss in den **Application Environment Variables** gesetzt werden
- Zusätzlich muss `NEO4J_AUTH=neo4j/DEIN_PASSWORT` im **Neo4j Container** gesetzt werden
- Siehe Schritt 3.3 für Details

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

## Schritt 4: Database Resources mit Docker Compose verbinden

**WICHTIG**: Database Resources sind separate Container und müssen mit deiner Docker Compose Application verbunden werden!

### Option 1: "Connect To Predefined Network" aktivieren (EMPFOHLEN)

1. Gehe zu deiner **Application** → **Settings** → **Advanced** (oder **Networking**)
2. Aktiviere die Option **"Connect To Predefined Network"** oder **"Connect to Coolify Network"**
   - Diese Option erlaubt deiner Docker Compose Application, mit Database Resources zu kommunizieren
3. Speichere die Änderungen

### Option 2: Container-Namen der Database Resources finden

Falls Option 1 nicht verfügbar ist:

1. Gehe zu deiner **PostgreSQL Database Resource**
2. Klicke auf das **Auge-Icon** neben "PostgreSQL URL (internal)" oder "Connection Details"
3. Notiere dir den **Container-Namen** (z.B. `y4cos8wkk0sg0k88sgoscwso`)
   - Das ist NICHT der Resource-Name (`audion-postgres`), sondern der generierte Container-Name!
4. Wiederhole das für **Redis**
5. Verwende diese Container-Namen in den Connection Strings (siehe Schritt 3)

**WICHTIG**: 
- Database Resources laufen im `coolify` Netzwerk
- Docker Compose Services laufen in ihrem eigenen Netzwerk
- "Connect To Predefined Network" verbindet beide Netzwerke automatisch

---

## Schritt 5: Docker Compose Service-Namen prüfen

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

## Schritt 6: Netzwerk-Konfiguration

In Coolify sollten alle Services im gleichen Netzwerk sein. Prüfe:

1. **Application Settings** → **Networking**
2. Stelle sicher, dass alle Services im gleichen Netzwerk sind
3. Falls nicht: Coolify erstellt automatisch ein Netzwerk für Docker Compose

---

## Schritt 7: Deploy!

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

**Problem**: `could not connect to database` oder `Temporary failure in name resolution`

**Lösungen**:
1. **WICHTIG**: "Connect To Predefined Network" muss aktiviert sein!
   - Gehe zu **Application** → **Settings** → **Advanced** (oder **Networking**)
   - Aktiviere **"Connect To Predefined Network"** oder **"Connect to Coolify Network"**
   - Diese Option verbindet deine Docker Compose Services mit Database Resources
   - **Redeploy** die Application nach dem Aktivieren!
2. Prüfe, dass die Database Resources laufen
3. Prüfe die Connection Strings (User, Password, Host, Port)
4. **WICHTIG**: In Coolify sind Database Resources über ihre **Container-Namen** erreichbar
   - Nicht über den Resource-Namen (z.B. `audion-postgres`)
   - Sondern über den generierten Container-Namen (z.B. `y4cos8wkk0sg0k88sgoscwso`)
   - Finde den Container-Namen in der Database Resource:
     - Klicke auf das **Auge-Icon** neben "PostgreSQL URL (internal)" oder "Connection Details"
     - Der Container-Name ist der Hostname in der Connection String
5. Prüfe, dass die Ports korrekt sind (5432 für PostgreSQL, 6379 für Redis)
6. Falls weiterhin Probleme: Prüfe, ob die Database Resources im `coolify` Netzwerk laufen

### Neo4j Connection Fehler

**Problem**: `Unable to connect to Neo4j` oder `Invalid value for NEO4J_AUTH: 'neo4j/'`

**Lösungen**:
1. **NEO4J_AUTH Problem**: Das Passwort darf nicht leer sein!
   - `NEO4J_AUTH=neo4j/` → **FALSCH** (leeres Passwort)
   - `NEO4J_AUTH=neo4j/meinPasswort123` → **RICHTIG** (mit Passwort)
   - Setze es in den Neo4j Container Environment Variables
   - Dann setze `NEO4J_PASSWORD=meinPasswort123` in den Application Environment Variables
2. Prüfe, dass Neo4j Container läuft
3. Prüfe `NEO4J_URI`, `NEO4J_USER`, `NEO4J_PASSWORD` in den Environment Variables
4. Prüfe, dass der Bolt-Port (`7687`) erreichbar ist
5. **Hostname**: Verwende den Container-Namen (z.B. `audion-neo4j`) oder den generierten Hostnamen

### FlagEmbedding Import Fehler

**Problem**: `ImportError: cannot import name 'is_torch_fx_available' from 'transformers.utils.import_utils'`

**Lösung**: 
- Der Code wurde bereits gefixt - FlagEmbedding wird jetzt lazy importiert
- Der Import-Fehler tritt nur auf, wenn FlagEmbedding tatsächlich verwendet wird
- Falls der Fehler weiterhin auftritt: Prüfe, ob FlagEmbedding 1.3.5 die neueste Version ist
- Alternative: transformers-Version downgraden (nicht empfohlen)

### Qdrant Connection Fehler

**Problem**: `Connection to Qdrant failed`

**Lösungen**:
1. Prüfe, dass Qdrant Container läuft
2. Prüfe `QDRANT_URL` (sollte `http://audion-qdrant:6333` sein)
3. Prüfe, dass Port `6333` erreichbar ist

### Anwendung startet immer wieder neu

**Problem**: Services starten kontinuierlich neu (Restart-Loop)

**Mögliche Ursachen und Lösungen**:

1. **Neo4j Config-Fehler (nur Warnungen)**
   - **Symptom**: `Failed to read config: Unrecognized setting. No declared setting with name: URI`
   - **Ursache**: Coolify injiziert `NEO4J_URI`, `NEO4J_USER`, `NEO4J_PASSWORD` global, Neo4j interpretiert sie als Config
   - **Lösung**: Diese Fehler sind **nur Warnungen** und sollten Neo4j nicht am Starten hindern
   - **Prüfen**: Neo4j sollte trotzdem laufen - prüfe mit `docker logs audion-neo4j`

2. **Health Check schlägt fehl**
   - **Symptom**: Service startet, Health Check schlägt fehl, Service wird neu gestartet
   - **Lösung**: 
     - Prüfe die Health Check Logs: `docker logs <service-name>`
     - Prüfe, ob der Health Check Endpoint erreichbar ist
     - Erhöhe `start_period` im Health Check, falls der Service länger zum Starten braucht

3. **Service crasht beim Start**
   - **Symptom**: Service startet, crasht sofort, wird neu gestartet
   - **Lösung**:
     - Prüfe die Logs des crashenden Services: `docker logs <service-name>`
     - Prüfe, ob alle Environment Variables gesetzt sind
     - Prüfe, ob alle Dependencies (Database, Redis, etc.) erreichbar sind

4. **Database Connection Fehler**
   - **Symptom**: Service kann nicht zur Database verbinden
   - **Lösung**: Siehe "Database Connection Fehler" oben

**Debugging-Schritte**:
1. Prüfe, welcher Service genau neu startet: `docker ps -a` (schaue auf "Restart" Spalte)
2. Prüfe die Logs des neu startenden Services: `docker logs <service-name>`
3. Prüfe, ob alle Dependencies laufen: `docker ps`
4. Prüfe Health Check Status: `docker inspect <service-name> | grep -A 10 Health`

### Force Rebuild / Cache löschen (Coolify v4.0.0-beta)

**Problem**: Code-Änderungen werden nicht übernommen, Container verwendet alten Build

**Lösungen**:

#### Methode 1: Force Deploy (Empfohlen)
1. Gehe zu **Application** → **Deployments**
2. Klicke auf **"Force Deploy"** oder **"Force Deploy (without cache)"**
3. Dies startet einen Build mit `--no-cache` Docker-Option
4. Warte, bis der Build abgeschlossen ist

#### Methode 2: BuildKit Cache deaktivieren
1. Gehe zu **Application** → **Settings** → **Build** → **Advanced**
2. Aktiviere **"Disable BuildKit Cache"**
3. Führe dann einen manuellen Deploy durch

#### Workaround (falls Methoden 1 & 2 nicht funktionieren)
**Bekannte Bugs in Coolify v4.0.0-beta:**
- Force Deploy nutzt manchmal trotzdem Cache
- "Disable BuildKit Cache" wird bei Webhook-Deployments nicht beachtet

**Workaround:**
1. **Stoppe** den Service (Application → Stop)
2. Warte 10-15 Sekunden
3. **Starte** den Service neu (Application → Start)
4. Oder führe einen **manuellen Deploy** durch

**Hinweis**: Nach Code-Änderungen (z.B. `db.py` Fixes) sollte immer ein Force Rebuild durchgeführt werden, um sicherzustellen, dass der neue Code verwendet wird.

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

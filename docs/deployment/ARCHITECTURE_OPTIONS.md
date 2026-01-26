# Architektur-Optionen: Docker Compose vs. Einzelne Services

## Aktuelle Architektur: Docker Compose (Monolithisch)

**Alle Services in einem Docker Compose Deployment:**
- `web` (Next.js Frontend)
- `api` (FastAPI Backend)
- `chat-api` (FastAPI Chat Service)
- `indexing-api` (FastAPI Document Processing)
- `celery-worker` (Background Jobs)
- `celery-beat` (Scheduled Tasks)
- `qdrant` (Vector Database)
- `neo4j` (Graph Database)

**PostgreSQL und Redis als separate Database Resources**

## Alternative: Einzelne Services (Mikroservices)

**Jeder Service als eigenständiger Service in Coolify:**
- Jeder Service hat eigene Logs, Status, Health Checks
- Jeder Service kann unabhängig skaliert werden
- Jeder Service kann eigene Resource Limits haben

---

## Vergleich: Vor- und Nachteile

### Docker Compose (Aktuell)

#### ✅ Vorteile:
1. **Einfache Konfiguration**: Alles in einer Datei
2. **Automatische Abhängigkeiten**: `depends_on` funktioniert automatisch
3. **Gemeinsames Netzwerk**: Alle Services sind automatisch im gleichen Netzwerk
4. **Einfacheres Deployment**: Ein Klick deployt alles
5. **Weniger Overhead**: Weniger Services zu verwalten

#### ❌ Nachteile:
1. **Schlechte Isolation**: Ein Service-Crash kann andere beeinflussen
2. **Schwieriges Debugging**: Alle Logs zusammen, schwer zu filtern
3. **Keine individuelle Skalierung**: Alle Services müssen zusammen skaliert werden
4. **Health Check Probleme**: Wenn ein Service unhealthy ist, kann das ganze Deployment als "Restarting" erscheinen
5. **Resource Limits**: Alle Services teilen sich die Limits
6. **Deployment**: Ein Service-Update erfordert Redeploy des ganzen Stacks

### Einzelne Services (Mikroservices)

#### ✅ Vorteile:
1. **Bessere Isolation**: Jeder Service ist unabhängig
2. **Einfacheres Debugging**: Jeder Service hat eigene Logs/Status
3. **Individuelle Skalierung**: Jeder Service kann separat skaliert werden
4. **Bessere Resource-Kontrolle**: Jeder Service kann eigene Limits haben
5. **Unabhängige Deployments**: Ein Service kann neu deployed werden ohne andere zu beeinflussen
6. **Besseres Monitoring**: Health Checks pro Service, nicht pro Stack
7. **Einfachere Fehlerbehebung**: Klar welcher Service das Problem hat

#### ❌ Nachteile:
1. **Mehr Komplexität**: Mehr Services zu verwalten
2. **Network-Konfiguration**: Alle Services müssen im gleichen Netzwerk sein ("Connect To Predefined Network")
3. **Environment Variables**: Müssen für jeden Service gesetzt werden
4. **Abhängigkeiten**: Müssen manuell konfiguriert werden (kein `depends_on`)
5. **Mehr Overhead**: Mehr Services = mehr Verwaltung

---

## Empfehlung

### Für Produktion: **Einzelne Services (Mikroservices)** ✅

**Warum:**
1. **Besseres Debugging**: Das aktuelle Problem (Restart-Loop) wäre einfacher zu debuggen, wenn jeder Service eigene Logs/Status hätte
2. **Skalierung**: `celery-worker` könnte z.B. auf 3 Instanzen skaliert werden, während `web` nur 1 Instanz braucht
3. **Resource Management**: `indexing-api` (CPU-intensiv) könnte mehr CPU bekommen als `web`
4. **Deployment**: Frontend-Updates müssen nicht das Backend neu deployen

### Für Entwicklung: **Docker Compose** ✅

**Warum:**
- Schnelleres Setup
- Einfachere lokale Entwicklung
- Weniger Konfiguration

---

## Migration: Docker Compose → Einzelne Services

### Schritt 1: Services identifizieren

**Stateless Services (können einfach getrennt werden):**
- `web` - Next.js Frontend
- `api` - FastAPI Backend
- `chat-api` - FastAPI Chat Service
- `indexing-api` - FastAPI Document Processing
- `celery-worker` - Background Jobs (kann skaliert werden)
- `celery-beat` - Scheduled Tasks (nur 1 Instanz)

**Stateful Services (sollten als Database Resources bleiben):**
- `postgresql` - Database Resource ✅ (bereits getrennt)
- `redis` - Database Resource ✅ (bereits getrennt)
- `qdrant` - Könnte als Database Resource oder Container Service bleiben
- `neo4j` - Könnte als Database Resource oder Container Service bleiben

### Schritt 2: Migration-Plan

1. **Phase 1: Stateless Services trennen**
   - `web` → Eigenständiger Service
   - `api` → Eigenständiger Service
   - `chat-api` → Eigenständiger Service
   - `indexing-api` → Eigenständiger Service

2. **Phase 2: Worker Services trennen**
   - `celery-worker` → Eigenständiger Service (kann skaliert werden)
   - `celery-beat` → Eigenständiger Service (nur 1 Instanz)

3. **Phase 3: Stateful Services prüfen**
   - `qdrant` → Als Database Resource oder Container Service?
   - `neo4j` → Als Database Resource oder Container Service?

### Schritt 3: Konfiguration pro Service

**Für jeden Service:**
1. **Dockerfile**: Bereits vorhanden ✅
2. **Environment Variables**: Müssen für jeden Service gesetzt werden
3. **Network**: "Connect To Predefined Network" aktivieren
4. **Health Checks**: Bereits konfiguriert ✅
5. **Resource Limits**: Pro Service setzen (CPU, Memory)

### Schritt 4: Environment Variables Mapping

**Gemeinsame Variables (für alle Services):**
- `DATABASE_URL` - PostgreSQL Connection
- `REDIS_URL` - Redis Connection
- `QDRANT_URL` - Qdrant Connection
- `NEO4J_URI`, `NEO4J_USER`, `NEO4J_PASSWORD` - Neo4j Connection
- `APP_ENV=production`

**Service-spezifische Variables:**
- `web`: `NEXT_PUBLIC_BASE_PATH`, `NEXT_PUBLIC_PERSONA_BACKEND_URL`, `NEXT_PUBLIC_CHAT_API_URL`
- `api`: `OPENAI_API_KEY`, `CLAUDE_API_KEY`
- `chat-api`: `OPENAI_API_KEY`, `INDEXING_API_URL`
- `indexing-api`: (keine zusätzlichen)
- `celery-worker`: `OPENAI_API_KEY`, `CLAUDE_API_KEY`
- `celery-beat`: (keine zusätzlichen)

---

## Konkrete Schritte für Migration

### Option A: Schrittweise Migration (Empfohlen)

1. **Starte mit einem Service**: Z.B. `web` als eigenständiger Service
2. **Teste**: Prüfe, ob alles funktioniert
3. **Migriere weitere Services**: Einer nach dem anderen
4. **Behalte Docker Compose**: Für lokale Entwicklung

### Option B: Komplette Migration

1. **Erstelle alle Services in Coolify**
2. **Konfiguriere Environment Variables**
3. **Aktiviere "Connect To Predefined Network"**
4. **Teste alle Services**
5. **Lösche Docker Compose Deployment**

---

## Beispiel: Service-Konfiguration in Coolify

### Web Service

**Build:**
- Source: GitHub Repository
- Dockerfile: `apps/web/Dockerfile`
- Build Context: Repository Root

**Environment Variables:**
```
NODE_ENV=production
NEXT_PUBLIC_BASE_PATH=/audion
NEXT_PUBLIC_PERSONA_BACKEND_URL=http://api:8000
NEXT_PUBLIC_CHAT_API_URL=http://chat-api:8001
```

**Network:**
- "Connect To Predefined Network" aktivieren

**Health Check:**
- Endpoint: `http://localhost:3000/api/health`
- Interval: 30s
- Timeout: 10s
- Retries: 3

### API Service

**Build:**
- Source: GitHub Repository
- Dockerfile: `apps/api/Dockerfile`
- Build Context: Repository Root

**Environment Variables:**
```
DATABASE_URL=<postgres-connection-string>
REDIS_URL=<redis-connection-string>
QDRANT_URL=http://qdrant:6333
NEO4J_URI=bolt://neo4j:7687
NEO4J_USER=neo4j
NEO4J_PASSWORD=<password>
OPENAI_API_KEY=<key>
CLAUDE_API_KEY=<key>
APP_ENV=production
```

**Network:**
- "Connect To Predefined Network" aktivieren

**Health Check:**
- Endpoint: `http://localhost:8000/health`
- Interval: 30s
- Timeout: 10s
- Retries: 3

---

## Entscheidungshilfe

### Wähle Docker Compose, wenn:
- ✅ Du willst einfache Konfiguration
- ✅ Alle Services haben ähnliche Skalierungsanforderungen
- ✅ Du entwickelst lokal und willst schnelles Setup
- ✅ Du hast keine Probleme mit dem aktuellen Setup

### Wähle Einzelne Services, wenn:
- ✅ Du hast Probleme mit dem aktuellen Setup (z.B. Restart-Loops)
- ✅ Du willst besseres Debugging (eigene Logs pro Service)
- ✅ Du willst Services unabhängig skalieren
- ✅ Du willst unabhängige Deployments
- ✅ Du willst bessere Resource-Kontrolle

---

## Nächste Schritte

1. **Entscheide**: Docker Compose oder Einzelne Services?
2. **Falls Einzelne Services**: Beginne mit einem Service (z.B. `web`)
3. **Teste**: Prüfe, ob alles funktioniert
4. **Migriere weitere**: Schrittweise alle Services migrieren

**Empfehlung für dein aktuelles Problem:**
Da du Probleme mit Restart-Loops hast, die schwer zu debuggen sind, würde ich **Einzelne Services** empfehlen. Das würde das Debugging erheblich vereinfachen.

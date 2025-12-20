# Audion Base Path Konfiguration

## Übersicht

Audion wurde so konfiguriert, dass es unter dem Pfad `/audion` läuft, um parallelen Betrieb mit anderen Services auf derselben Maschine zu ermöglichen (z.B. ein anderer Service unter `/dashboard`).

## Konfiguration

### Nginx (`infrastructure/nginx/nginx.conf`)

Alle Audion-Routen wurden von `/` auf `/audion` verschoben:

- **Web App**: `/audion/` → `http://web:3000`
- **Chat API**: `/audion/api/chat` → `http://chat-api:8001`
- **Voice API**: `/audion/api/voice` → `http://chat-api:8001`
- **Persona Backend**: `/audion/api/persona-backend` → `http://persona-api:8000`
- **Indexing API**: `/audion/api/indexing` → `http://indexing-api:8000`

**Wichtig**: Neo4j und Qdrant bleiben global unter `/neo4j/` und `/qdrant/` erreichbar.

### Next.js (`apps/web/next.config.mjs`)

Der `basePath` wurde hinzugefügt:

```javascript
basePath: process.env.NEXT_PUBLIC_BASE_PATH || '/audion'
```

Dies stellt sicher, dass Next.js alle internen Routen und Assets korrekt unter `/audion` serviert.

### Docker Compose (`infrastructure/compose.yml`)

Alle öffentlichen URLs wurden aktualisiert:

```yaml
environment:
  NEXT_PUBLIC_BASE_PATH: /audion
  NEXT_PUBLIC_INDEXING_API_URL: https://192.168.50.101/audion/api/indexing
  NEXT_PUBLIC_CHAT_API_URL: https://192.168.50.101/audion/api/chat
  NEXT_PUBLIC_WS_BASE_URL: wss://192.168.50.101/audion/api/chat
  NEXT_PUBLIC_PERSONA_BACKEND_URL: https://192.168.50.101/audion/api/persona-backend
  NEXT_PUBLIC_PERSONA_BACKEND_DOCS_URL: https://192.168.50.101/audion/api/persona-backend/docs
```

## URLs nach Migration

### Audion Services
- **Web App**: `https://192.168.50.101/audion/`
- **Chat API**: `https://192.168.50.101/audion/api/chat`
- **Voice API**: `https://192.168.50.101/audion/api/voice`
- **Persona Backend**: `https://192.168.50.101/audion/api/persona-backend`
- **Persona Docs**: `https://192.168.50.101/audion/api/persona-backend/docs`
- **Indexing API**: `https://192.168.50.101/audion/api/indexing`

### Globale Services (unverändert)
- **Neo4j Browser**: `https://192.168.50.101/neo4j/browser`
- **Qdrant Dashboard**: `https://192.168.50.101/qdrant/`

## Deployment

Nach den Änderungen müssen folgende Schritte ausgeführt werden:

1. **Nginx neu laden**:
   ```bash
   docker exec persona-nginx nginx -s reload
   ```
   Oder Container neu starten:
   ```bash
   docker-compose restart nginx
   ```

2. **Web-Container neu bauen** (wichtig für basePath):
   ```bash
   docker-compose build web
   docker-compose up -d web
   ```

3. **Services neu starten**:
   ```bash
   docker-compose restart web nginx
   ```

## Testing

Nach dem Deployment sollte überprüft werden:

- ✅ `https://192.168.50.101/audion/` zeigt die Audion-Startseite
- ✅ `https://192.168.50.101/dashboard` zeigt weiterhin den anderen Service
- ✅ API-Endpunkte funktionieren unter `/audion/api/...`
- ✅ WebSocket-Verbindungen funktionieren
- ✅ Alle internen Links und Assets werden korrekt geladen

## Rückgängig machen

Falls die Migration rückgängig gemacht werden soll:

1. Nginx-Konfiguration: Alle `/audion` Routen zurück zu `/` ändern
2. Next.js Config: `basePath` entfernen oder auf `''` setzen
3. Docker Compose: URLs zurück auf `/api/...` ändern
4. Services neu starten

## Datum

Konfiguration erstellt: 2025-12-05



# Chat-API Proxy: socket hang up / ECONNRESET

## Problem

Beim Aufruf von `POST /api/chat/message` erscheint im Web-Log:

```text
Failed to proxy http://chat-api:8001/chat/message Error: socket hang up
code: 'ECONNRESET'
```

Ursache ist oft ein **Timeout**: Next.js beendet beim Rewrite/Proxy standardmäßig nach ca. 30 Sekunden die Verbindung zum Backend. Dauert die Antwort der Chat-API (z. B. durch LLM-Latenz) länger oder bricht das Backend die Verbindung ab, kommt ECONNRESET.

## Lösung im Repo

In **`apps/web/next.config.mjs`** ist das Proxy-Timeout erhöht:

```js
experimental: {
  proxyTimeout: 120 * 1000,  // 120 Sekunden
  // ...
}
```

Damit hat die Chat-API bis zu 2 Minuten Zeit, bevor der Proxy die Verbindung abbricht.

## Wenn es weiter hakt

- **Chat-API stabil halten:** Fehler im Endpoint abfangen und immer eine HTTP-Response senden (nicht abstürzen), damit die Verbindung nicht unerwartet geschlossen wird.
- **Target-Group-Chat:** Mehrere parallele `POST /api/chat/message` können die Chat-API auslasten; ggf. weniger Parallelität oder Retry mit Backoff im Frontend.
- **Logs der Chat-API** prüfen (z. B. `chat.persona_agent.failed`, `chat.message.endpoint.error`), um echte Backend-Fehler von Timeouts zu unterscheiden.

---

## Node DeprecationWarning `util._extend`

Die Meldung:

```text
(node:18) [DEP0060] DeprecationWarning: The `util._extend` API is deprecated. Please use Object.assign() instead.
```

stammt in der Regel aus einer **Abhängigkeit** (oder Node selbst), nicht aus dem Audion-Quellcode. Optionen:

- **Unterdrücken (nur Log):** Server mit `NODE_OPTIONS='--no-deprecation'` starten (z. B. in `package.json`: `"start": "NODE_OPTIONS='--no-deprecation' next start --port 3005"`).
- **Quelle finden:** Mit `node --trace-deprecation ...` starten, dann zeigt der Stacktrace die verursachende Datei.
- **Ignorieren:** Bis zum Update der verursachenden Dependency; die Anwendung läuft trotzdem.

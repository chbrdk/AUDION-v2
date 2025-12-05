# Knowledge Tools & Functions Integration

## Übersicht

Dieses Dokument beschreibt die Implementierung von Tools/Functions für Knowledge-Zugriff im Chat und Extended Variables für Knowledge im Prompt Builder.

## Implementierung Status

### ✅ Abgeschlossen

1. **Knowledge Tools Definition** (`apps/chat-api/app/agents/tools.py`)
   - Definiert Anthropic Tools für Knowledge-Zugriff:
     - `search_knowledge`: Semantische Suche im Knowledge Base
     - `get_target_group_knowledge`: Hole alle Chunks für eine Target Group
     - `get_document_content`: Hole vollständigen Dokumentinhalt

2. **Tool Execution Handler** (`apps/chat-api/app/agents/tool_executor.py`)
   - Implementiert Tool-Execution-Logik
   - Verwendet RetrievalAgent für Knowledge-Suche
   - Unterstützt async Execution

3. **PersonaAgent mit Tools** (`apps/chat-api/app/agents/persona.py`)
   - Erweitert um Tool-Support via Feature Flag
   - Neue Methode `_stream_response_with_tools()` für Tool-basiertes Streaming
   - Backward-kompatibel (bestehender Flow bleibt Standard)

4. **Extended Variable Resolver für Knowledge** (`apps/api/app/services/ai_assist.py`)
   - Neue `_resolve_knowledge()` Methode
   - Unterstützt Query-Strings (nicht nur UUIDs)
   - Formatiert Results basierend auf Property-Path (`.content`, `.results`)

5. **Knowledge Extended Variables** (`apps/web/components/prompt-builder/variableDefinitions.ts`)
   - `${knowledge:${query}.content}` - Content der Top-Results
   - `${knowledge:${query}.results}` - Strukturierte JSON-Results
   - `${knowledge:${target_group_id}.content}` - Alle Chunks einer Target Group

6. **Mock Data für Knowledge** (`apps/web/components/prompt-builder/mockData.ts`)
   - Mock-Daten für Preview im Prompt Builder

7. **Feature Flag** (`apps/chat-api/app/core/config.py`)
   - `chat_use_tools: bool = False` - Default: False für Backward-Kompatibilität

### 🔄 Verbleibend / Optional

1. **Chat Router Anpassungen** (`apps/chat-api/app/routers/chat.py`)
   - Feature Flag Integration in `send_message_stream()`
   - Persona Segment Parameter hinzufügen
   - Tools nur aktivieren wenn `use_tools=True`
   - Bestehender Flow bleibt Standard

2. **Tool-Call-Anzeige in Chat UI** (`apps/web/app/admin/chat/page.tsx`)
   - Optional: Zeige Tool-Calls und -Results in der UI
   - Ähnlich wie Sources-Event

3. **Unit Tests**
   - Tool Executor Tests
   - Extended Variable Resolver Tests für Knowledge

## Verwendung

### Extended Variables im Prompt Builder

```yaml
prompt: |
  Analysiere folgende Knowledge-Informationen:
  
  ${knowledge:${query}.content}
  
  Basierend darauf, erstelle Vorschläge...
```

**Verfügbare Syntaxen:**
- `${knowledge:${query}.content}` - Content der Top-5 Results (newline-separated)
- `${knowledge:${query}.results}` - Strukturierte JSON-Results mit score, document_id
- `${knowledge:${target_group_id}.content}` - Alle Chunks einer Target Group

### Tools im Chat (via Feature Flag)

Um Tools im Chat zu aktivieren:

```bash
export CHAT_USE_TOOLS=true
```

Oder in `.env`:
```
CHAT_USE_TOOLS=true
```

**Hinweis:** Die Chat Router Integration ist noch nicht vollständig implementiert. Siehe "Verbleibend" oben.

## Technische Details

### Knowledge Tools

Die Tools sind als Anthropic Tool Definitions definiert und folgen dem JSON Schema Format:

```python
KNOWLEDGE_TOOLS = [
    {
        "name": "search_knowledge",
        "description": "...",
        "input_schema": {
            "type": "object",
            "properties": {
                "query": {"type": "string"},
                "limit": {"type": "integer", "default": 5},
                "persona_segment": {"type": "string", "nullable": True}
            }
        }
    },
    # ...
]
```

### Extended Variable Resolution

Knowledge-Variablen werden im `_ExtendedVariableResolver` aufgelöst:
1. Query/ID aus Context extrahieren
2. RetrievalAgent für Suche verwenden
3. Results basierend auf Property-Path formatieren
4. String-Repräsentation zurückgeben

## Unterschiede

### Tools (Chat)
- **Dynamisch**: LLM entscheidet, wann Knowledge abgerufen wird
- **On-demand**: Nur wenn nötig
- **Streaming**: Tool-Calls während des Streams
- **Kombinierbar**: Mehrere Tools in einem Request

### Extended Variables (Prompt Builder)
- **Statisch**: Wird beim Prompt-Rendering aufgelöst
- **Vorausgeladen**: Alle Knowledge wird vor LLM-Call eingefügt
- **Sichtbar**: User sieht genau, welche Knowledge verwendet wird

## Best Practices

1. **Extended Variables** verwenden für:
   - Prompts, die immer bestimmte Knowledge benötigen
   - Wenn Knowledge-Context explizit sichtbar sein soll
   - Für bessere Kontrolle über verwendete Knowledge

2. **Tools** verwenden für:
   - Dynamische Chat-Konversationen
   - Wenn LLM entscheiden soll, welche Knowledge relevant ist
   - Für bessere Performance (keine großen Prompts)

3. **Performance**: Tools sparen Tokens, da Knowledge nur on-demand geladen wird

## Migration

Die Implementierung ist backward-kompatibel:
- Default: Bestehender RAG-Ansatz (automatisches Retrieval)
- Mit Feature Flag: Tools-basiert
- Beide Ansätze können parallel existieren

## Nächste Schritte

1. Chat Router Integration vervollständigen
2. Testing & Refinement der Tool-Execution
3. Optional: UI für Tool-Call-Anzeige
4. Dokumentation erweitern mit Beispielen


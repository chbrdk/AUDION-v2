# Wofür Qdrant im Chat gebraucht wird

## Kurzantwort

**Der Single-Persona-Chat funktioniert auch ohne Qdrant.** Qdrant wird nur für die **„Sources“ / RAG-Funktion** genutzt – also um Antworten mit Projekt- oder Forschungs-Kontext anzureichern und Quellen anzuzeigen. Wenn Qdrant fehlt oder 401 liefert, laufen wir mit leeren Sources weiter; die Persona antwortet nur aus System-Prompt und Konversation.

## Wofür Qdrant konkret genutzt wird

1. **Retrieval im Chat (RAG)**  
   - Die Chat-API holt über den `RetrievalAgent` passende Chunks aus der Qdrant-Collection `research_chunks` (Dokumente, die vorher über die Indexing-API eingespielt wurden).  
   - **Streaming:** Diese Chunks werden als „Relevant context“ in den User-Content eingebaut → die Persona kann aus diesem Kontext antworten.  
   - **Non-Streaming (POST /message):** Die Chunks werden nur als `sources` in der Response mitgeliefert → Anzeige „Sources“ in der UI; der LLM-Prompt enthält sie in diesem Pfad nicht.  
   - Wenn Retrieval fehlschlägt (z. B. 401, FlagEmbedding-Problem), nutzen wir `sources = []` und der Chat läuft weiter.

2. **Persona Discovery**  
   - `PersonaDiscoveryService` nutzt Qdrant, um aus den gleichen `research_chunks` Persona-Kandidaten zu finden (z. B. für „Personas aus Research entdecken“).  
   - Wenn du diese Funktion nicht nutzt, brauchst du Qdrant dafür nicht.

## Wann du Qdrant weglassen kannst

- Du willst nur mit einer Persona chatten und keine Dokumente/Research als Kontext oder Quellen.  
- Du nutzt keine „Persona Discovery“-Features.  
- Dann reicht: Chat ohne Qdrant (kein `QDRANT_URL` / keine laufende Qdrant-Instanz). Die Chat-API macht dann keinen erfolgreichen Retrieval-Call, liefert leere Sources und der Chat funktioniert wie gewohnt.

## Wann Qdrant sinnvoll ist

- Du lädst Dokumente hoch und willst, dass die Persona aus diesem Wissen antwortet (RAG).  
- Du willst in der Chat-UI „Sources“ / Zitate anzeigen.  
- Du nutzt Persona Discovery aus Research-Daten.

## Optional: Retrieval ganz abschaltbar machen

Falls gewünscht, kann man einen Config-Flag einführen (z. B. `chat_retrieval_enabled: bool = True`). Wenn `False`, wird der Retrieval-Call gar nicht ausgeführt (kein Qdrant, kein FlagEmbedding), und es werden immer leere Sources verwendet. So sparst du Latenz und Abhängigkeiten, wenn du die RAG-Funktion nicht brauchst.

# Dynamic Persona Chat - Core Concept

## Vision
Ein Chat, der **während der Konversation** automatisch Personas aus Research-Daten erstellt und sie sofort befragbar macht. User uploaded Dokumente → AI erkennt Personas → User chattet direkt mit ihnen.

---

## Core Flow

### 1. Document Upload → Instant Processing
```
User uploads Research (PDF, DOCX, PPTX, Audio) 
    ↓
Hintergrund-Processing (2-5 Minuten):
  - Parse documents (Unstructured lib)
  - Transcribe audio (Whisper)
  - Extract text from slides (OCR)
  - Semantic chunking (800-1200 tokens)
  - NLP enrichment (entities, sentiment, topics via spaCy)
  - Generate embeddings (BGE-M3)
  - Store in Vector DB (Qdrant) + Graph DB (Neo4j)
    ↓
Documents sind durchsuchbar
```

### 2. Dynamic Persona Discovery (During Chat)
```
User startet Chat (kein Persona ausgewählt)
    ↓
User fragt: "Was denken unsere Kunden über Pricing?"
    ↓
System analysiert automatisch:
  1. Embed Query → Search Vector DB
  2. Retrieve relevante Chunks (Top 10-20)
  3. Graph Query: Finde erwähnte Personen + deren Attributes
  4. LLM Call (Claude): "Identify distinct personas in these excerpts"
     → Output: 2-3 Persona-Segmente erkannt
    ↓
System antwortet:
"Ich sehe 3 verschiedene Perspektiven in deiner Research:
 1. Enterprise Buyers (skeptisch, ROI-fokussiert)
 2. Startup Founders (preissensitiv, agil)
 3. Technical Evaluators (detail-orientiert)
 
 Mit wem möchtest du sprechen? Oder soll ich alle 3 Meinungen zeigen?"
    ↓
User wählt: "Enterprise Buyer"
    ↓
System generiert Persona LIVE (30-60 Sekunden):
  - LLM erstellt vollständiges Profil aus relevanten Chunks
  - Persona-Name: "Erik" (generated)
  - System Prompt engineered
  - Persona ist ready
    ↓
Chat continues als "Erik"
```

### 3. Multi-Turn Chat mit dynamischer Persona
```
User: "Erik, was hältst du von unserem API-First Ansatz?"
    ↓
Retrieval Agent:
  - Embed Question
  - Search Vector DB (filtered by persona segment)
  - Search Graph DB (Erik's connected entities: pain points, goals)
  - Retrieve Top 5 most relevant chunks
    ↓
Persona Agent:
  - Build Prompt:
    * System: "Du bist Erik, 47, CFO, skeptisch..."
    * Context: Retrieved chunks + metadata
    * History: Previous conversation
  - Claude API (streaming)
  - Fact-Checker: Validate claims vs data
    ↓
Response streamed to frontend:
"API-First klingt gut auf dem Papier, aber ehrlich gesagt: 
Ich hab das schon dreimal erlebt. Integration war bei uns 
ein 6-Monats-Projekt [1]. Zeigen Sie mir die Exit-Strategie."

[1] Source: Interview_Markus.pdf, p.3 (Confidence: 87%)
```

### 4. On-the-Fly Persona Switching
```
User: "Was würde ein Startup Founder dazu sagen?"
    ↓
System:
  - Erkennt: Neue Persona gewünscht
  - Prüft: Existiert "Startup Founder" bereits?
    - Ja → Load existing persona
    - Nein → Generate new persona (30s)
  - Switch System Prompt
  - Retrieve context für neue Perspektive
    ↓
Chat continues als "Sarah (Startup Founder)"
```

### 5. Multi-Persona Panel (Advanced)
```
User: "Lasst alle 3 diskutieren: Neues Pricing Model"
    ↓
System:
  - Lädt/generiert alle 3 Personas
  - Moderator Agent startet Discussion
  - Round-Robin turns:
    * Erik (skeptisch): "Unpredictable costs = no-go"
    * Sarah (enthusiastisch): "Love usage-based! Saves upfront cost"
    * Tim (analytisch): "Need monitoring tools for transparency"
  - Detect Conflicts & Consensus
  - Generate Summary:
    "Consensus: Monitoring essential
     Conflict: Budget predictability (Erik vs Sarah)
     Recommendation: Offer hybrid model"
```

---

## Technical Implementation

### Stack
**Frontend:** Next.js 15, Vercel AI SDK (streaming), shadcn/ui  
**Backend:** FastAPI, Celery (async jobs), WebSocket (real-time)  
**Databases:** PostgreSQL, Qdrant (vectors), Neo4j (graph), Redis (queue)  
**AI:** Claude API (LLM), BGE-M3 (embeddings, CPU), Whisper (audio, CPU)  
**Deployment:** Docker Compose, CPU-only server

### Key Endpoints

```
POST /documents/upload
→ Triggers async processing job
→ Returns job_id for status polling

GET /documents/{doc_id}/status
→ Returns: processing | completed | failed

WS /chat/{conversation_id}
→ Real-time bidirectional chat

Client sends:
{
  "type": "message",
  "content": "Was denken Kunden über Pricing?"
}

Server streams:
{type: "thinking", status: "Analyzing research..."}
{type: "personas_discovered", personas: [{name: "Erik", segment: "enterprise"}]}
{type: "content_delta", data: "Ich sehe 3 Perspektiven..."}
{type: "sources", chunks: [...]}
{type: "complete"}

POST /personas/generate
Body: {segment: "enterprise_buyer", project_id: "..."}
→ Generates persona from research
→ Returns persona_id + profile

GET /personas/{id}
→ Returns full persona profile + system prompt
```

### Data Flow: Dynamic Persona Creation

```
┌─────────────────────────────────────────────┐
│ User Message: "Was denken Kunden?"          │
└──────────────┬──────────────────────────────┘
               ↓
┌──────────────────────────────────────────────┐
│ Query Analysis Agent                         │
│ - Extract intent: "customer opinion"         │
│ - Extract topic: "pricing"                   │
└──────────────┬───────────────────────────────┘
               ↓
┌──────────────────────────────────────────────┐
│ Retrieval Agent                              │
│ - Embed query                                │
│ - Vector search (Qdrant): Top 20 chunks      │
│ - Graph search (Neo4j): Find Persons + attrs│
└──────────────┬───────────────────────────────┘
               ↓
┌──────────────────────────────────────────────┐
│ Persona Discovery Agent (Claude)             │
│ Prompt: "Analyze these 20 research excerpts. │
│ Identify distinct customer segments/personas.│
│ For each: demographics, pain points, style"  │
│                                              │
│ Output: {                                    │
│   segments: [                                │
│     {name: "Enterprise Buyer",               │
│      traits: {...},                          │
│      chunk_ids: [...],                       │
│      confidence: 0.85}                       │
│   ]                                          │
│ }                                            │
└──────────────┬───────────────────────────────┘
               ↓
┌──────────────────────────────────────────────┐
│ Present to User                              │
│ "Ich sehe 3 Perspektiven:                    │
│  1. Enterprise Buyer (8 mentions)            │
│  2. Startup Founder (5 mentions)             │
│  3. Technical Evaluator (4 mentions)         │
│  Mit wem möchtest du sprechen?"              │
└──────────────┬───────────────────────────────┘
               ↓
┌──────────────────────────────────────────────┐
│ User wählt: "Enterprise Buyer"               │
└──────────────┬───────────────────────────────┘
               ↓
┌──────────────────────────────────────────────┐
│ Full Persona Generation (Claude, 4 calls)    │
│                                              │
│ Call 1: Core Identity                        │
│ → Name, age, job, bio, personality           │
│                                              │
│ Call 2: Detailed Attributes                  │
│ → Daily routine, decision process, concerns  │
│                                              │
│ Call 3: Communication Style                  │
│ → Vocabulary, phrases, typical questions     │
│                                              │
│ Call 4: System Prompt Engineering            │
│ → Behavioral rules, authenticity guidelines  │
│                                              │
│ Result: Persona "Erik" (CFO, 47, skeptisch) │
│ - Stored in DB (personas table)             │
│ - System prompt ready                        │
│ - Confidence: 85%                            │
└──────────────┬───────────────────────────────┘
               ↓
┌──────────────────────────────────────────────┐
│ Chat continues as Erik                       │
│ - All future messages use Erik's system prompt
│ - Retrieval filtered by Erik's segment       │
│ - Responses in Erik's character              │
└──────────────────────────────────────────────┘
```

---

## Prompt Engineering: Dynamic Persona System Prompt

### Template (generiert während Chat)

```
PERSONA IDENTITY:
You are {generated_name}, a {age}-year-old {job_title}.

BACKSTORY (extracted from research):
{ai_generated_bio based on research excerpts}

PERSONALITY TRAITS:
{OCEAN scores extracted from communication patterns}
- Openness: {score}/5
- Conscientiousness: {score}/5
- Extraversion: {score}/5
- Agreeableness: {score}/5
- Neuroticism: {score}/5

COMMUNICATION STYLE:
- Vocabulary: {analyzed from chunks}
- Sentence structure: {analyzed}
- Common phrases: {extracted real quotes}
- Skepticism level: {calculated from sentiment}

KNOWLEDGE BASE:
You know about these topics (extracted from research):
{list of topics with frequencies}

TOP PAIN POINTS (from research):
{ranked list with evidence counts}

TOP GOALS:
{ranked list}

BEHAVIORAL RULES:
- You are NOT a helpful assistant
- You are a real person with opinions and concerns
- Challenge assumptions when appropriate
- Reference your pain points organically
- Use real quotes when relevant (marked with source)
- Express uncertainty if data is thin (confidence: {score}%)
- Stay in character, be authentic

CONTEXT FOR THIS CONVERSATION:
{dynamically retrieved chunks based on current query}

FORBIDDEN:
- Breaking character
- Being overly agreeable
- Ignoring your concerns
- Generic "helpful AI" responses
```

---

## Unique Features

### 1. Zero Setup Time
- User uploaded docs → sofort chatbereit
- Keine manuelle Persona-Konfiguration nötig
- System lernt Personas aus Daten

### 2. Adaptive Persona Pool
- Startet mit 0 Personas
- Erstellt neue on-demand während Chat
- Cached generierte Personas für Re-use
- User kann später verfeinern

### 3. Confidence-Driven Responses
- Jede Aussage hat Confidence Score
- Basierend auf: Anzahl Datenpunkte, Retrieval-Score, Consistency
- Persona sagt: "Darüber habe ich keine Daten" wenn Confidence < 50%

### 4. Living Research
- Neue Docs hochladen → Personas updaten automatisch
- System detektiert: "Erik's Priorities haben sich geändert"
- Version tracking: Persona v1.0 → v1.2

### 5. Transparent AI
- Jede Aussage linked zu Source Chunks
- User kann Quellen inspizieren
- "Based on 23 data points" Badge

---

## User Experience Flow

```
1. USER LANDS ON APP
   ↓
2. "Upload your research" (drag & drop)
   ↓
3. Processing... (2-5 min, kann in background laufen)
   ↓
4. "Start Chat" button appears
   ↓
5. User types: "What do my customers think about pricing?"
   ↓
6. System: "Analyzing research... Found 3 perspectives"
   → Shows 3 persona cards (auto-generated)
   ↓
7. User clicks: "Talk to Enterprise Buyer"
   ↓
8. System: "Generating Erik..." (30s, shows progress)
   ↓
9. Chat opens: "Hi, I'm Erik. What would you like to know?"
   ↓
10. Natural conversation
    - Every response shows confidence + sources
    - User can switch personas mid-chat
    - Can start multi-persona panel anytime
```

---

## Technical Challenges & Solutions

### Challenge 1: Persona Generation Speed
**Problem:** 4 LLM calls = 60-90s  
**Solution:** 
- Show progress ("Analyzing communication style...")
- Stream first response while finishing generation
- Cache common persona archetypes

### Challenge 2: Context Window Limits
**Problem:** Claude 200k tokens, aber wie viel Context per message?  
**Solution:**
- Smart retrieval: Top 5 chunks (max 6k tokens context)
- Summarize long documents
- Prioritize recent + relevant chunks

### Challenge 3: Persona Consistency
**Problem:** Persona könnte Character verlieren über Zeit  
**Solution:**
- System prompt reinforcement
- Personality trait scoring jede Response
- Auto-correction wenn drift detected

### Challenge 4: Multi-Language Research
**Problem:** Research in DE, Chat in EN?  
**Solution:**
- BGE-M3 is multilingual (100+ languages)
- Persona responds in query language
- Sources shown in original language

---

## MVP Features (Must-Have)

✅ Document upload (PDF, DOCX, PPTX, Audio)  
✅ Automatic processing pipeline  
✅ Dynamic persona discovery from research  
✅ On-demand persona generation (single)  
✅ Streaming chat with one persona  
✅ Source attribution  
✅ Confidence scoring  

## Post-MVP (Nice-to-Have)

⏳ Multi-persona panels  
⏳ Persona refinement UI  
⏳ Export conversations  
⏳ Analytics dashboard  
⏳ Voice interface
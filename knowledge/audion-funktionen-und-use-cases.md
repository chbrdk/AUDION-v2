# AUDION – Funktionen, Use Cases und Nutzerwert (Stand: Codebase AUDION-v2)

Kurzbeschreibung: **AUDION** ist eine **Persona-Intelligence-Plattform**. Teams können aus Research-Daten **KI-Personas** ableiten, pflegen und **in natürlicher Sprache befragen** – ergänzt um **Customer Journeys**, **Wissens-/Dokumentenbasis** und **multimodale Gespräche** (Text, **Sprache**, **Video**), damit nicht nur **Hypothesen geprüft**, sondern auch ein **tragfähiges Verständnis der Zielgruppe** aufgebaut wird.

---

## 1. Produktkern (was die Plattform leistet)

| Bereich | Funktion (Ist-Stand im Repo) |
|--------|------------------------------|
| **Organisation** | **Projekte** als Workspace-Grenze; projektbezogene Personas, **mehrere Zielgruppen**, Journeys, Prompts. |
| **Zielgruppen (Target Groups)** | Pro Projekt **mehrere Segmente** parallel (eigener Kontext, Knowledge, Quellen, Personas). Ideal z. B. für **Buyer vs. Nutzer**, **Regionen**, **Preissegmente** oder **Kanäle** – ohne alles in eine Persona zu vermischen. Basis für Persona- und Journey-Generierung **pro Segment**. |
| **Personas** | Manuell anlegen oder **KI-generieren** aus Research; Profil (Bio, Ziele, Pain Points, Kommunikationsstil, Confidence); **Avatar-Bild** (Image-API); **Profilkarte**; Übersetzung von Feldern; Anreicherung (`enrich`); **Moodboards** (Kacheln, Kategorien, Rebuild, Share-URLs). |
| **Research & Ingestion** | **Upload** von Dateien → **Indexing-API** / Jobs: Extraktion, Chunking, Embeddings (**Qdrant**), optionale **Graph-Anbindung** (**Neo4j**); Fortschritt über **Queue**/Job-Status. |
| **Chat (multimodal)** | **Text-Chat** mit Personas (Chat-API, Streaming/WebSocket). **Voice-Chat** über die Chat-API (Spracheingabe/-ausgabe, Voice-Streaming – s. Architektur `Voice API` / `voice`-Router in der Chat-API). **Video-Chat (Tavus CVI)** im Admin-Chat als dritte Option: **gesprächsbasiertes Video** mit einer zum Persona-Profil gemappten **Replica** (`tavus_replica_id` / optional `tavus_persona_id` in den Persona-Metadaten; Session serverseitig über Tavus-API). **Chat-Historie**; **Learnings** (konversationsbasierte Merkpunkte, lokal im Client-Konzept). Hinweis: Öffentlicher Share-Chat unterstützt Tavus im aktuellen Scope nicht. Details: `knowledge/tavus-video-chat.md`. |
| **Customer Journey Maps** | Journeys pro Zielgruppe: Phasen, Elemente, Erwartungen vs. Messungen, **KI-Generierung**, **Validierung gegen Personas** (Fit Scores), Insights (siehe `knowledge/journey_mapper.md`). |
| **AI Assist** | Zentrale **Prompt-Templates** (`templates.yaml`), generischer `/ai-assist`, feature-spezifische Routen (z. B. Journeys, Persona Pain Points); Admin: **Provider**-Health, **Prompts** über Projekte. |
| **Admin & Betrieb** | Dashboard (Vorschau Personas/Zielgruppen), **Queue**/Jobs, **Setup**, **API-Dokumentation** im UI, **Theme/Branding**, Profil & Passwort, i18n (DE/EN). |
| **Integrationen** | **Checkion** (Proxy zum Persona-Backend unter `/integrations/checkion`); **Figma-Plugin** (Auswahl-Screenshot + Persona-Chat); **Research-Stream** (SSE pro Projekt). |
| **Sharing** | Öffentliche/Share-Routen für **Persona-Moodboard** und Kacheln (Next.js API). |

---

## 2. Navigations- und UI-Module (Web-App)

Aus `apps/web/components/admin/msqdx-glass-admin-layout.tsx` und zugehörigen Seiten:

- `/admin` – Dashboard  
- `/admin/chat`, `/admin/chat/history` – Persona-Chat & Verlauf  
- `/admin/projects`, `/admin/projects/[id]`, Projekt-Prompts  
- `/admin/personas`, `/admin/personas/[id]` – Persona-Verwaltung inkl. Moodboard/Avatar/Dokumente  
- `/admin/target-groups`, `/admin/target-groups/[id]` – Zielgruppen & Knowledge  
- `/admin/journeys`, `/admin/journeys/new`, `/admin/journeys/[id]` – Journey Mapper  
- `/admin/profile`, `/admin/settings` (+ Theme, Projects, Providers, API-Docs)  
- `/upload` – Research-Upload mit Processing-Timeline  
- `/chat` – Chat-Oberfläche mit Moodboard-Strip (u. a. für geteilte/kontextuelle Nutzung)  
- `/login`, `/register` – Auth  

---

## 3. Zielgruppen-Verständnis durch Gespräch – Text, Voice, Video (Enablement)

AUDION dient nicht nur der **schnellen Validierung** von Annahmen aus Research, sondern dem **Aufbau eines gemeinsamen mentalen Modells**: „Wie tickt diese Zielgruppe?“ – für Teams, die nicht täglich in Interviews sitzen.

### 3.1 Mehrere Zielgruppen im selben Projekt

- **Parallele Segmente:** In einem Projekt können **verschiedene Target Groups** existieren (z. B. IT-Entscheider, Fachanwender, Einkauf). Jede Gruppe hat **eigenes Wissen**, **eigene Quellen** und **eigene Personas**.  
- **Nutzen fürs Verständnis:** Teams **vergleichen** Reaktionen derselben Idee über **Personas aus unterschiedlichen Zielgruppen** – ohne die Profile zu vermischen. Das unterstützt **Buying Committees**, **Multi-Channel-Ansprache** und **„was gilt für wen?“** in Workshops.  
- **Enablement:** Sales, Marketing und Produkt **trainieren** dieselben Modelle; Onboarding neuer Kolleg:innen wird **konkret** („red mal mit der CFO-Persona und danach mit der Shopfloor-Persona“).

### 3.2 Voice-Chat (Sprache)

- **Was es bringt:** Gespräche **ohne Tippen** – z. B. unterwegs, in **Live-Workshops** oder wenn Sprechen schneller geht als Schreiben. Näher am **natürlichen Interviewfluss** als reines Chatten.  
- **Verständnis-Effekt:** Hören der **Tonalität** der KI-Antwort (über Stimme/Sprachausgabe) kann **Empathie und Memorierung** stärken; Teams **formulieren** ihre Fragen oft spontaner und entdecken so Lücken im eigenen Segmentwissen.  
- **Hinweis technisch:** Voice läuft über die **Chat-API** (Voice-Streaming); bei angebundenem **PLEXON** kann Nutzung mitgeteilt werden (s. `Docs/environment-variables.md` – Chat-API / PLEXON).

### 3.3 Video-Chat mit Persona-Replica (Tavus)

- **Was es ist:** Im **Admin-Chat** optional **Video (Tavus CVI)** – ein **videobasiertes Gespräch** mit einer zum Persona-Profil verknüpften **Replica** (Konfiguration in den Persona-Metadaten, API-Key serverseitig).  
- **Nutzen fürs Zielgruppen-Verständnis (nicht nur Research-Check):**  
  - **Emotionale und soziale Präsenz:** Video wirkt für viele Menschen **näher an „einem Gesprächspartner“** als Text – hilft Stakeholdern, sich **einzufühlen**, ohne echte Nutzer:innen zu beanspruchen.  
  - **Storytelling & Alignment:** Produkt- und GTM-Teams **üben** Pitches, Einwände und Narrative **vor der Kamera** – die Persona reagiert im Rahmen ihres Profils und der Wissensbasis.  
  - **Demos & Kick-offs:** In **Enablement-Sessions** wird die Zielgruppe **sichtbar und hörbar**, nicht nur als Folien-Persona.  
- **Grenzen:** Es bleibt ein **KI-Modell** in einer Persona-Rolle – keine Ersetzung für echte Nutzerforschung bei sensiblen Themen; Replica und Profil müssen **sorgfältig** gepflegt werden.

### 3.4 Kombination: Research + Gespräch

| Modus | Stärke für „Zielgruppe verstehen“ |
|-------|-------------------------------------|
| **Text** | Präzise Fragen, Zitate, schnelles Iterieren, Copy-Paste in Specs. |
| **Voice** | Fluss, Workshop-tauglich, niedrigschwellige Exploration. |
| **Video** | Stakeholder-Einbindung, Übungsszenen, stärkeres „Gefühl“ für die Rolle. |
| **Mehrere Zielgruppen** | Differenzierung: wer widerspricht, wer zustimmt, wer entscheidet? |

---

## 4. Use Cases (geschäftlich / methodisch)

1. **Hypothesen schnell gegen „Zielgruppe“ spiegeln**  
   Research hochladen → Personas generieren oder verfeinern → im Chat **Messaging, Features, Pricing, UX** diskutieren, ohne erst User zu rekrutieren.

2. **Segmente konsistent modellieren – eine oder mehrere Zielgruppen**  
   Pro **Target Group** bündeln sich Wissen und Quellen; darin **mehrere Persona-Varianten** (z. B. skeptisch vs. enthusiastisch). **Parallel** können **mehrere Target Groups** im Projekt existieren (z. B. Entscheider vs. Anwender vs. Partner) – jeweils mit eigenem Kontext; Vergleich erfolgt über **Wechsel der Persona/Zielgruppe**, nicht über vermischte Profile.

3. **Evidence-basierte Antworten (Transparenz)**  
   Architektur und Doku betonen **Retrieval** (Vektoren/Graph) und **Quellenbezug** – sinnvoll für **UX Research**, **Compliance** und **Nachvollziehbarkeit** in Workshops.

4. **Customer Journey aus Daten ableiten und prüfen**  
   Journey **manuell, KI oder hybrid** erzeugen; **Erwartungen vs. Messungen** pflegen; gegen **Personas validieren** (Fit) – Brücke zwischen Research und „lebt die Journey noch?“.

5. **Design- und Produkt-Feedback im Kontext**  
   Figma-Plugin: Auswahl **screenshotten** und **direkt mit Persona** besprechen – weniger Kontextverlust zwischen Design-File und Research.

6. **Skalierung ohne Panel-Kosten**  
   Viele Gespräche mit denselben qualitativ gepflegten Personas; iterative **Prompt-/Template-Anpassung** pro Projekt.

7. **Betrieb & Datenpipeline**  
   Uploads und Hintergrundjobs über **Queue** verfolgen; APIs dokumentiert – für Teams, die eigene Research-Pipelines anbinden.

8. **Sprachbasiertes Arbeiten (Voice)**  
   **Voice-Chat** für **Hands-free**, **Workshop-Runden** oder schnelle **Exploration** – näher am gesprochenen Interview; gut kombinierbar mit **mehreren Personas** hintereinander (z. B. gleiche Frage, andere Zielgruppe).

9. **Zielgruppe „spürbar“ machen (Video / Tavus)**  
   Mit konfigurierter **Tavus-Replica** im **Admin-Chat**: **Video-Gespräch** zur **Stakeholder-Einbindung**, **Pitch-Übung** und **Enablement** – stärkeres **Rollenverständnis** als nur Text; technisch s. `knowledge/tavus-video-chat.md`.

10. **Querschnitt: mehrere Zielgruppen vergleichen**  
   Dieselbe Idee nacheinander mit **Personas aus unterschiedlichen Target Groups** besprechen – **Konflikte** im Buying Committee oder zwischen Nutzer- und Budgetperspektive **explizit** machen.

---

## 5. Konkreter Nutzerwert im Daily Doing

| Rolle / Situation | Was wird im Alltag besser? |
|-------------------|------------------------------|
| **Product Manager / PO** | Schnellere **Priorisierung**: Annahmen mit Personas spielen, bevor Bau oder teure Studien starten; Journeys **schärfen** und mit Messgrößen abgleichen; **mehrere Segmente** ohne Durcheinander. |
| **UX / Research** | Research-Dokumente werden **aktiv nutzbar** (nicht nur Archiv); wiederholbare **Validierungsgespräche**; Transparenz, **woher** eine Aussage kommt. |
| **Marketing / Brand** | **Copy und Positionierung** gegen konsistente Zielgruppen-Personas testen; mehrere Stimmen pro Segment **und** pro **Target Group**. |
| **Design** | **Sofort-Feedback** aus dem Figma-Kontext; Moodboards/Visuelles mit Persona-Stimmung verbinden. |
| **Enablement / Sales-Support** | Einheitliches Bild der Zielkunden; **Text-, Voice- und optional Video-Gespräche** zum **Einüben** von Einwänden, **Live-Demos** der Persona; Onboarding: „sprich mit Segment A, dann Segment B“. |
| **Leadership / Stakeholder** | **Video-Persona** kann **Alignment** erleichtern („so stellen wir uns die Zielgruppe vor“) – ergänzend zu Folien und Research-Auszügen. |
| **Ops / Admin** | Klare **Projekt-/Workspace-Trennung**, Job-Überwachung, konfigurierbare **KI-Provider** und Prompts; Tavus-Keys und Persona-Metadaten zentral über Admin. |

**Kernaussage Nutzen:** Weniger Zeit für Rekrutierung und Moderation, **mehr Iterationen** mit Research-verankerten Personas; **bessere Entscheidungsqualität** durch strukturierte Journeys, Quellen und wiederholbare Dialoge. **Text, Sprache und Video** unterstützen unterschiedliche Lern- und Arbeitstypen und machen **Zielgruppen-Verständnis** für das ganze Unternehmen **greifbarer**.

---

## 6. Abgrenzung (was AUDION nicht ersetzt)

- Kein Ersatz für **echte Nutzerforschung**, wenn es um neue Märkte, hochriskante Innovation oder regulierte Claims geht – Personas **spiegeln** vorhandene Daten und Modelle.  
- **Voice und Video** erhöhen **Nähe und Memorierung**, ändern aber nichts an der Natur des Systems: Es bleibt ein **modelliertes** Zielgruppenbild; Video-Replicas müssen inhaltlich **zum Profil und zur Wissensbasis** passen, sonst entsteht falsches Vertrauen.  
- Qualität = Qualität der **Inputs** (Research, Knowledge) + **Prompt-/Template-Pflege** + **saubere Segmentierung** (welche Zielgruppe spricht gerade?).

---

## 7. Referenzen im Repo

- `README.md` – Architektur und Services  
- `PROJECT_DOCUMENTATION.md` – Tiefe zu Datenfluss, URLs, Target Groups  
- `knowledge/audion-beschreibung.md` – One-Slide Pitch  
- `knowledge/journey_mapper.md` – Journey Feature  
- `knowledge/tavus-video-chat.md` – Video-Chat (Tavus CVI), Konfiguration, Admin-Chat  
- `docs/ai-assist.md` – AI Assist  
- `docs/environment-variables.md` – u. a. Tavus, PLEXON / Chat-API Voice-Reporting  
- `apps/figma-plugin2/README.md` + `knowledge/figma-plugin-integration.md` – Figma  

*Dieses Dokument spiegelt die im Repository sichtbare Funktionalität wider, nicht vertragliche Roadmaps.*

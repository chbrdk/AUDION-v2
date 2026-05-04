# AUDION im Ökosystem – Enablement, CHECKION, PLEXON & Plugin-Strategie

**Ziel dieses Dokuments:** Sales, Enablement und Produkt – eine **globale Einordnung** von AUDION zusammen mit **PLEXON** und **CHECKION**, das **Mehrwertversprechen** des Zusammenspiels und die **Strategie, AUDION in die Werkzeuge des Kunden** zu bringen (Plugins, MCP, APIs).

Ergänzend zur **funktionalen Detailübersicht** siehe: [`audion-funktionen-und-use-cases.md`](./audion-funktionen-und-use-cases.md).

---

## 1. Executive Summary

**AUDION** verwandelt Research und Wissen in **befragbare, konsistente KI-Personas** und **Customer Journeys** – direkt im Browser, per API und **dort, wo Teams ohnehin arbeiten** (Design, Office, KI-Assistenten, interne Boards).

Im **verbundenen Betrieb** mit **PLEXON** und **CHECKION** entsteht ein geschlossener Kreis:

- **CHECKION** liefert **strukturierte Realität vom echten Web** (Scans, Seiten, Topics, Klassifikation) und speist AUDION bei der **Zielgruppen- und Persona-Arbeit** ein – ohne dass Research manuell „nachgebaut“ werden muss.
- **PLEXON** bündelt **Identität** (ein Login, ein Profil), **Abrechnung/Transparenz** (Nutzung → Token) und **kreative Orchestrierung** (Boards), auf denen KI **gleichzeitig** CHECKION- und AUDION-Fähigkeiten nutzen kann.

**Kernbotschaft für Kund:innen:** *„Eure Zielgruppe ist nicht nur ein Dokument – sie wird zum Gesprächspartner in jedem Tool, das ihr freischaltet – mit nachvollziehbarem Research-Kontext und messbarer Nutzung.“*

---

## 2. Die drei Säulen im Überblick

| Säule | Rolle im Ökosystem | Relevanz für den Endnutzer |
|--------|---------------------|----------------------------|
| **AUDION** | Persona Intelligence: Zielgruppen, Personas, Chat, Journeys, Research-Ingestion, AI Assist, Moodboards, optionale Video-Persona (Tavus). | Schnelle **Validierung** von Ideen aus **Nutzerperspektive**; **Journey-Arbeit** mit Research-Anker. |
| **CHECKION** | Qualität & Sichtbarkeit im Web: Scans, Projekte, Journeys (im CHECKION-Sinne), MCP-Tools, API. | **Fakten- und Strukturinput** für AUDION (z. B. Site-Topics aus gescannten Domains); **SEO/GEO/E-E-A-T** und Content-Checks parallel zum Produkt. |
| **PLEXON** | Zentrale **Authentifizierung**, **Nutzerprofil** (Name, Firma, Avatar, Locale), **Usage-Reporting** von AUDION (und vergleichbare Muster für andere Dienste), **Boards** mit KI + MCP-Anbindung. | **Ein Account**, konsistente Identität über Produkte; **Kostenkontrolle**; **Workflows**, in denen AUDION und CHECKION **gemeinsam** von der KI bedient werden. |

---

## 3. Zusammenspiel AUDION ↔ CHECKION (konkreter Mehrwert)

### 3.1 Was technisch passiert (Ist-Stand im Repo)

- AUDION kann CHECKION per API anbinden (`CHECKION_API_BASE_URL`, `CHECKION_API_TOKEN` – siehe zentrale Doku unter `Docs/environment-variables.md`).
- **Site Topics:** AUDION lädt aggregierte **Themen aus CHECKION-Scans** (Tags, Gewichtung, Seitenanzahl) und nutzt sie optional als **Prompt-Kontext** („CHECKION_SITE_TOPICS“) – z. B. bei **Vorschlägen für Zielgruppen und Personas**. Details: [`checkion-site-topics.md`](./checkion-site-topics.md).
- Verknüpfung über **`checkion_project_id`** am AUDION-Projekt: Wenn gesetzt, kann AUDION die **Domain-Zusammenfassung** aus CHECKION nutzen, **ohne** dass zwingend eine separate Research-Seed-URL gesetzt ist.
- Die Web-App stellt einen **BFF-Proxy** bereit: `/api/integrations/checkion/...` → Persona-Backend `integrations/checkion`.

### 3.2 Nutzen aus Anwendersicht

| Ohne Verknüpfung | Mit CHECKION + AUDION |
|------------------|------------------------|
| Personas entstehen vor allem aus **manuell** gepflegten Dokumenten und Interviews. | Zusätzlich: **automatisch extrahierte Schwerpunkte** der **öffentlichen Site** (und gescannter Journey) fließen in Vorschläge ein – **schnellerer Start**, bessere **Abdeckung von „was die Marke nach außen sendet“**. |
| Research und Web-Realität können **auseinanderlaufen**. | **Ein gemeinsames Bild**: CHECKION misst/klassifiziert; AUDION **modelliert Zielgruppen**, die dieses Bild mitdenken können. |

**Wichtig für Kommunikation:** Site-Topics sind **Scanner-Metadaten**, keine verifizierten „User-Zitate“ – sie **unterstützen** die Persona-Arbeit, ersetzen aber keine Tiefe aus qualitativen Studien.

---

## 4. Zusammenspiel AUDION ↔ PLEXON (konkreter Mehrwert)

### 4.1 Identität und Profil

- Optionaler Login **über PLEXON** (`PLEXON_AUTH_URL`, `PLEXON_SERVICE_SECRET`): eine **zentrale Nutzerdatenbank**, synchrones Profil (inkl. **PATCH** an PLEXON bei Änderungen in AUDION).
- Siehe: [`audion-plexon-auth.md`](./audion-plexon-auth.md).

### 4.2 Nutzung und Transparenz

- AUDION meldet **LLM-, Generierungs- und Validierungsereignisse** an PLEXON (`report_usage`), die dort in **Tokens** übersetzt werden – nachvollziehbare **Kosten und Kontingente** für Organisationen.
- Siehe: [`audion-usage-tracking-coverage.md`](./audion-usage-tracking-coverage.md).

### 4.3 PLEXON Board: AUDION + CHECKION in **einer** KI-Session

- Auf dem Board kann pro Prompt-Karte **AUDION MCP** (und parallel CHECKION MCP) aktiviert werden; das Backend **merged** die Tool-Listen, das Modell kann **gezielt** AUDION- oder CHECKION-Tools aufrufen.
- Siehe (PLEXON-Repo): `knowledge/audion-mcp-board-tools.md`.

**Nutzen:** Workshop-Szenarien wie: *„Hole mir die aktuellen Personas und Journeys aus AUDION, vergleiche mit den letzten CHECKION-Scan-Themen und schlage drei Copy-Tests vor.“* – **ohne** zwischen drei UIs zu springen.

---

## 5. AUDION-Funktionen und Use Cases (Kurzfassung)

Ausführlich: [`audion-funktionen-und-use-cases.md`](./audion-funktionen-und-use-cases.md).

**Kernfunktionen:** Projekte, Zielgruppen, Personas (inkl. KI-Generierung, Avatar, Moodboard), Research-Upload & Indexing, Chat & Historie, Customer Journey Maps (inkl. KI, Validierung, Messungen), AI Assist (Templates), Admin/Queue, Integrationen.

**Typische Use Cases:** Hypothesen gegen Zielgruppen spiegeln, Segmente konsistent modellieren, Journeys aus Daten ableiten und prüfen, Design-Feedback im Kontext, skalierbare Dialoge ohne Panel-Kosten.

---

## 6. Strategie: AUDION in **jedes** Kunden-Tool bringen

Die Plattform ist bewusst **mehr als eine Web-App**: dieselbe **Persona- und Journey-Logik** soll in den **Arbeitskontext** – nicht umgekehrt.

### 6.1 Prinzipien

1. **API-first:** FastAPI-Backend, BFF in Next.js – alle Clients sprechen **dieselbe** Wahrheit (Projekte, Personas, Chat, Journeys).
2. **Ein Auth- und Profilmodell** über PLEXON, wo gewünscht – weniger Friktion für Enterprise-Rollouts.
3. **MCP als universeller Stecker** – jeder MCP-fähige Client (Cursor, Claude, interne Orchestrierung, PLEXON Board) erhält **dieselbe** Tool-Semantik (`audion.*`).
4. **Plugins pro Surface:** Wo Nutzer:innen **zeitlich** hängen (Figma, PowerPoint, …), dort **native** oder **Add-in**-Erfahrung mit Selection-Kontext + Persona-Chat.
5. **Discovery / Opal:** Maschinenlesbare **Tool-Kataloge** für Clients, die dynamisch integrieren (siehe API-Router `discovery` im Repo; Deploy-Stand kann variieren – siehe `apps/figma-plugin2/knowledge/audion-in-opal.md`).

### 6.2 Integrationsmatrix (Ist-Stand / Richtung)

| Einstieg | Was der Kunde damit erreicht | Technische Anker im Repo |
|----------|------------------------------|---------------------------|
| **Web-App** | Vollständige Verwaltung, Upload, Admin, Settings | `apps/web` |
| **REST API** | Eigene Portale, Backend-zu-Backend, Mobile später | `apps/api`, `AUDION_API_DOCUMENTATION.md` |
| **AUDION MCP** | KI-Agenten in IDE/Automation rufen Personas, Journeys, AI Assist auf | `mcp-server/` |
| **PLEXON Board + MCP** | Workshop-Karten mit **AUDION + CHECKION** in einer Completion-Pipeline | PLEXON `knowledge/audion-mcp-board-tools.md` |
| **Figma Plugin** | Auswahl screenshotten, mit Persona sprechen, Journeys kontextualisieren | `apps/figma-plugin2/` |
| **PowerPoint Add-in** | Präsentations-/Story-Kontext, Persona-Dialog, Journey-Bezug | `apps/powerpoint-plugin/` |
| **CHECKION angebunden** | Site-Topics & Scans für **reichere** Zielgruppen-/Persona-Vorschläge | `knowledge/checkion-site-topics.md`, API-Integration |
| **Tavus (optional)** | Video-Gespräch mit Persona-Replica | API-Env `TAVUS_*`, `knowledge/tavus-video-chat.md` |

### 6.3 Narrativ für „Plugins überall“

> *„AUDION sitzt nicht in einem Tab – es sitzt **neben** eurem Design, **in** eurer Präsentation und **in** eurem KI-Workflow. Die Personas und Journeys sind **einmal** gepflegt und **überall** dieselben. CHECKION sorgt dafür, dass die **öffentliche Realität** eurer Domain mitdenkt; PLEXON sorgt dafür, dass **Nutzer:innen und Budget** zusammenpassen.“*

---

## 7. Nutzenpyramide (global)

1. **Operativ:** Weniger Kontextwechsel – Feedback und Validierung **am Artefakt**.  
2. **Methodisch:** Research → **lebende Modelle** (Personas, Journeys) statt statischer PDFs.  
3. **Ökonomisch:** Weniger Rekrutierung, mehr Iterationen; **Token-basierte** Transparenz über PLEXON.  
4. **Strategisch:** Ein **durchgängiges Bild** aus Web-Daten (CHECKION), internem Wissen (AUDION-Ingestion) und Team-Workflows (Plugins, Boards).

---

## 8. Typische kombinierte Szenarien (Storytelling)

| Szenario | AUDION | CHECKION | PLEXON |
|----------|--------|----------|--------|
| **„Neues Segment launch“** | Personas + Journey anlegen, Chat-Tests für Messaging | Site-Scan liefert Topics für erste Hypothesen | Ein Login, Usage sichtbar |
| **„Design Review“** | Figma-Plugin: Persona kommentiert Auswahl | Optional: Scan zeigt, ob öffentliche Botschaft passt | Board: KI fasst AUDION + CHECKION zusammen |
| **„Executive Briefing“** | PowerPoint-Add-in: Story gegen Persona spielen | Kennzahlen/Themen aus Domain | Profil & Mandant zentral |
| **„Agentic Workflow“** | MCP: Liste Personas, Journey laden, AI Assist | MCP: Scan-/Seitenkontext | Board oder Cursor als Orchestrator |

---

## 9. Konfiguration & Referenzen (ohne harte URL-Liste)

Zentrale Umgebungsvariablen und Deployment-Hinweise:

- `Docs/environment-variables.md` (AUDION)
- `knowledge/audion-plexon-auth.md`
- `knowledge/audion-usage-tracking-coverage.md`
- `knowledge/checkion-site-topics.md`
- CHECKION: `mcp-server/README.md` (CHECKION MCP)
- PLEXON: `knowledge/audion-mcp-board-tools.md`

---

## 10. Versionierung

- **Inhalt** bezieht sich auf die **Codebases** AUDION-v2, CHECKION und PLEXON im Workspace (Funktionen können sich mit Releases ändern).
- Bei Abweichungen zwischen Doku und Deploy: **Repo / Swagger / deployte Tags** als Quelle der Wahrheit nutzen.

---

*Dokument für internes Enablement und kundenorientierte Erklärung. Keine rechtsverbindliche Zusicherung von Features ohne Vertrag/Release-Notes.*

# EBM Testleitfaden Produktkombinationen → AUDION Reproduktion

**Quelle:** `EBM-Testleitfaden – Produktkombinationen-Tool-200726-065532 (1).pdf`  
(Unmoderierter Remote-UX-Test | Bosch eBike Systems | Testbirds | v1.3)  
**Ziel-URL:** siehe `knowledge/audion-urls-and-paths.md` → `bosch.ebike.produktkombinationen`  
**Stand:** 2026-07-28

## Was der Leitfaden ist

Klassischer **unmoderierter Remote-UX-Test** (Testbirds):

- 15 echte Probanden, Desktop, ~30 Min
- Screen + Audio, Think-aloud (gesprochen, nicht getippt)
- Screener (eBike-Besitzer vs. Kaufinteressenten)
- Freie Exploration + 2 Aufgaben + Likert-Skalen (1–5 / Schulnoten)
- Hypothesen H1–H5 (Komplexität, Matrix-Filter, Journey-Fit, produktnahe Alternative, Segmentunterschiede)

## Was AUDION davon abbilden kann

| Leitfaden-Block | Mit AUDION? | Wie |
|-----------------|-------------|-----|
| Screener / echte User-Rekrutierung | Nein | Personas aus Research approximieren (2 Segmente) |
| Think-aloud Spoken Answers | Teilweise | Persona-Chat (Text/Voice) + Journey-Video Voiceover (Agent-Reasoning, kein echter User) |
| Freie Exploration (~60s) | Teilweise | UX Journey: URL + „Schau dich 60s um, beschreibe Zweck und ersten Eindruck“ |
| Aufgabe 1: Performance Line → kompatible Displays | Ja (explorativ) | UX Journey Task auf Produktkombinationen-URL |
| Aufgabe 2: Kiox 400C + Mini Remote + Cargo Line + Rahmenakku | Ja (explorativ) | Separater UX Journey Run |
| F4 Navigation / Kiox-300-Präferenz | Teilweise | Chat-Fragen an Personas + optional Journey auf Produktseite |
| Quantitative Skalen Q1–Q7 | Approximation | Persona-Chat um Ratings bitten; **keine** statistisch vergleichbare Stichprobe |
| Hypothesen H1–H5 validieren | Soft-Validierung | Scorecard + Persona-Fit + qualitative Aussagen; kein Ersatz für n=15 Remote-Studie |
| Pass/Fail-Regression der Tool-Logik | Nein | Kein Assertion-/Matrix-Engine |

## Empfohlener Repro-Pfad in AUDION

1. **Zwei Target Groups / Personas:** eBike-Besitzer (Nachrüst-Interesse) vs. Kaufinteressent; Technik-Affinität laut F1.4 spiegeln.
2. **Fertige Tasks + Runner (vorbereitet):**
   - Task-Pack: `knowledge/ebm-produktkombinationen-journey-tasks.json`
   - URL-Keys: `knowledge/urls.json` (`bosch.ebike.produktkombinationen`, `audion.uxJourneyAgent.local`)
   - Runner: `scripts/run-ebm-produktkombinationen-journeys.py`
   - Tests: `python3 -m unittest tests.test_ebm_produktkombinationen_journeys`
3. **Agent starten** (Docker Desktop/OrbStack nötig):
   ```bash
   docker compose up -d ux-journey-agent
   # LLM-Key in .env: ANTHROPIC_API_KEY oder OPENAI_API_KEY
   ```
4. **Drei Runs sequentiell starten** (Agent: ein Job zur Zeit):
   ```bash
   python3 scripts/run-ebm-produktkombinationen-journeys.py
   # nur Payload prüfen:
   python3 scripts/run-ebm-produktkombinationen-journeys.py --dry-run
   ```
   Ergebnisse: `test-results/ebm-produktkombinationen-journeys/`
   Alternative UI: `/admin/ux-journey-agent` mit denselben Tasks aus dem JSON.
5. **Danach Persona-Chat** mit den Leitfaden-Fragen F2–F5 und Q1–Q7 (als qualitative Soft-Scores).
6. Optional: Runs in Persona-UX-History speichern / zu Journey konvertieren.

Outputs: Video, Steps, Scorecard (`frictionScore`, `personaFitScore`) – **explorative UX-Evidenz**, kein 1:1-Ersatz der Testbirds-Studie.

## Grenzen (klar kommunizieren)

- Keine echten Nutzer, kein echtes Mikrofon-Think-aloud der Probanden
- Keine Screener-Quota / keine statistische Auswertung n=15
- Agent kann die Matrix falsch bedienen oder „Erfolg“ vortäuschen – manuell gegen Video prüfen
- Hypothesen nur **richtungsweisend**, nicht methodisch äquivalent zur Originalstudie

# Testing Report: EBM Produktkombinationen-Tool (AUDION Reproduktion)

**Datum:** 2026-07-30  
**Methode:** Persona-gesteuerte UX Journey Agent Runs via AUDION MCP  
**Quelle Leitfaden:** EBM-Testleitfaden Produktkombinationen-Tool v1.3 (Testbirds, unmoderiert)  
**Ziel-URL:** `https://www.bosch-ebike.com/de/service/produktkombinationen` (Key: `bosch.ebike.produktkombinationen`)  
**MCP:** `https://mcp-audion.projects-a.plygrnd.tech` (Key: `audion.mcp.playground`)  
**AUDION Web:** `https://audion.projects-a.plygrnd.tech`

---

## 1. Executive Summary

Die Leitfaden-Aufgaben wurden als **drei sequentielle UX-Journey-Runs** gegen die Live-Seite ausgeführt. Ergebnis:

| Urteil | Detail |
|--------|--------|
| **Teilweise reproduzierbar** | Aufgabe 1 (Performance Line → Displays) lieferte inhaltlich brauchbare Agenten-Evidenz |
| **Infrastruktur-Blocker** | CloudFront **403** blockiert den Agenten häufig → A und C nicht belastbar |
| **Kein 1:1-Ersatz** | Keine echten Probanden, keine Q1–Q7-Stichprobe n=15, kein Screen+Audio der Nutzer |

**Kernbefund aus dem validen Run B:** Das Tool zeigt eine dreispaltige Matrix (Drive Units / Akkus / Displays). Nach Auswahl von Performance Line bleiben Displays zunächst grau, bis zusätzlich ein Akku gewählt wird — das bestätigt Hypothesen zu **Matrix-Komplexität (H1)** und **unklarer Filterlogik (H2)**.

**Vergleichbare Auswertung (Wave):** `knowledge/ebm-produktkombinationen-evaluation-audion-2026-07-30.json`  
Nächste Wave dagegen diffen: `python3 scripts/compare-ebm-evaluations.py <baseline.json> <neue.json>`  
**vs. Testbirds n=17:** `knowledge/ebm-produktkombinationen-testbirds-vs-audion-2026-07-30.md` (+ `.json`)

---

## 1b. Vergleichende Auswertung (Wave `audion-2026-07-30-mcp`)

Maschinenlesbare Soft-Evaluation für Wave-zu-Wave-Vergleich. Skalen analog Leitfaden; **keine** Testbirds-Stichprobe.

### Aggregat-KPIs

| KPI | Wert | Vergleichsrichtung |
|-----|------|--------------------|
| taskCompletionRate | **0.33** (1/3) | höher = besser |
| validEvidenceRate | **0.33** (1/3) | höher = besser |
| infrastructureBlockRate | **1.0** | niedriger = besser |
| meanFrictionValidOnly | **9.0** | niedriger = besser |
| meanPersonaFitValidOnly | **2.0** | höher = besser |
| Segmente mit valider Evidenz | owner_upgrade | purchase_intent fehlt |

### Runs im Vergleich

| Run | Segment | taskCompleted | validEvidence | Friction | Fit | Blocker |
|-----|---------|---------------|---------------|----------|-----|---------|
| A Erstkontakt | owner | nein | nein | 10 | 0 | 403 |
| B Aufgabe 1 | owner | **ja** | **ja** (Caveat) | 9 | 2 | 403 intermittent |
| C Aufgabe 2 | buyer | nein | nein | — | — | 403 + Archive |

**Lesart A vs B vs C:** Nur B trägt zur UX-Interpretation bei. A und C messen vor allem Infrastruktur-Zugriff, nicht Tool-UX. Ein Retest ist erst vergleichbar, wenn `validEvidenceRate` steigt und C für `purchase_intent` valide wird (H5).

### Soft-Scores Q1–Q7 (evidenzbasiert aus validem Run B)

| Frage | Skala | Soft-Score | Confidence | Kurzbegründung |
|-------|-------|------------|------------|----------------|
| Q1 Nützlichkeit | 1–5 | **3** | 0.45 | Antwort möglich, hoher Aufwand |
| Q2 Bedienbarkeit | 1–5 | **2** | 0.55 | Matrix nicht intuitiv |
| Q3 Filterlogik | 1–5 | **2** | 0.60 | Ausblend-Logik unklar |
| Q4 Auffindbarkeit | 1–5 | — | 0 | nicht getestet |
| Q5 Produktnah vs Tool | Choice | produktseite_bevorzugt_vermutet | 0.35 | H4-Richtung |
| Q6 Nutzungswahrscheinlichkeit | 1–5 | **2** | 0.40 | hohe Friction |
| Q7 Gesamteindruck | 1–6 Note | **4** | 0.45 | ausreichend |

### Hypothesen-Scores (vergleichbar)

| ID | Verdict | score (−1…1) | Confidence |
|----|---------|--------------|------------|
| H1 Komplexität | supported | **1** | 0.55 |
| H2 Filter unklar | supported | **1** | 0.65 |
| H3 Next Step | inconclusive | **0** | 0.25 |
| H4 Produktnah | partially_supported | **0.5** | 0.40 |
| H5 Segmentdifferenz | not_tested | — | 0 |

### Scorecard-Kategorien: A vs B

Nur Kategorien mit Wert in beiden Runs; Δ = B − A (positiv = Verbesserung).

| Kategorie | A | B | Δ |
|-----------|---|---|---|
| layout | −5 | 0.22 | +5.22 |
| visual | −5 | 0.56 | +5.56 |
| typography | −3 | 1.25 | +4.25 |
| copy | −3 | 1.5 | +4.5 |
| affordance | −5 | −0.67 | +4.33 |
| navigation | −3.67 | −1.56 | +2.11 |
| info_density | −5 | −0.5 | +4.5 |
| trust | −4 | −1.89 | +2.11 |
| performance | −4.67 | −2.85 | +1.82 |
| persona_fit | −3.67 | −2 | +1.67 |

**Hinweis:** Der große Sprung A→B spiegelt vor allem „Seite erreichbar vs. 403“ wider, nicht allein UX-Feinschliff. Für Retests besser **nur validEvidence-Runs** vergleichen.

### Leitfaden-Fragen Coverage

| Status | Fragen |
|--------|--------|
| blocked | F2.1, F2.2, F3.5–F3.9 |
| covered / partial | F3.1–F3.4 |
| soft_scored | Q1–Q3, Q5–Q7 |
| missing / not_run | Q4, F4.*, F5.* |

---

## 2. Wo die Ergebnisse liegen

### 2.1 AUDION UI (neu angelegt)

| Objekt | Link |
|--------|------|
| **Projekt** | https://audion.projects-a.plygrnd.tech/admin/projects/28ece310-66c3-46d0-b5c7-e3acfc3a7567 |
| **Persona Alex Nachrüster** (Besitzer) | https://audion.projects-a.plygrnd.tech/admin/personas/5708c931-5695-42ca-9d97-f303e763cc1d |
| **Persona Sam Kaufinteressent** | https://audion.projects-a.plygrnd.tech/admin/personas/e52eeb57-3e48-4ed5-b8f2-5680d4d3f674 |
| **UX Journey Agent** | https://audion.projects-a.plygrnd.tech/admin/ux-journey-agent |

IDs auch in `test-results/ebm-produktkombinationen-journeys/audion-binding.json`.

### 2.2 Lokale Artefakte

Ordner: `test-results/ebm-produktkombinationen-journeys/`

| Datei | Inhalt |
|-------|--------|
| `summary.json` | Job-IDs aller Runs |
| `*-result.json` | Volle Agent-Results inkl. Steps + Scorecard |
| `*-done.md` / Extrakte | Narrative (soweit vorhanden) |
| `audion-binding.json` | Projekt-/Persona-/Upsert-IDs |

### 2.3 Job-IDs (MCP / Agent)

| Run | jobId |
|-----|-------|
| A Erstkontakt | `31fd7347-8dc5-41e1-b9c7-8f36ef0811bc` |
| B Aufgabe 1 | `26afaddb-a73e-4f7f-8f80-4e2168a0685b` |
| C Aufgabe 2 | `038afe67-5ef3-40f3-9386-8ea604e35621` |

Video-Pfade relativ zum Agent: `/run/{jobId}/video` (über MCP `audion.ux_journey_run_video_finalize` / Admin-UI).

---

## 3. Personas & Zielgruppen (Status)

**Zuerst:** Runs liefen nur mit **ephemeralen Persona-Dicts** im Agent-Request — **nicht** als AUDION-Personas.

**Danach (2026-07-30):** in AUDION angelegt und Runs verknüpft:

| Typ | Name | ID |
|-----|------|-----|
| Projekt | EBM Produktkombinationen UX-Test | `28ece310-66c3-46d0-b5c7-e3acfc3a7567` |
| Zielgruppe | eBike-Besitzer Nachrüst-Interesse | `0e6e4dc6-8ee8-4f0c-8809-c155a1ac88a7` |
| Zielgruppe | eBike Kaufinteressenten | `6bebfe45-c7d1-44cc-a3b3-7963326f1f6b` |
| Persona | Alex Nachrüster | `5708c931-5695-42ca-9d97-f303e763cc1d` |
| Persona | Sam Kaufinteressent | `e52eeb57-3e48-4ed5-b8f2-5680d4d3f674` |

UX-Runs an Personas angehängt (Upsert):

- Alex: A + B  
- Sam: C  

---

## 4. Sessionstruktur vs. Ausführung

| Leitfaden-Block | AUDION-Umsetzung | Status |
|-----------------|------------------|--------|
| 0 Begrüßung / Instruktion | nicht nötig (Agent) | n/a |
| 1 Screening | 2 Zielgruppen + Personas | angelegt |
| 2 Erstkontakt | Run A | **fail** (403) |
| 3 Aufgabe 1 Nachrüsten | Run B | **ok** (mit 403-Umweg) |
| 3 Aufgabe 2 Kombination | Run C | **fail** (403 / Archive) |
| 4 Bewertung / Journey | nicht als Chat-Q1–Q7 | ausstehend |
| 5 Abschluss / Skalen | nicht | ausstehend |

---

## 5. Run-Ergebnisse im Detail

### 5.1 Run A — Erstkontakt (`A-erstkontakt`)

| Metrik | Wert |
|--------|------|
| Status | complete |
| Agent success | true (Aufgabe inhaltlich **nicht** erfüllt) |
| Steps | 6 |
| frictionScore | **10** (max. Reibung) |
| personaFitScore | 0 |
| goalReached | false |

**Befund:** Persistenter CloudFront **403**. Keine Aussagen zu F2.1/F2.2 möglich.

**Scorecard-Kategorien (Auswahl):** layout −5, visual −5, affordance −5, navigation −3.67, trust −4.

### 5.2 Run B — Aufgabe 1 Nachrüsten (`B-aufgabe1-nachruesten`) — belastbarste Evidenz

| Metrik | Wert |
|--------|------|
| Status | complete |
| Agent success | true |
| Steps | 20 |
| frictionScore | **9** |
| personaFitScore | 2 |
| goalReached | true (laut Scorecard, mit Caveat) |

**Caveat Scorecard:** „Ziel erst nach massivem technischem Umweg (403, Wayback, JS-Debugging); ein echter Nutzer hätte abgebrochen.“

**Beobachtetes Verhalten (Agent-Narrativ):**

1. Drei Spalten: Drive Units / Akkus / Displays & Bedieneinheiten  
2. Klick **Performance Line** → Karte hervorgehoben, Displays bleiben grau  
3. Zusätzlich **PowerTube 625** gewählt → Displays splitten in hell (kompatibel) / ausgegraut  
4. Extrahierte kompatible Displays: **Purion 200, LED Remote, Kiox 400C, System Controller**  
5. Als inkompatibel u. a.: Mini Remote, Kiox 300, Kiox 500, Purion 400, SmartphoneGrip, Intuvia 100  

**Scorecard-Kategorien (B):**

| Kategorie | Score |
|-----------|-------|
| copy | +1.5 |
| typography | +1.25 |
| visual | +0.56 |
| layout | +0.22 |
| info_density | −0.5 |
| affordance | −0.67 |
| navigation | −1.56 |
| trust | −1.89 |
| persona_fit | −2 |
| performance | −2.85 |

### 5.3 Run C — Aufgabe 2 Kombination (`C-aufgabe2-kombination`)

| Metrik | Wert |
|--------|------|
| Status | complete |
| Agent success | **false** |
| Steps | 31 |
| Scorecard KPIs | fehlend / unvollständig |

**Befund:** Erneut 403; Agent wich auf `web.archive.org` aus. **Kein valides Kompatibilitätsurteil** für Kiox 400C + Mini Remote + Cargo Line + leistungsfähigen Rahmenakku.

---

## 6. Hypothesen H1–H5 (Soft-Validierung)

| Hypothese | Evidenz aus Runs | Einschätzung |
|-----------|------------------|--------------|
| **H1** Tool wirkt komplex/überfordernd | B: zusätzliche Akku-Auswahl unerwartet nötig; hohe friction (9); Coverage-Caveat „echter Nutzer hätte abgebrochen“ | **unterstützt** (schwach, 1 Run) |
| **H2** Matrix-Filter unklar | B: Displays bleiben grau bis zweite Kategorie gewählt; Agent musste CSS-Klassen per JS prüfen | **unterstützt** |
| **H3** kein natürlicher Next Step | A/C blockiert; B-Narrativ endet bei Display-Liste, Next-Step-Fragen unvollständig im Done-Text | **ungeklärt** |
| **H4** produktnahe Antwort reicht oft | B: Nutzerfrage „welche Displays?“ beantwortet nach Umweg — aber Matrix bleibt Einstieg | **teilweise** (Aufgabe erfüllbar, Journey unklar) |
| **H5** Segmente bewerten unterschiedlich | Personas angelegt, aber nur 1 belastbarer Run (Alex); kein Vergleichschat | **nicht getestet** |

---

## 7. Vergleich zur Originalmethode

| Aspekt | Testbirds-Leitfaden | Diese AUDION-Reproduktion |
|--------|---------------------|---------------------------|
| Stichprobe | 15 echte Probanden | 2 KI-Personas / 3 Agent-Runs |
| Think-aloud Audio | Screen + Stimme | Agent-Reasoning + optional Video-Voiceover |
| Screener | F1.1–F1.4 | Zielgruppen approximiert |
| Aufgaben | 2 | 2 (1 valide) |
| Quantitative Skalen | Q1–Q7 | nicht erhoben |
| Statistik | geplant | keine |

---

## 8. Empfehlungen

1. **CloudFront 403 lösen** (Whitelist Agent-IP / residential Proxy / Cookie-Consent-Flow), sonst keine belastbaren Retries für A/C.  
2. **Run C wiederholen**, sobald Zugang stabil.  
3. **Persona-Chat** mit Alex/Sam für F4/F5 und Soft-Scores Q1–Q7.  
4. UX-Findings aus B in Workshop mit Produkt: „Warum muss Akku gewählt werden, bevor Displays sinnvoll reagieren?“  
5. Optional: Runs in Persona-UI zu Customer Journeys konvertieren.

---

## 9. Reproduktion

```bash
export AUDION_API_TOKEN=…   # nie committen
python3 scripts/run-ebm-produktkombinationen-journeys.py --via-mcp
python3 -m unittest tests.test_ebm_produktkombinationen_journeys
```

Task-Pack: `knowledge/ebm-produktkombinationen-journey-tasks.json`  
URLs: `knowledge/urls.json`  
Methodik: `knowledge/ebm-produktkombinationen-ux-test-mit-audion.md`  
**Auswertung/Baseline-Wave:** `knowledge/ebm-produktkombinationen-evaluation-audion-2026-07-30.json`  
**Wave vergleichen:** `python3 scripts/compare-ebm-evaluations.py <baseline.json> <neue.json>`

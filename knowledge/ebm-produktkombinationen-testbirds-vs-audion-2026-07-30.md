# Vergleich: Testbirds-Auswertung vs. AUDION Soft-Reproduktion

**Quellen**
- Testbirds: `EBM-Auswertung UX Test 'Produktkombinationen & Nachrüsten'-200726-065814.pdf` (n=17, Desktop, unmoderiert)
- AUDION: Wave `audion-2026-07-30-mcp` → `knowledge/ebm-produktkombinationen-evaluation-audion-2026-07-30.json`
- Maschinenlesbar: `knowledge/ebm-produktkombinationen-testbirds-vs-audion-comparison.json`

## Kurzfazit

AUDION trifft die **In-Tool-Reibungen** (Akku-Zwischenwahl, Ausgrauung ohne Erklärung, Aufgabe 1 lösbar aber mühsam) gut.  
Es **verfehlt** die stärksten strategischen Testbirds-Befunde (**Auffindbarkeit/Journey H3**, **Segmentdifferenz H5**) und bewertet Soft-Scores **zu pessimistisch** gegenüber echten Owner-Mittelwerten.

| Dimension | Testbirds | AUDION | Alignment |
|-----------|-----------|--------|-----------|
| Stichprobe | 17 echte Nutzer | 1 valider Agent-Run | nicht vergleichbar n |
| H1 Komplexität | 🟡 teilweise (wissensabhängig) | supported | partial |
| H2 Filter/Matrix | 🟡 teilweise | supported | strong (Härtegrad anders) |
| H3 Journey/Next Step | 🔴 bestätigt | inconclusive | **missed** |
| H4 Produktnah vs Matrix | 🟡 teilweise / Zwei-Wege | partially_supported | match |
| H5 Segmente | 🟢 bestätigt | not_tested | **missed** |

---

## Hypothesen im Detail

### H1 – Komplexität
- **Testbirds:** Nicht pauschal überfordernd. Experten/Nachrüster kommen klar; Einsteiger/Kaufinteressenten nicht. Q1 Experten Ø **4,5** vs. Einsteiger Ø **2,5**.
- **AUDION:** Friction 9, „echter Nutzer hätte abgebrochen“ → `supported`.
- **Delta:** Richtung der Reibung stimmt, aber AUDION **überschätzt die Pauschalität**. Ohne Segmentläufe fehlt die Differenzierung.

### H2 – Matrix-Filter
- **Testbirds:** Mehrheit kommt durch Ausprobieren zum Ziel; Ausgrauung verwirrt fast universell; „Warum?“ fehlt.
- **AUDION:** Displays grau bis Akku gewählt; CSS-Check nötig → `supported`.
- **Delta:** **Starker qualitativer Match.** AUDION etwas härter (kein Gegenbeispiel „Experten verstehen es“).

### H3 – User Journey / Auffindbarkeit
- **Testbirds:** 🔴; Q4 Ø **2,6** (schlechtester Wert, niemand 5); Einstieg unter Produkte/eBikes erwartet, nicht „Service & Beratung“; Next Step fehlt.
- **AUDION:** nicht getestet (`inconclusive`).
- **Delta:** **Größte Lücke.** Retest muss F4.2/Q4 + Next Step explizit fahren.

### H4 – Produktnahe Lösung
- **Testbirds:** Nicht Mehrheit gegen Matrix; Split Experten↔Einsteiger → Zwei-/Drei-Wege-Strategie.
- **AUDION:** `partially_supported` (Antwort möglich, Matrix reibt).
- **Delta:** Richtung ok; Strategieableitung bei Testbirds belastbarer.

### H5 – Segmentnutzen
- **Testbirds:** 🟢; Besitzer Q1 ~4,0–4,3 vs. Kaufinteressenten ~3,2; Nachrüsterfahrung stärkster Prädiktor.
- **AUDION:** Buyer-Run C invalid → `not_tested`.
- **Delta:** Personas liegen bereit, Evidenz fehlt.

---

## Soft-Scores vs. Testbirds-Quant

| Metric | Testbirds (Signal) | AUDION Soft | Lesart |
|--------|--------------------|-------------|--------|
| Q1 Nützlichkeit | 76% ≥4; Owner ~4,1; Buyer 3,2 | **3** | zu niedrig für Owner-Proxy |
| Q2 Bedienbarkeit | ~65% eher einfach | **2** | zu hart; Reibungsmoment stimmt |
| Q3 Filterlogik | ~76% eher verstanden | **2** | qualitativ Match, quantitativ zu hart |
| Q4 Auffindbarkeit | **Ø 2,6** | — | AUDION blind |
| Q5 Produktnah vs Tool | ~50/50, segmentspezifisch | produktseite_vermutet | für Owner-Run eher falsch geraten |
| Q6 Wiedernutzung | Owner 3,9 / Buyer 3,0 | **2** | zu pessimistisch |

---

## Qualitative Treffer (In-Tool)

| Thema | Testbirds | AUDION Run B | Match |
|-------|-----------|--------------|-------|
| Akku vor Displays nötig | F3.2/F3.3 nahezu einheitlich | Performance Line → grau → PowerTube | **stark** |
| Ausgrauung ohne Warum | F2.2/F3.6 | Filter erst über Ausprobieren/CSS | **stark** |
| Aufgabe 1 lösbar, Weg mühsam | F3.1/F3.4 Mehrheit ja | taskCompleted + Caveat | ja |
| Next Step / Händler-Bruch | F3.8/F3.9, H3 | nicht belastbar | missed |
| Navigation Auffindbarkeit | F4.2, Q4 | nicht getestet | missed |
| Aufgabe 2 Vierer-Kombi | Mehrheit schafft es mühsam | C invalid | missed |
| Erstkontakt = Konfigurator | F2.1 | A = 403 | missed |

**Quote Match-Rate Themen:** 3/7 ≈ 43% (nur In-Tool-Slice stark).

---

## Strategische Ableitung

**Testbirds (Kern):** Auffindbarkeit + Schrittlogik + Nutzer dort abholen wo sie suchen → Drei-Wege (Tool / produktnah / Nachrüst-Übersicht).

**AUDION (implizit):** Schrittlogik/Erklärung im Tool; Infrastruktur für Retests; Buyer+Navigation nachziehen.

→ AUDION deckt den **Tool-UX-Slice** ab, nicht die **Website-/Journey-Strategie**.

---

## Was das für AUDION als Methode heißt

1. **Gut:** Frühe Signalvalidierung für In-Tool-Friction (Akku-Schritt, Ausgrauung) — deckungsgleich mit Testbirds.  
2. **Schwach:** Soft-Scores kalibrieren (Owner nicht mit Friction=9 auf Q1=3 pressen).  
3. **Pflicht für Parität:** Runs für Auffindbarkeit (H3/Q4), Aufgabe 2, Buyer-Segment (H5), Erstkontakt ohne 403.  
4. **Nicht ersetzen:** n=17 Think-aloud bleibt Referenz für Segmentstatistik und Journey-Strategie.

---

## Nächster Retest (Vergleichbarkeit)

Gegen diese Comparison + Baseline-Evaluation:

```bash
python3 scripts/compare-ebm-evaluations.py \
  knowledge/ebm-produktkombinationen-evaluation-audion-2026-07-30.json \
  path/to/evaluation-neue-wave.json
```

Minimal-Ziele Retest: `validEvidenceRate ≥ 0.67`, C Aufgabe 2 valid, plus dedizierter Navigation-Run für Q4/H3.

# Fehlende / potenzielle Tools (Atome/Moleküle)

Stand: Nach Konsolidierung auf Agent (Tools) nur. Diese Liste dient zur Bewertung: Welche Bausteine fehlen für typische Wireframe-Prompts?

## Vorhandene Tools (27)

Aus `FIGMA_WIREFRAME_TOOLS` / `execute-tool.ts`:

- **Struktur:** createStage, createSection, createRow, groupNodes, setLayout, createSpacer
- **Inhalt:** addText, addPlaceholderImage, createDivider
- **Buttons:** createButton, createButtonRow, createIconButton
- **Blöcke:** createHeader, createHero, createCard, createFooter, createTabs, createStepper
- **Formulare:** createInput, createForm, createCheckbox, createRadio, createTextarea
- **Listen/Tabellen:** createList, createTable
- **Sonstiges:** createAvatar, createBadge, addSvg

Vollständige Beschreibung und Rezepte: [figma-tool-recipes.md](figma-tool-recipes.md).

## Layout (Stand: aktualisiert)

- **Stage:** 1440×1024 (Desktop) bzw. 390×1024 (Mobile). Sections und Rows mit parentId `"stage"` nutzen automatisch die volle Stage-Breite (parent width).
- **Zentrierte Inhalte:** Für eine zentrierte Spalte (z. B. max 720px) createSection(parentId: sectionId, width: 720) verschachteln und ggf. align: "center" setzen.

## Mögliche Lücken (für spätere Erweiterung)

| Baustein | Beschreibung | Priorität |
|----------|--------------|-----------|
| **Accordion** | Aufklappbare Blöcke (Titel + optional Inhalt). Mit createSection + createButton/Text abbildbar, aber kein dediziertes Molekül. | Niedrig |
| **Modal/Dialog** | Overlay-Frame mit Titel, Inhalt, Buttons. createSection + createButtonRow abbildbar; „modal“-Molekül mit Hintergrund/Overlay wäre sauberer. | Mittel |

## Vorgehen zur Prüfung

1. Repräsentative Prompts testen (z. B. „Landing mit Hero und CTA“, „Dashboard mit Tabs“, „Formular mit Stepper“).
2. Fehlende oder umständliche Stellen in dieser Liste ergänzen.
3. Neue Tools nur bei Bedarf ergänzen; bestehende Kombinationen (createSection + addText + createButton) oft ausreichend.

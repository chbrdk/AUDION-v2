# Wireframe Tool Agent – Best Practices

Kurze Regeln für den Agent, damit Wireframes konsistent und mit den verfügbaren Tools umgesetzt werden.

## Stage-Dimensionen

Der Agent erhält die **exakten Stage-Maße** (Breite × Höhe in px, z. B. 1440×1024). Er muss das Layout explizit für diese Canvas-Größe planen und umsetzen:

- **Section-Höhen** in createSection setzen (nicht überall 300 lassen): z. B. Hero 400–500px, Feature-Bereich 300–400px, Footer ~80px.
- **Komponenten-Breiten** an die verfügbare Breite anpassen: z. B. Hero-Bild width ≈ stageWidth − 64 (mit Padding), Content-Spalten in 3-Spalten-Row je ~(stageWidth − 96)/3.
- **Zentrierte Inhalte:** max. Inhaltsbreite 720 oder 1120px als verschachtelte Section mit width + align "center".

## Reihenfolge und Struktur

1. **Stage ist immer da.** Die Bühne (id `"stage"`) wird vom Plugin erstellt; alle Inhalte haben `parentId: "stage"` oder eine von createSection/createRow zurückgegebene Id.
2. **Sektionen zuerst.** Für jeden sichtbaren Bereich (Hero, Features, CTA, Footer) zuerst `createSection` mit `parentId: "stage"` aufrufen, **height passend setzen**, dann Inhalt in die sectionId füllen. Sections und Rows mit parentId "stage" nutzen automatisch die volle Stage-Breite.
3. **createSection vs. createFrame:** Es gibt kein separates „createFrame“-Tool für den Agent; alles geht über createSection (Frame mit Layout) oder createRow. Für freie Container nur createSection mit name nutzen.
4. **Mehrspaltigkeit:** createRow(parentId: "stage") → dann createSection(parentId: rowId) pro Spalte (z. B. 2–3 Feature-Karten).

## Wann welches Molekül

- **createHeader:** Oberer Bereich mit Logo/Navigation/CTA (eine Sektion, volle Breite).
- **createHero:** Großer Einführungsblock mit Titel, optional Subtitle, optional Bild-Platzhalter, optional CTA.
- **createFooter:** Unterer Bereich mit optional leftText, linkLabels (z. B. Impressum, Datenschutz), optional rightText.
- **createTabs:** Tab-Leiste + Inhaltsbereich; Inhalt in die zurückgegebene **contentAreaId** legen (addText, createButton, …).
- **createStepper:** Schritte 1–2–3 mit Labels (Onboarding, Checkout); steps: string[], direction horizontal/vertical.
- **createSection:** Allgemeiner Container; direction horizontal = Elemente nebeneinander, vertical = untereinander. Für zentrierte Inhalte (z. B. max 720px) eine verschachtelte createSection(parentId: sectionId, width: 720) mit align "center" nutzen.
- **groupNodes:** Nur wenn bestehende Nodes gruppiert werden sollen (z. B. Logo + Text als eine Einheit).

## IDs und nodeMap

- Immer die von createSection, createRow, createCard etc. zurückgegebenen Ids (sectionId, rowId, cardId) als parentId für Kinder nutzen.
- Keine erfundenen Ids; nur Ids aus vorherigen Tool-Ergebnissen oder `"stage"`.

## Abstände und Layout

- **Stage-Breite:** Die Stage hat Viewport-Breite (z. B. 1440px Desktop). Sections und Rows mit parentId "stage" bekommen automatisch diese Breite; keine feste 400px-Sections mehr oben.
- **spacing: "spacious"** für luftige Abstände (gap/padding).
- **align:** "center" oder "max" auf createSection/createRow für zentrierte oder rechtsbündige Inhalte.
- **Zentrierte Spalte:** createSection(parentId: sectionId, name: "Content", width: 720) und align "center" auf der übergeordneten Section nutzen.
- **setLayout:** Nur um bestehende Frames nachträglich anzupassen (layoutMode, itemSpacing, padding).

## Text und Typografie

- **h1** für die zentrale Überschrift (z. B. im Hero).
- **h2** für Sektionstitel.
- **body** für Fließtext, **small**/**caption** für Nebentext.

## Buttons und CTAs

- Einzelbutton: createButton.
- Zwei oder mehr zusammengehörige Buttons (z. B. Abbrechen + Weiter): createButtonRow.
- Icon-Button (nur Icon oder Icon+Label): createIconButton mit optional iconSvg (SVG-Code) und optional label.

## Icons und SVG

- **addSvg(parentId, svgCode):** Für eigenständige Icons oder Grafiken; svgCode = vollständiges SVG-Markup (der Agent kann einfaches SVG schreiben).
- **createIconButton:** Wenn der Icon Teil eines Buttons ist (icon-only oder icon+label).

## Beispiele (Tool-Sequenz)

- **Landing, grob:** createSection(stage, "Hero", …) → createHero(heroSectionId, …) → createSection(stage, "Features", …) → createRow(stage) → createCard(rowId, …) mehrfach → createSection(stage, "CTA") → createButtonRow(ctaSectionId, …).
- **Formular:** createSection(stage, "Form") → createForm(sectionId, { fields: […] }, title).

## Referenzen

- Tool-Liste und Rezepte: [figma-tool-recipes.md](figma-tool-recipes.md)
- Fehlende / geplante Tools: [fehlende-tools.md](fehlende-tools.md)
- Architektur: [wireframe-tools-architecture.md](wireframe-tools-architecture.md)

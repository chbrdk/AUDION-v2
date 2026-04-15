# AUDION – UI/UX & Kontinuitäts-Analyse
*msq DX | AUDION · Stand: 15. April 2026*

---

## 1. Dashboard (Porsche Customers & My First Project)

### Kontinuität
Das Dashboard zeigt beim Wechsel auf „My First Project" die gleichen Schnellaktionen (Neue Persona erstellen, Neue Zielgruppe erstellen), aber die Aktionen sind nicht kontextuell: Es ist unklar, in welchem Projekt die neue Persona erstellt wird. Wenn der User auf „Neue Persona erstellen" klickt, sollte das implizit das aktuell gewählte Projekt sein – das ist nicht kommuniziert.

### UI-Probleme
- **Grußtext ist zeitgebunden:** „Guten Abend, Chris" ist zwar charmant, aber als statischer Wert im Screenshot-System unflexibel und könnte bei falschen Tageszeiten (z. B. „Guten Abend" am Morgen) irritieren – nur relevant wenn Server-seitig gerendert ohne Timezone-Handling.
- **Draft-Status unsichtbar:** Beide Personas (Markus, Thomas) sind im Status „draft", aber auf den Dashboard-Karten sieht man das nicht. Die Karten wirken wie finale Einträge.
- **Truncation bei Zielgruppe:** „Performance-Enthusiast / Ma…" im Dashboard-Widget ist ein kritisches Informationsverlust-Problem. Der Name wird zu früh abgeschnitten. Entweder das Widget breiter machen, die Schriftgröße reduzieren oder den Namen mit Tooltip anzeigen.
- **Leerzeilen-Inkonsistenz:** Beim „My First Project"-Dashboard wird der Personas-Bereich mit dem Text „Noch keine Personas. Erstelle deine erste, um loszulegen." gefüllt – die Zielgruppen-Box hat den gleichen Text. Das ist gut. Aber die Widget-Höhe zwischen dem leeren und dem befüllten Zustand ist unterschiedlich, was zu einem Layout-Shift führt.

### UX-Probleme
- **Keine Fortschrittsindikation für leere Projekte:** Bei „My First Project" gibt es keine geführte Onboarding-Sequenz (z. B. Schritt 1: Zielgruppe erstellen → Schritt 2: Persona erstellen → Schritt 3: Journey starten). Die drei Schnellaktionen unten sind nicht priorisiert.
- **Schnellaktionen ohne Projektkontext:** Die Schnellaktionen sind statisch und wechseln nicht mit dem aktiven Projekt-Tab. Das ist ein stilles UX-Problem.

---

## 2. Einstellungen

### Kontinuität
Der **Projekt-Switcher oben** zeigt „Porsche Customers" – aber die meisten Einstellungen auf dieser Seite sind Account-global (Profil, Theme, KI-Provider, Prompt-Templates). Das suggeriert fälschlicherweise, dass Einstellungen projektspezifisch sind. Nur „Projekte & Zugriff" ist tatsächlich projektbezogen.

### UI-Probleme
- **Unklare Scope-Trennung:** Zwischen Account-Settings (Profil, Theme) und Projekt-Settings (Projekte & Zugriff, KI-Provider) gibt es keine visuelle Trennung oder Gruppierung. Ein zweistufiges Layout mit Abschnittsüberschriften würde helfen.
- **API-Dokumentation als Settings-Karte:** API-Dokumentation ist keine Einstellung, sondern eine Ressource. Sie gehört konzeptionell woanders hin (z. B. eigener Menüpunkt „Developer" oder ein Link in der Sidebar).
- **Karten-Grid:** Alle 6 Karten sehen identisch aus und haben die gleiche Priorität. Eine Gewichtung (z. B. „Profil" und „KI-Provider" prominenter) würde die Orientierung erleichtern.

### UX-Probleme
- Der Begriff „Kontrollzentrum" ist im Header gut gewählt, aber die Beschreibung darunter („Zentralisiere die KI-Konfiguration. Prüfe Provider-Status…") fokussiert nur auf KI-Aspekte, obwohl auch Profil und Theme hier sind.

---

## 3. Journeys

### Kontinuität
Das Journeys-Modul ist **komplett entkoppelt** vom Rest der App. Im Porsche Customers Projekt gibt es 2 Personas und 1 Zielgruppe – aber keine Journeys. Es fehlt jeder Hinweis darauf, wie Personas/Zielgruppen und Journeys zusammenhängen oder wie man eine Journey aus bestehenden Personas heraus startet.

### UI-Probleme
- Das Sidebar-Icon für Journeys zeigt im Screenshot einen aktiven Zustand (Kreis um das Icon), der sich optisch von anderen aktiven Navigations-Zuständen unterscheidet – prüfen ob das konsistent ist.
- Der Empty-State-Text „Noch keine Journeys. Erstelle deine erste Journey, um zu starten." gibt keine Orientierung darüber, was eine Journey ist oder wie sie mit Personas verbunden wird.

### UX-Probleme
- **Fehlende Einstiegshilfe:** Es wäre sinnvoll, im Journey-Empty-State direkt vorzuschlagen: „Starte eine Journey mit Markus oder Thomas" – also Personas aus dem Projekt als Einstiegspunkte verlinken.

---

## 4. Personas – Listenansicht

### Kontinuität
- Die Personas-Liste zeigt für jede Karte einen **Projekt-Tag** ("Porsche Customers"). Das ist redundant, da man sich bereits im Kontext des Porsche Customers Projekts befindet (Projekt-Switcher oben). Der Tag macht nur Sinn in einer projektübergreifenden Ansicht.
- Beide Personas haben den Status „draft" – das ist in der Listenansicht nur als kleiner Text sichtbar.

### UI-Probleme
- **Doppelte Navigation:** Jede Persona-Karte hat sowohl einen „>" Pfeil neben dem Projekt-Tag als auch einen „Anzeigen"-Button. Beide führen zur gleichen Detail-Ansicht – das ist redundant.
- **Kein Zielgruppen-Hinweis in der Liste:** Markus hat keine Zielgruppe. Das sieht man nur in der Detailansicht. Ein kleines Label oder ein Warnsymbol in der Listenansicht würde helfen.
- **Konfidenzwert fehlt:** Markus hat 0.70, Thomas 0.90 – dieser Wert ist relevant für die Datenqualität, aber in der Liste gar nicht sichtbar.
- **Avatar-Inkonsistenz:** Markus hat einen farbigen Buchstaben-Avatar (grünes M), Thomas hat ein echtes Foto. Das erzeugt optische Unruhe im Grid. Es sollte einen einheitlichen Fallback-Style geben.

### UX-Probleme
- Das „Neue Persona"-Erstellungs-Kard ist das erste Element im Grid (gepunktet, links oben). Das ist eine gute Pattern, aber bei vielen Einträgen würde das Element aus dem Sichtfeld scrollen – ggf. besser als Sticky-Button oben rechts oder als FAB lösen.

---

## 5. Persona-Detail – Markus

### Kontinuität
- **Zielgruppe: Keine** – Markus ist keiner Zielgruppe zugeordnet. Im Gegensatz zu Thomas (der der „Performance-Enthusiast / Markenloyalist"-Gruppe zugeordnet ist) fehlt bei Markus diese Verknüpfung. Es gibt keinen Hinweis oder Call-to-Action, dass diese Verknüpfung fehlt.
- **Full Name ist leer:** Das Feld existiert, ist aber nicht befüllt. Es ist unklar, ob „Markus" der Vorname, der Full Name oder nur ein Alias ist.

### UI-Probleme
- **Bilinguales Heading „DEMOGRAFIEN / DEMOGRAPHICS":** Das ist ungewöhnlich. Entweder konsequent Deutsch oder Englisch – nicht beides gleichzeitig als Kapitelüberschrift. Die Feldnamen darunter (Gender, Age, Location, Media Affinity, Full Name) sind zudem auf Englisch, obwohl die restliche UI auf Deutsch ist.
- **Leere Felder als „—":** Das Em-Dash für leere Werte ist gängig, aber nicht barrierefrei. Ein Label wie „Nicht angegeben" oder ein placeholder-artiger Style wäre informativer.
- **Media Affinity: 83** – Was bedeutet das? Kein Einheit, kein Kontext, keine Skala sichtbar. Ein kurzer Tooltip oder eine Visualisierung (z. B. Balken oder Score-Chip) würde helfen.
- **Konfidenz: 0.70** ist als Dezimalzahl schwer zu lesen. Eine Prozentdarstellung (70 %) oder ein visueller Indikator (z. B. Fortschrittsbalken) wäre lesbarer.
- **Aktionsleiste:** Die Buttons „Mit KI anreichern", „Chat-Prompt aktualisieren", „Avatar generieren", „Archivieren", „Löschen" sind in einer Zeile. Bei schmaleren Viewports wird das brechen. Außerdem ist „Löschen" (rot/pink) direkt neben „Archivieren" – das sind sehr unterschiedliche Destruktivitätsstufen, die ggf. mehr visuellen Abstand brauchen.
- **Status „draft":** Weder in der Persona-Karte noch im Header der Detailansicht ist der Draft-Status prominent hervorgehoben – nur tief unten in den Metadaten.

### UX-Probleme
- **Was bedeutet „Chat-Prompt aktualisieren"?** Diese Aktion ist nicht selbsterklärend. Ein Tooltip oder eine kurze Erklärung ist nötig.
- **Tavus-Felder im Metadaten-Bereich:** Tavus Replica-ID und Tavus Persona-ID sind Integrations-Felder. Sie sollten in einen separaten „Integrationen"-Tab ausgelagert werden, nicht im Haupt-Metadaten-Block.
- **Versionierung:** Version „1.0.0" ist sichtbar, aber es gibt keine Möglichkeit, frühere Versionen einzusehen. Wenn Versioning angeboten wird, sollte auch ein Versionshistorie-Zugang vorhanden sein.

---

## 6. Persona-Detail – Thomas

### Kontinuität
Thomas ist der Zielgruppe „Performance-Enthusiast / Markenloyalist" zugeordnet – gut. Aber die gleichen strukturellen Probleme wie bei Markus bestehen: bilingualer Header, englische Feldnamen, leerer Full Name.

### UI-Probleme
- Gleiche Probleme wie bei Markus (bilinguales Heading, Dezimalzahlen, Tavus-Felder).
- **Konfidenz 0.90 vs. 0.70 bei Markus:** Es gibt keine visuelle Darstellung dieses Unterschieds. In der Listenansicht ist er gar nicht sichtbar.

---

## 7. Profil

### Kontinuität / Kritischer Fehler
- **Sprache: English – UI ist auf Deutsch.** Das ist ein offensichtliches Kontinuitätsproblem. Entweder ist die Spracheinstellung nicht aktiv (d. h. das UI ignoriert die Einstellung), oder die Einstellung wurde nach der UI-Erstellung auf English gesetzt. Das muss korrigiert oder als Known Issue kommuniziert werden.
- **Name: Chris** – Im Profil steht „Chris", die E-Mail ist `chris.b@msqdx.com`, aber oben im Dashboard steht „Guten Abend, Chris". Konsistent – gut.
- **Unternehmen: leer** – Dieses Feld ist leer, obwohl der User mit Projekten wie „Porsche Customers" arbeitet. Das Feld könnte auto-befüllt oder als Pflichtfeld für besseres KI-Kontext-Handling markiert sein.

### UI-Probleme
- **Avatar:** Der Avatar zeigt nur ein „C" in einem blassen Kreis. Es gibt kein Upload-Button direkt am Avatar sichtbar (nur das Avatar-URL-Feld im Formular). Ein direktes Klick-to-Upload am Avatar-Bild wäre intuitiver.
- **Avatar-URL als Textfeld:** Ein URL-Input ist für den normalen User (kein Developer) ungewöhnlich. Ein Datei-Upload wäre die erwartete Interaktion.

---

## 8. Projekte – Listenansicht & Detail

### Kontinuität
- Im Projekt-Detail für „Porsche Customers" sind „Unternehmen & Kontext"-Felder leer (Projektbeschreibung, Unternehmenskontext). Das ist jedoch genau die Information, die laut Beschreibung genutzt wird, „um Zielgruppen und Personas vorzuschlagen". Das leere Feld ist ein stilles Problem – die KI-Suggestions werden schlechter, ohne dass der User es weiß.

### UI-Probleme
- **0 Template-Overrides:** Was sind Template-Overrides? Diese Kennzahl in der Übersicht ist ohne Erklärung für neue User nicht verständlich.
- **Mitglieder-Bereich:** Das E-Mail-Eingabefeld für neue Mitglieder hat den Placeholder „teammate@company.com" – zu generisch. Ein konkreter Hint wie „E-Mail-Adresse eingeben" wäre besser.
- **Projekt-Karten in der Liste:** Die Karten zeigen nur den Namen und die UUID. Ein kurzer Beschreibungstext (aus dem Unternehmen & Kontext-Bereich) oder eine Persona-/Zielgruppen-Anzahl würde die Karte informativer machen.

### UX-Probleme
- **Leere Kontextfelder ohne Warnung:** Wenn Projekt-Beschreibung und Unternehmenskontext leer sind, sollte es eine sanfte Warnung oder einen Prompt geben: „Füge Kontext hinzu, um bessere KI-Vorschläge zu erhalten."
- **My First Project erscheint ohne jede Information** in der Liste – nicht einmal eine Erstellt-Datum-Info ist auf der Listenebene sichtbar.

---

## 9. Zielgruppen

### Kontinuität
- Nur eine Zielgruppe existiert: „Performance-Enthusiast / Markenloyalist". Markus ist nicht zugeordnet, Thomas schon. Das ist inkonsistent und nicht auf dieser Seite sichtbar.
- Der Name „Performance-Enthusiast / Markenloyalist" ist lang und wird in anderen Ansichten (Dashboard, Persona-Detail) unterschiedlich truncated.

### UI-Probleme
- **Karten-Subtext:** „B2C / Returning Customer / Brandloyal" sind Tags oder Kategorien – sie sehen aus wie freier Text, könnten aber als Chips/Badges dargestellt werden, um die Lesbarkeit zu verbessern.
- **Gleiche Doppel-Navigation** wie bei Personas („>" + „Anzeigen"-Button).

---

## 10. Übergreifende Kontinuitäts- und Design-Probleme

### Sprach-Inkonsistenz (kritisch)
Die App ist auf Deutsch, aber demografische Feldnamen in Persona-Details sind auf Englisch (Gender, Age, Location, Media Affinity, Full Name). Die Heading-Kombination „DEMOGRAFIEN / DEMOGRAPHICS" ist ein Symptom davon. Das sollte vereinheitlicht werden – wahrscheinlich in Richtung Deutsch, da das die UI-Sprache ist.

### Navigation / Sidebar
Die Sidebar-Icons sind ohne Labels – für erfahrene User ok, für neue User gibt es keine Orientierung. Ein Toggle für Labels oder zumindest Tooltips beim Hover sollte vorhanden sein (wenn nicht schon implementiert, auf den Screenshots nicht sichtbar).

### Status-System
Der Status „draft" taucht in Metadaten auf, aber es ist unklar, was der Lifecycle ist: draft → reviewed → published? Es gibt keine sichtbare Möglichkeit, den Status zu ändern. Ein Status-Dropdown oder ein klarer „Veröffentlichen"-Button fehlt.

### Konfidenz-Konzept
Konfidenzwerte (0.70, 0.90) erscheinen in Metadaten ohne Erklärung. Handelt es sich um KI-generierte Qualitätsbewertungen? Diese sollten mit einer kurzen Erklärung und einer visuellen Darstellung (Gauge, Balken, Farbkodierung) versehen werden.

### Leere Felder
Em-Dash „—" als Leer-Zustand ist UI-üblich, aber nicht konsistent mit dem sonst gesprächigen, warmherzigen Ton der App. Overally sollten leere Felder (besonders wichtige wie Zielgruppe, Location, Full Name) mit einem CTA wie „Hinzufügen" oder einem Edit-Prompt versehen werden.

### Destruktive Aktionen
„Löschen" in der Persona-Detailansicht ist direkt zugänglich ohne modalen Bestätigungs-Hinweis (soweit sichtbar). Bei einem System, das auf KI-generierten und manuell gepflegten Daten basiert, sollte jede Lösch-Aktion mit einem Bestätigungsdialog gesichert sein.

---

## Zusammenfassung – Prioritäten

**Kritisch (sofort angehen)**
1. Sprachinkonsistenz: Demografische Felder auf Englisch in einer deutschen UI
2. Sprach-Setting im Profil (English) vs. UI-Sprache (Deutsch) – klären ob Bug oder Feature
3. Draft-Status der Personas ist in Listenansicht und Dashboard nicht sichtbar

**Hoch (nächster Sprint)**
4. Projekt-Switcher in Settings suggeriert fälschlicherweise project-scope für globale Settings
5. Markus ohne Zielgruppe – kein sichtbarer Hinweis in der App
6. Leere Kontext-Felder im Projekt ohne Warnung über KI-Qualitätsverlust
7. Konfidenz- und Media-Affinity-Werte ohne Visualisierung oder Erklärung

**Mittel (Backlog)**
8. Doppelte Navigation (Pfeil + „Anzeigen"-Button) in Listenansichten
9. Projekt-Tag auf Persona-Karten ist redundant innerhalb des Projektkontexts
10. Avatar-Upload per URL statt Datei-Upload
11. API-Dokumentation gehört nicht in die Settings-Hauptseite
12. Tavus-Felder in separaten Integrations-Tab auslagern
13. Destruktive Aktionen (Löschen) mit mehr Abstand und Bestätigungsdialog absichern

**Niedrig / Nice-to-have**
14. Sidebar-Navigation: Labels oder Hover-Tooltips ergänzen
15. Journey-Empty-State mit Personas verlinken
16. Personas in der Listenansicht: Konfidenzwert anzeigen
17. Zielgruppen-Tags als Chips statt Fließtext

---

*Erstellt mit Claude · msq DX AUDION UI/UX Review · April 2026*

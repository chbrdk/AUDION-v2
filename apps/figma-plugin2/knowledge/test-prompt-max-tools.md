# Test-Prompt: Möglichst viele Tools nutzen

Dieser Prompt zielt darauf ab, möglichst viele Wireframe-Tools in einem Durchlauf zu triggern, um die Funktionsfähigkeit zu validieren.

---

## Vollständiger Test-Prompt (Copy & Paste)

```
Landing Page mit allen wichtigen Bereichen:

1. Header: Logo-Bereich "Acme", Navigation (Home, Features, Preise, Kontakt), rechts einen CTA-Button "Anmelden".
2. Hero: Große Überschrift "Willkommen bei Acme", Untertitel "Die beste Lösung für dein Team.", ein Bild-Platzhalter für den Hero (image:Hero-Banner), darunter zwei Buttons nebeneinander: "Kostenlos starten" (primary) und "Demo ansehen" (outline).
3. Features: Eine horizontale Zeile mit drei Karten nebeneinander. Jede Karte: Bild-Platzhalter (image:Feature-Icon), Titel (z.B. "Schnell", "Einfach", "Sicher"), kurzer Beschreibungstext, ein Button "Mehr".
4. Einen horizontalen Trennstrich (Divider).
5. Kurzer Abschnitt "Was Kunden sagen" mit einem Avatar (Initialen "JD"), daneben ein Badge "Empfohlen" und etwas Fließtext.
6. Preise: Eine Tabelle mit 3 Spalten (Plan, Preis, Features), 4 Zeilen (Header + 3 Pläne). Header: "Plan", "Monat", "Features". Erste Datenzeile: "Starter", "0 €", "Basis-Features".
7. Kontaktformular: Titel "Kontakt aufnehmen". Drei Felder: "Name" (Placeholder "Dein Name"), "E-Mail" (Placeholder "mail@example.com"), "Nachricht" (mehrzeiliges Feld, 4 Zeilen). Ein Checkbox "Newsletter abonnieren". Zwei Radio-Optionen "Anfrage" und "Feedback". Zwei Buttons: "Abbrechen" (outline) und "Senden" (primary).
8. Footer-ähnlicher Bereich: Bullet-Liste mit drei Punkten (Impressum, Datenschutz, AGB), darunter eine nummerierte Liste "Schritt 1: Registrieren", "Schritt 2: Einrichten", "Schritt 3: Loslegen". Optional ein Icon-Button (z.B. Such-Icon) neben einem kleinen Text "Suche".

Nutze großzügige Abstände (spacious) und klare Überschriften (h1 im Hero, h2 für Sektionen).
```

---

## Erwartete Tools (Checkliste)

| Tool | Wo im Prompt |
|------|-------------------------------|
| createHeader | 1. Logo, Nav, CTA |
| createHero | 2. Titel, Subtitle, Bild, createButtonRow |
| createSection | Alle Bereiche (Hero, Features, Divider-Bereich, Testimonials, Preise, Formular, Footer) |
| createRow | 3. Drei Karten nebeneinander |
| createCard | 3. Pro Feature-Karte |
| addText | h1, h2, body, caption überall |
| addPlaceholderImage | 2. Hero, 3. Pro Karte |
| createButton / createButtonRow | 2. Hero CTAs, 3. "Mehr", 7. Abbrechen/Senden |
| createDivider | 4. Trennstrich |
| createAvatar | 5. "JD" |
| createBadge | 5. "Empfohlen" |
| createTable | 6. Preistabelle |
| createForm | 7. Kontakt |
| createInput | 7. Name, E-Mail (createForm nutzt createInput intern) |
| createTextarea | 7. Nachricht |
| createCheckbox | 7. Newsletter |
| createRadio | 7. Anfrage/Feedback (2x) |
| createList | 8. Bullet-Liste, nummerierte Liste |
| createIconButton oder addSvg | 8. Such-Icon |

Optional (wenn der Agent sie einsetzt): **createSpacer**, **groupNodes** (z.B. Logo+Text), **setLayout**.

---

## Kürzerer Smoke-Test (weniger Tools)

Wenn du nur einen schnellen Check willst:

```
Landing: Header mit Logo "Test" und Nav (Home, About) und CTA "Login". Hero mit Titel "Hello", Subtitle "Welcome.", ein Bild-Platzhalter, zwei Buttons "Start" und "Learn more". Eine Zeile mit zwei Karten (Titel + Beschreibung + Button). Ein Trennstrich. Ein kleines Kontaktformular mit Titel "Contact", Feldern Name und E-Mail, und Buttons "Cancel" und "Submit".
```

Das sollte u.a. **createHeader**, **createHero**, **createRow**, **createCard**, **createButtonRow**, **createDivider**, **createForm** und **addPlaceholderImage** ansprechen.

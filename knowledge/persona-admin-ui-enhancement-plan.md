# Persona Admin UI - Vollständige Datenanzeige - Umsetzungsplan

## Übersicht

Aktuell werden im Persona Admin UI nur wenige Informationen angezeigt (Name, Headline, Segment, Metadaten). Das PersonaProfile-Schema enthält jedoch viele weitere Datenfelder, die derzeit nicht sichtbar sind. Dieser Plan beschreibt, wie alle verfügbaren Persona-Daten UX-optimal dargestellt werden können.

## Analyse: Verfügbare vs. Angezeigte Daten

### Aktuell angezeigt:
- ✅ Name, Headline, Segment (Header)
- ✅ Metadaten: Status, Confidence, Version, Updated, Updated by, Last review
- ✅ Bearbeiten: Name, Segment, Headline, Status, Updated by
- ✅ Dokumente (Liste)
- ✅ Wissensbasis (Liste)
- ✅ Sources (minimal)
- ✅ Insights (minimal)

### Verfügbar, aber NICHT angezeigt:
- ❌ `bio` (vollständige Biografie)
- ❌ `full_name`
- ❌ `age`
- ❌ `location`
- ❌ `interests` (Array)
- ❌ `color_palette` (Array)
- ❌ `attention_span`
- ❌ `social_media_usage` (Array)
- ❌ `values` (Array)
- ❌ `traits` (Dict<string, float> - OCEAN-Scores o.ä.)
- ❌ `pain_points` (Array mit `label` und `evidence_count`)
- ❌ `goals` (Array mit `label` und `priority`)
- ❌ `communication_style` (vocabulary, sentence_structure, skepticism_level)
- ❌ `created_at`
- ❌ `targetGroupId` (wenn vorhanden)

## Phase 1: Strukturierung der Detailansicht

### 1.1 Layout-Organisation

**Aktuelle Struktur:**
- Header (Name, Headline, Avatar, Actions)
- Grid: Metadaten + Bearbeiten
- Dokumente (Section)
- Wissensbasis (Section)
- Sources (Section)
- Insights (Section)

**Neue Struktur mit Tabs/Accordions:**
```
[Header: Name, Headline, Avatar, Actions]
[Tab-Navigation oder Accordions]

Tab 1: "Übersicht" (default)
  - Metadaten (Status, Confidence, Version, etc.)
  - Kurzinfo (Segment, Age, Location wenn vorhanden)
  - Quick Stats (Confidence, Pain Points Count, Goals Count, etc.)

Tab 2: "Profil Details"
  - Bio (vollständiger Text)
  - Demographie (Age, Location, Full Name)
  - Interessen & Werte (Interests, Values)
  - Social Media (social_media_usage)
  - Persönlichkeit (Traits mit Visualisierung)

Tab 3: "Pain Points & Goals"
  - Pain Points (mit Evidence Count, sortiert)
  - Goals (mit Priority, sortiert)
  - Visualisierungen (Charts wenn sinnvoll)

Tab 4: "Kommunikation"
  - Communication Style (Vocabulary, Sentence Structure, Skepticism Level)
  - Beispiel-Vokabular
  - Skepticism Visualization (Slider/Bar)

Tab 5: "Knowledge & Sources"
  - Dokumente (wie bisher)
  - Wissensbasis (wie bisher)
  - Sources (erweitert mit mehr Details)
  - Insights (erweitert)

Tab 6: "Erweitert" (optional)
  - Color Palette (Visualisierung)
  - Attention Span
  - Target Group Link (wenn vorhanden)
  - Created At, Updated At Details
```

### 1.2 Alternative: Accordion-basiertes Layout

Wenn Tabs zu komplex sind, können Accordions verwendet werden:
- **Persona-Grundlagen** (expandiert by default)
  - Bio, Demographie, Interessen
- **Persönlichkeit & Werte**
  - Traits, Values, Interests
- **Pain Points & Goals**
- **Kommunikation**
- **Knowledge & Sources**
- **Metadaten & Erweitert**

## Phase 2: UX-Optimierte Komponenten

### 2.1 Bio-Anzeige
```tsx
<div className="msqdx-glass-bio-section">
  <h3>Biografie</h3>
  <div className="msqdx-glass-bio-text">
    {detail.profile.bio || <span className="msqdx-glass-muted">Keine Biografie verfügbar</span>}
  </div>
</div>
```
- **Styling:** Gut lesbare Typografie, angemessener Zeilenabstand
- **Platzhalter:** Wenn bio leer ist, zeige "Keine Biografie verfügbar"

### 2.2 Demographie-Block
```tsx
<div className="msqdx-glass-demographics">
  <h3>Demographie</h3>
  <dl className="msqdx-glass-meta-grid">
    {detail.profile.full_name && (
      <div>
        <dt>Vollständiger Name</dt>
        <dd>{detail.profile.full_name}</dd>
      </div>
    )}
    {detail.profile.age && (
      <div>
        <dt>Alter</dt>
        <dd>{detail.profile.age} Jahre</dd>
      </div>
    )}
    {detail.profile.location && (
      <div>
        <dt>Standort</dt>
        <dd>{detail.profile.location}</dd>
      </div>
    )}
  </dl>
</div>
```
- **Conditional Rendering:** Zeige nur Felder, die vorhanden sind
- **Icons:** Optional Icons für visuelle Klarheit

### 2.3 Interessen & Werte
```tsx
<div className="msqdx-glass-interests-values">
  {detail.profile.interests?.length > 0 && (
    <div>
      <h3>Interessen</h3>
      <div className="msqdx-glass-chip-list">
        {detail.profile.interests.map((interest, idx) => (
          <span key={idx} className="msqdx-glass-chip">
            {interest}
          </span>
        ))}
      </div>
    </div>
  )}
  {detail.profile.values?.length > 0 && (
    <div>
      <h3>Werte</h3>
      <div className="msqdx-glass-chip-list">
        {detail.profile.values.map((value, idx) => (
          <span key={idx} className="msqdx-glass-chip --value">
            {value}
          </span>
        ))}
      </div>
    </div>
  )}
</div>
```
- **Chip-Design:** Visuelle Darstellung als Chips/Tags
- **Unterschiedliche Styles:** Interessen vs. Werte optisch unterscheiden

### 2.4 Traits-Visualisierung
```tsx
<div className="msqdx-glass-traits">
  <h3>Persönlichkeit (Traits)</h3>
  {Object.keys(detail.profile.traits || {}).length === 0 ? (
    <p className="msqdx-glass-muted">Keine Traits verfügbar</p>
  ) : (
    <div className="msqdx-glass-traits-grid">
      {Object.entries(detail.profile.traits || {}).map(([trait, score]) => (
        <div key={trait} className="msqdx-glass-trait-item">
          <div className="msqdx-glass-trait-header">
            <span className="msqdx-glass-trait-label">{trait}</span>
            <span className="msqdx-glass-trait-score">{(score * 100).toFixed(0)}%</span>
          </div>
          <div className="msqdx-glass-trait-bar">
            <div 
              className="msqdx-glass-trait-fill"
              style={{ width: `${score * 100}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  )}
</div>
```
- **Bar-Charts:** Visuelle Darstellung als horizontale Bars
- **Sortierung:** Optional nach Score sortieren (höchste zuerst)

### 2.5 Pain Points mit Evidence Count
```tsx
<div className="msqdx-glass-pain-points">
  <h3>Pain Points</h3>
  {detail.profile.pain_points?.length === 0 ? (
    <p className="msqdx-glass-muted">Keine Pain Points identifiziert</p>
  ) : (
    <ul className="msqdx-glass-pain-points-list">
      {detail.profile.pain_points
        .sort((a, b) => (b.evidence_count || 0) - (a.evidence_count || 0))
        .map((pp, idx) => (
          <li key={idx} className="msqdx-glass-pain-point-item">
            <div className="msqdx-glass-pain-point-content">
              <span className="msqdx-glass-pain-point-label">{pp.label}</span>
              <span className="msqdx-glass-pain-point-evidence">
                {pp.evidence_count || 0} Belege
              </span>
            </div>
            {pp.evidence_count > 0 && (
              <div className="msqdx-glass-pain-point-bar">
                <div 
                  className="msqdx-glass-pain-point-fill"
                  style={{ width: `${Math.min((pp.evidence_count / 10) * 100, 100)}%` }}
                />
              </div>
            )}
          </li>
        ))}
    </ul>
  )}
</div>
```
- **Sortierung:** Nach Evidence Count (höchste zuerst)
- **Visualisierung:** Bar-Chart für Evidence Count
- **Empty State:** Klare Meldung wenn keine Pain Points vorhanden

### 2.6 Goals mit Priority
```tsx
<div className="msqdx-glass-goals">
  <h3>Ziele</h3>
  {detail.profile.goals?.length === 0 ? (
    <p className="msqdx-glass-muted">Keine Ziele definiert</p>
  ) : (
    <ol className="msqdx-glass-goals-list">
      {detail.profile.goals
        .sort((a, b) => (a.priority || 999) - (b.priority || 999))
        .map((goal, idx) => (
          <li key={idx} className="msqdx-glass-goal-item">
            <div className="msqdx-glass-goal-content">
              <span className="msqdx-glass-goal-priority">#{goal.priority || idx + 1}</span>
              <span className="msqdx-glass-goal-label">{goal.label}</span>
            </div>
          </li>
        ))}
    </ol>
  )}
</div>
```
- **Sortierung:** Nach Priority (niedrigste zuerst)
- **Nummerierung:** Zeige Priority-Nummer deutlich
- **Visualisierung:** Optional Icon für Ziele (Zielscheibe, etc.)

### 2.7 Communication Style
```tsx
<div className="msqdx-glass-communication-style">
  <h3>Kommunikationsstil</h3>
  {detail.profile.communication_style && (
    <div className="msqdx-glass-comm-style-grid">
      {/* Vocabulary */}
      {detail.profile.communication_style.vocabulary?.length > 0 && (
        <div>
          <h4>Vokabular</h4>
          <div className="msqdx-glass-chip-list">
            {detail.profile.communication_style.vocabulary.map((word, idx) => (
              <span key={idx} className="msqdx-glass-chip --vocab">
                {word}
              </span>
            ))}
          </div>
        </div>
      )}
      
      {/* Sentence Structure */}
      {detail.profile.communication_style.sentence_structure && (
        <div>
          <h4>Satzstruktur</h4>
          <p>{detail.profile.communication_style.sentence_structure}</p>
        </div>
      )}
      
      {/* Skepticism Level */}
      <div>
        <h4>Skeptizismus</h4>
        <div className="msqdx-glass-skepticism">
          <div className="msqdx-glass-skepticism-label">
            <span>Niedrig</span>
            <span>Hoch</span>
          </div>
          <div className="msqdx-glass-skepticism-bar">
            <div 
              className="msqdx-glass-skepticism-fill"
              style={{ 
                width: `${((detail.profile.communication_style.skepticism_level || 0) / 5) * 100}%` 
              }}
            />
          </div>
          <div className="msqdx-glass-skepticism-value">
            Level: {detail.profile.communication_style.skepticism_level || 0} / 5
          </div>
        </div>
      </div>
    </div>
  )}
</div>
```
- **Vocabulary:** Als Chips/Tags
- **Skepticism:** Als Slider/Bar (1-5 Skala)

### 2.8 Social Media Usage
```tsx
{detail.profile.social_media_usage?.length > 0 && (
  <div className="msqdx-glass-social-media">
    <h3>Social Media Nutzung</h3>
    <div className="msqdx-glass-chip-list">
      {detail.profile.social_media_usage.map((platform, idx) => (
        <span key={idx} className="msqdx-glass-chip --social">
          {platform}
        </span>
      ))}
    </div>
  </div>
)}
```
- **Icons:** Optional Icons für Plattformen (LinkedIn, Twitter, etc.)

### 2.9 Color Palette
```tsx
{detail.profile.color_palette?.length > 0 && (
  <div className="msqdx-glass-color-palette">
    <h3>Farbpalette</h3>
    <div className="msqdx-glass-color-swatches">
      {detail.profile.color_palette.map((color, idx) => (
        <div 
          key={idx} 
          className="msqdx-glass-color-swatch"
          style={{ backgroundColor: color }}
          title={color}
        />
      ))}
    </div>
  </div>
)}
```
- **Visualisierung:** Farb-Swatches als kleine Quadrate

### 2.10 Target Group Link
```tsx
{detail.profile.targetGroupId && (
  <div className="msqdx-glass-target-group-link">
    <h3>Target Group</h3>
    <a 
      href={`/target-groups/admin?selected=${detail.profile.targetGroupId}`}
      className="msqdx-glass-button --ghost"
    >
      <MaterialSymbol icon="groups" fontSize={16} />
      Zur Target Group
    </a>
  </div>
)}
```
- **Link:** Direkter Link zur zugehörigen Target Group

### 2.11 Erweiterte Metadaten
```tsx
<div className="msqdx-glass-extended-metadata">
  <h3>Zeitstempel</h3>
  <dl className="msqdx-glass-meta-grid">
    <div>
      <dt>Erstellt am</dt>
      <dd>{formatDate(detail.profile.created_at)}</dd>
    </div>
    <div>
      <dt>Aktualisiert am</dt>
      <dd>{formatDate(detail.metadata.updatedAt)}</dd>
    </div>
    {detail.profile.attention_span && (
      <div>
        <dt>Attention Span</dt>
        <dd>{detail.profile.attention_span}</dd>
      </div>
    )}
  </dl>
</div>
```

## Phase 3: Responsive Design & Layout

### 3.1 Mobile-First Approach
- **Breakpoints:** 
  - Mobile: < 768px (Stack-Layout, keine Tabs)
  - Tablet: 768px - 1024px (2-Spalten-Grid)
  - Desktop: > 1024px (3-Spalten-Grid, Tabs möglich)

### 3.2 Collapsible Sections
- **Accordions:** Auf mobilen Geräten alle Sections als Accordions
- **Expand/Collapse All:** Button zum Ein-/Ausklappen aller Sections

### 3.3 Scroll-Behavior
- **Sticky Header:** Header bleibt beim Scrollen sichtbar
- **Smooth Scrolling:** Für Tab-Navigation

## Phase 4: Empty States & Placeholders

### 4.1 Empty State Messages
- **Bio:** "Keine Biografie verfügbar"
- **Pain Points:** "Keine Pain Points identifiziert"
- **Goals:** "Keine Ziele definiert"
- **Traits:** "Keine Traits verfügbar"

### 4.2 Placeholder-Styling
- Verwende `msqdx-glass-muted` Klasse für leere Felder
- Icons optional für Empty States

## Phase 5: Erweiterte Features (Optional)

### 5.1 Visualisierungen
- **Traits Radar Chart:** Für Persönlichkeits-Traits
- **Pain Points Bar Chart:** Für Evidence Counts
- **Goals Priority Chart:** Für Goal-Prioritäten

### 5.2 Export-Funktionen
- **JSON Export:** Komplettes PersonaProfile als JSON
- **PDF Export:** Persona-Profil als PDF

### 5.3 Vergleich
- **Persona Comparison:** Zwei Personas nebeneinander vergleichen

## Phase 6: Implementierungsschritte

### Schritt 1: Basis-Struktur erweitern
1. Neue Sections in `msqdx-glass-persona-admin-panel.tsx` hinzufügen
2. Conditional Rendering für alle neuen Felder
3. Empty States implementieren

### Schritt 2: Komponenten erstellen
1. `MsqdxGlassPersonaBio.tsx` - Bio-Anzeige
2. `MsqdxGlassPersonaDemographics.tsx` - Demographie
3. `MsqdxGlassPersonaTraits.tsx` - Traits-Visualisierung
4. `MsqdxGlassPersonaPainPoints.tsx` - Pain Points Liste
5. `MsqdxGlassPersonaGoals.tsx` - Goals Liste
6. `MsqdxGlassPersonaCommunication.tsx` - Communication Style
7. `MsqdxGlassPersonaInterestsValues.tsx` - Interessen & Werte

### Schritt 3: Styling & Responsiveness
1. CSS für neue Komponenten
2. Responsive Breakpoints testen
3. Mobile-Optimierung

### Schritt 4: Testing
1. Mit verschiedenen Persona-Daten testen
2. Empty States testen
3. Responsive Design testen

## Priorisierung

### Hoch (Must-Have):
1. ✅ Bio-Anzeige
2. ✅ Pain Points Liste
3. ✅ Goals Liste
4. ✅ Communication Style
5. ✅ Traits-Visualisierung

### Mittel (Should-Have):
6. ⚠️ Demographie (Age, Location, Full Name)
7. ⚠️ Interessen & Werte
8. ⚠️ Social Media Usage
9. ⚠️ Target Group Link
10. ⚠️ Created At

### Niedrig (Nice-to-Have):
11. ⚪ Color Palette
12. ⚪ Attention Span
13. ⚪ Erweiterte Visualisierungen
14. ⚪ Export-Funktionen

## CSS-Klassen-Namenskonvention

Verwende konsistent die Präfix `msqdx-glass-`:
- `msqdx-glass-bio-section`
- `msqdx-glass-demographics`
- `msqdx-glass-traits-grid`
- `msqdx-glass-pain-points-list`
- `msqdx-glass-goals-list`
- `msqdx-glass-communication-style`
- `msqdx-glass-chip-list`
- `msqdx-glass-trait-bar`
- `msqdx-glass-skepticism-bar`

## Material Symbols Icons

- `person` - Demographie
- `psychology` - Traits
- `sentiment_dissatisfied` - Pain Points
- `flag` - Goals
- `chat` - Communication
- `favorite` - Interests/Values
- `share` - Social Media
- `palette` - Color Palette
- `groups` - Target Group
- `schedule` - Timestamps


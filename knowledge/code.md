# Journey Mapper Feature - Implementation Prompt für Cursor

## 🎯 Ziel
Implementiere das **Audion Journey Mapper v2** Feature als vollständiges neues Modul mit:
- Drei Creation Modi (Manual, AI-generiert, Hybrid)
- Persona Validation mit Fit Scores
- Reality Tracking & Learning Loop
- Expectations vs Measurements

---

## 📋 Phase 1: Backend Foundation

### 1.1 Datenbank Migrations erstellen
**Dateien:** `/backend/alembic/versions/`

```bash
# Erstelle neue Migration
alembic revision -m "add_journey_mapper_tables"
```

**Tabellen zu erstellen:**

1. **journeys**
   - id, organization_id, project_id, target_group_id
   - name, description, journey_type
   - creation_mode (manual/ai_generated/hybrid)
   - status (draft/active/validated/archived)
   - validation_score, tracking_enabled
   - created_at, updated_at, created_by

2. **journey_phases**
   - id, journey_id, name, description, phase_order
   - expected_duration_min/max, duration_unit
   - expected_emotion, emotion_intensity
   - url_pattern, form_id, event_names (JSONB)
   - validation_status, validation_score
   - generated_by_ai, generation_confidence, source_chunks (JSONB)

3. **journey_phase_elements**
   - id, phase_id, element_type (ENUM)
   - content, element_order, metadata (JSONB)
   - source_type, source_chunk_ids (JSONB), confidence

4. **journey_expectations**
   - id, phase_id, metric_type (ENUM), metric_name
   - expected_value, expected_value_max, unit
   - comparison (ENUM: equals/greater_than/less_than/between)
   - warning_threshold_percent, critical_threshold_percent
   - hypothesis, based_on_persona_id
   - data_source, data_source_config (JSONB)

5. **journey_measurements**
   - id, expectation_id, period_start, period_end
   - actual_value, delta_absolute, delta_percent
   - status (ENUM: good/warning/critical/no_data)
   - sample_size, data_source, raw_data (JSONB)
   - synced_at

6. **journey_insights**
   - id, journey_id, phase_id, expectation_id
   - insight_type (ENUM: confirmation/contradiction/discovery)
   - title, description, ai_analysis, ai_recommendations (JSONB)
   - evidence (JSONB), confidence, priority
   - status (new/acknowledged/actioned/dismissed)

7. **journey_changes**
   - id, journey_id, phase_id, title, description
   - change_type, triggered_by_insight_id
   - expected_metric, expected_improvement_percent
   - implementation_status, implemented_at
   - actual_improvement_percent, result_status

**ENUM Types:**
```sql
CREATE TYPE element_type AS ENUM ('action', 'thought', 'feeling', 'touchpoint', 'pain_point', 'opportunity', 'question', 'quote');
CREATE TYPE metric_type AS ENUM ('sessions', 'users', 'page_views', 'bounce_rate', 'time_on_page', 'scroll_depth', 'engagement_rate', 'conversion_rate', 'form_submissions', 'cta_clicks', 'cta_click_rate', 'rage_clicks', 'u_turns', 'error_clicks', 'leads', 'opportunities', 'revenue');
CREATE TYPE comparison_operator AS ENUM ('equals', 'not_equals', 'greater_than', 'less_than', 'greater_or_equal', 'less_or_equal', 'between');
CREATE TYPE measurement_status AS ENUM ('good', 'warning', 'critical', 'no_data');
CREATE TYPE insight_type AS ENUM ('confirmation', 'contradiction', 'discovery', 'anomaly');
```

---

### 1.2 SQLAlchemy Models erstellen
**Datei:** `/backend/app/models/journey.py`

Erstelle Models für alle oben genannten Tabellen mit:
- Relationships zu Organizations, Projects, Target Groups, Personas
- JSON fields für flexible Daten (metadata, evidence, etc.)
- Computed properties (z.B. `overall_validation_score`)
- Helper Methods (z.B. `calculate_fit_score()`)

**Wichtige Relationships:**
```python
class Journey(Base):
    phases = relationship("JourneyPhase", back_populates="journey", cascade="all, delete-orphan")
    insights = relationship("JourneyInsight", back_populates="journey")
    changes = relationship("JourneyChange", back_populates="journey")
    target_group = relationship("TargetGroup", back_populates="journeys")

class JourneyPhase(Base):
    journey = relationship("Journey", back_populates="phases")
    elements = relationship("JourneyPhaseElement", back_populates="phase", cascade="all, delete-orphan")
    expectations = relationship("JourneyExpectation", back_populates="phase", cascade="all, delete-orphan")
```

---

### 1.3 Pydantic Schemas erstellen
**Datei:** `/backend/app/schemas/journey.py`

**Erforderliche Schemas:**

```python
# Base Schemas
class JourneyBase(BaseModel):
    name: str
    description: Optional[str]
    journey_type: str
    creation_mode: str
    target_group_id: Optional[UUID]

class JourneyCreate(JourneyBase):
    pass

class JourneyResponse(JourneyBase):
    id: UUID
    status: str
    validation_score: Optional[float]
    tracking_enabled: bool
    created_at: datetime
    updated_at: datetime
    phases: List["PhaseResponse"] = []

# Phase Schemas
class PhaseBase(BaseModel):
    name: str
    description: Optional[str]
    order: int
    expected_duration_min: Optional[int]
    expected_emotion: Optional[str]

class PhaseCreate(PhaseBase):
    pass

class PhaseResponse(PhaseBase):
    id: UUID
    journey_id: UUID
    validation_score: Optional[float]
    validation_status: str
    elements: List["ElementResponse"] = []
    expectations: List["ExpectationResponse"] = []

# Element Schemas
class ElementCreate(BaseModel):
    element_type: str
    content: str
    order: int
    metadata: Optional[dict]

class ElementResponse(ElementCreate):
    id: UUID
    phase_id: UUID
    source_type: Optional[str]
    confidence: Optional[float]

# Expectation Schemas
class ExpectationCreate(BaseModel):
    metric_type: str
    expected_value: float
    unit: str
    comparison: str
    hypothesis: Optional[str]
    data_source: str

class ExpectationResponse(ExpectationCreate):
    id: UUID
    phase_id: UUID
    latest_measurement: Optional["MeasurementSummary"]

# Validation Schemas
class ValidationRequest(BaseModel):
    persona_ids: List[UUID]
    mode: str = "automated"  # chat | automated | both

class PhaseValidationResult(BaseModel):
    phase_id: UUID
    phase_name: str
    fit_score: float
    status: str
    friction_points: List[dict]
    recommendations: List[str]

class JourneyValidationReport(BaseModel):
    journey_id: UUID
    overall_fit_score: float
    phases: List[PhaseValidationResult]
    validated_at: datetime
```

---

### 1.4 API Endpoints erstellen
**Datei:** `/backend/app/api/v1/journeys.py`

```python
router = APIRouter(prefix="/journeys", tags=["journeys"])

# CRUD Operations
@router.post("/", response_model=JourneyResponse)
async def create_journey(...)

@router.get("/{journey_id}", response_model=JourneyResponse)
async def get_journey(...)

@router.put("/{journey_id}", response_model=JourneyResponse)
async def update_journey(...)

@router.delete("/{journey_id}")
async def delete_journey(...)

@router.get("/", response_model=List[JourneyResponse])
async def list_journeys(...)

# Phase Operations
@router.post("/{journey_id}/phases", response_model=PhaseResponse)
async def create_phase(...)

@router.put("/{journey_id}/phases/{phase_id}", response_model=PhaseResponse)
async def update_phase(...)

@router.delete("/{journey_id}/phases/{phase_id}")
async def delete_phase(...)

@router.post("/{journey_id}/phases/{phase_id}/reorder")
async def reorder_phases(...)

# Element Operations
@router.post("/{journey_id}/phases/{phase_id}/elements")
async def create_element(...)

@router.put("/{journey_id}/phases/{phase_id}/elements/{element_id}")
async def update_element(...)

@router.delete("/{journey_id}/phases/{phase_id}/elements/{element_id}")
async def delete_element(...)

# Expectation Operations
@router.post("/{journey_id}/phases/{phase_id}/expectations")
async def create_expectation(...)

@router.get("/{journey_id}/phases/{phase_id}/expectations")
async def list_expectations(...)

# Validation
@router.post("/{journey_id}/validate", response_model=JourneyValidationReport)
async def validate_journey(...)

@router.get("/{journey_id}/validation-report")
async def get_validation_report(...)

# Reality Tracking
@router.post("/{journey_id}/tracking/configure")
async def configure_tracking(...)

@router.post("/{journey_id}/tracking/sync")
async def sync_measurements(...)

@router.get("/{journey_id}/measurements")
async def get_measurements(...)

# Insights & Learning
@router.get("/{journey_id}/insights")
async def get_insights(...)

@router.post("/{journey_id}/insights/{insight_id}/action")
async def action_insight(...)

# Change Tracking
@router.post("/{journey_id}/changes")
async def create_change(...)

@router.get("/{journey_id}/changes")
async def list_changes(...)
```

---

## 📋 Phase 2: AI Services

### 2.1 Journey Generation Service
**Datei:** `/backend/app/services/journey_generation.py`

```python
class JourneyGenerationService:
    """Generiert Journey aus Knowledge Base + Personas"""
    
    async def generate_journey_from_knowledge(
        self,
        target_group_id: UUID,
        journey_type: str,
        organization_id: UUID
    ) -> JourneyDraft:
        """
        1. Hole relevante Chunks aus Knowledge Base
        2. Hole Personas der Target Group
        3. Prompt LLM mit Context
        4. Parse Response zu Phases + Elements
        5. Generiere Initial Expectations
        """
        pass
    
    async def extract_phases_from_text(
        self,
        text: str,
        context: dict
    ) -> List[PhaseData]:
        """Extrahiert strukturierte Phases aus Fließtext"""
        pass
    
    async def suggest_expectations(
        self,
        phase: Phase,
        persona_id: UUID
    ) -> List[ExpectationSuggestion]:
        """Schlägt messbare Expectations basierend auf Persona vor"""
        pass
```

**LLM Prompt Template:**
```
Basierend auf folgenden Informationen:

TARGET GROUP: {target_group_name}
JOURNEY TYPE: {journey_type}

PERSONAS:
{persona_summaries}

KNOWLEDGE CONTEXT:
{relevant_chunks}

Erstelle eine Customer Journey Map mit folgender Struktur:

PHASES:
Für jede Phase benötige ich:
- Name (max 50 Zeichen)
- Beschreibung (2-3 Sätze)
- Erwartete Dauer (min-max in Minuten/Stunden/Tagen)
- Erwartete Emotion (frustrated/anxious/neutral/hopeful/satisfied/delighted)
- Emotion Intensität (0.0-1.0)

ELEMENTS pro Phase:
- Actions: Was macht der User?
- Thoughts: Was denkt der User?
- Touchpoints: Welche Kanäle nutzt er?
- Pain Points: Wo hakt es?
- Opportunities: Verbesserungspotential?

EXPECTATIONS pro Phase:
- Welche Metriken können gemessen werden?
- Welche Werte sind realistisch?
- Was sagt die Persona dazu?

Ausgabe als JSON.
```

---

### 2.2 Validation Service
**Datei:** `/backend/app/services/journey_validation.py`

```python
class JourneyValidationService:
    """Validiert Journey gegen Personas"""
    
    async def validate_journey_against_persona(
        self,
        journey_id: UUID,
        persona_id: UUID,
        mode: str = "automated"
    ) -> PhaseValidationResult:
        """
        1. Hole Journey mit allen Phases
        2. Hole Persona mit vollständigem Profil
        3. Für jede Phase:
           - Vergleiche erwartete Actions mit Persona Behaviors
           - Check Emotion Fit
           - Identifiziere Friction Points
        4. Berechne Fit Score (0-100)
        5. Generiere Recommendations
        """
        pass
    
    async def chat_mode_validation(
        self,
        phase: Phase,
        persona: Persona
    ) -> ValidationChatResult:
        """
        Simuliert Gespräch mit Persona:
        "Erik, würdest du in Phase 2 wirklich X tun?"
        → LLM antwortet als Persona
        """
        pass
    
    def calculate_fit_score(
        self,
        phase: Phase,
        persona: Persona,
        validation_data: dict
    ) -> float:
        """
        Fit Score Berechnung basierend auf:
        - Action Alignment (30%)
        - Emotion Fit (20%)
        - Content Relevance (25%)
        - Timing Plausibility (15%)
        - Missing Elements (10%)
        """
        pass
```

**Validation Prompt Template:**
```
Du bist {persona_name}, {persona_role}.

PERSONA KONTEXT:
{persona_details}

JOURNEY PHASE:
Name: {phase_name}
Beschreibung: {phase_description}
Erwartete Actions: {expected_actions}
Erwartete Duration: {duration}
Erwartete Emotion: {emotion}

FRAGE: Würde diese Phase für dich Sinn machen? 
Antworte aus deiner Perspektive als {persona_name}.

Analysiere:
1. Würdest du diese Actions wirklich so ausführen?
2. Fehlt etwas Wichtiges für dich?
3. Wo würdest du abbrechen oder frustriert sein?
4. Was würdest du stattdessen tun?

Gib mir:
- Fit Score (0-100)
- Friction Points (Liste)
- Recommendations (Liste)
- Quote als Persona
```

---

### 2.3 Analytics Integration Service
**Datei:** `/backend/app/services/analytics_integration.py`

```python
class AnalyticsIntegrationService:
    """Integriert verschiedene Analytics Quellen"""
    
    async def configure_data_source(
        self,
        journey_id: UUID,
        source_type: str,  # ga4, hotjar, hubspot, custom
        config: dict
    ):
        """Konfiguriert Data Source für Tracking"""
        pass
    
    async def sync_measurements(
        self,
        journey_id: UUID,
        period_start: date,
        period_end: date
    ) -> List[Measurement]:
        """
        1. Hole alle Expectations für Journey
        2. Für jede Expectation:
           - Query entsprechende Data Source
           - Berechne actual_value
           - Berechne delta vs expected
           - Bestimme Status (good/warning/critical)
        3. Speichere Measurements
        4. Generiere Insights wenn nötig
        """
        pass
    
    async def fetch_ga4_metric(
        self,
        config: dict,
        metric_type: str,
        filters: dict
    ) -> float:
        """Holt Metrik aus Google Analytics 4"""
        pass
    
    async def fetch_hotjar_metric(
        self,
        config: dict,
        metric_type: str,
        filters: dict
    ) -> float:
        """Holt Metrik aus Hotjar"""
        pass
```

---

### 2.4 Insight Generation Service
**Datei:** `/backend/app/services/insight_generation.py`

```python
class InsightGenerationService:
    """Generiert automatische Insights aus Measurements"""
    
    async def analyze_measurements(
        self,
        journey_id: UUID
    ) -> List[Insight]:
        """
        Analysiert Measurements und generiert Insights:
        
        CONFIRMATION:
        - Expected: 40% CTR, Actual: 42% → "Prediction bestätigt"
        
        CONTRADICTION:
        - Expected: User sucht ROI, Actual: 70% suchen Pricing
        
        DISCOVERY:
        - Unerwartetes Pattern: Phase 2 hat 3x mehr Exits als Phase 1
        
        ANOMALY:
        - Plötzlicher Drop von 45% auf 12%
        """
        pass
    
    async def generate_ai_recommendations(
        self,
        insight: Insight,
        context: dict
    ) -> List[str]:
        """LLM generiert konkrete Action Items"""
        pass
    
    async def suggest_persona_updates(
        self,
        persona_id: UUID,
        contradictions: List[Insight]
    ) -> List[PersonaUpdate]:
        """
        Wenn mehrere Contradictions auf gleichen Point zeigen:
        → Schlage Persona Update vor
        """
        pass
```

---

## 📋 Phase 3: Celery Tasks

### 3.1 Background Tasks
**Datei:** `/backend/app/tasks/journey_tasks.py`

```python
from celery import shared_task

@shared_task(name="journey.generate")
def generate_journey_task(
    target_group_id: str,
    journey_type: str,
    organization_id: str,
    user_id: str
):
    """
    Async Journey Generation
    - Kann 30-60 Sekunden dauern
    - User bekommt Notification wenn fertig
    """
    pass

@shared_task(name="journey.validate")
def validate_journey_task(
    journey_id: str,
    persona_ids: List[str]
):
    """
    Async Validation gegen multiple Personas
    - Parallel für bessere Performance
    """
    pass

@shared_task(name="journey.sync_measurements", rate_limit="10/m")
def sync_measurements_task(journey_id: str):
    """
    Periodisches Syncing von Analytics
    - Läuft täglich
    - Rate Limited um API Quotas zu schonen
    """
    pass

@shared_task(name="journey.analyze_insights", rate_limit="5/m")
def analyze_insights_task(journey_id: str):
    """
    Generiert Insights aus neuen Measurements
    - Läuft nach jedem Sync
    """
    pass

@shared_task(name="journey.send_alert")
def send_alert_task(
    journey_id: str,
    alert_type: str,
    data: dict
):
    """
    Sendet Alerts bei kritischen Abweichungen
    - Email
    - In-App Notification
    - Optional: Slack Webhook
    """
    pass
```

### 3.2 Celery Beat Schedule
**Datei:** `/backend/app/celeryconfig.py`

```python
from celery.schedules import crontab

beat_schedule = {
    'sync-all-active-journeys': {
        'task': 'journey.sync_all_active',
        'schedule': crontab(hour=2, minute=0),  # Täglich 2 Uhr
    },
    'analyze-insights-daily': {
        'task': 'journey.analyze_all_insights',
        'schedule': crontab(hour=3, minute=0),  # Nach Sync
    },
    'cleanup-old-measurements': {
        'task': 'journey.cleanup_old_data',
        'schedule': crontab(day_of_week=0, hour=4, minute=0),  # Sonntags
    },
}
```

---

## 📋 Phase 4: Frontend Components

### 4.1 State Management
**Datei:** `/frontend/src/stores/journeyStore.ts`

```typescript
import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';

interface JourneyStore {
  // State
  journey: Journey | null;
  phases: Phase[];
  selectedPhaseId: string | null;
  editorMode: 'view' | 'edit' | 'validate';
  validationResults: Record<string, PhaseValidationResult>;
  isDirty: boolean;
  isLoading: boolean;
  
  // Actions
  loadJourney: (id: string) => Promise<void>;
  createJourney: (data: JourneyCreate) => Promise<string>;
  updateJourney: (data: Partial<Journey>) => Promise<void>;
  
  // Phase Actions
  addPhase: (phase: PhaseCreate) => void;
  updatePhase: (id: string, data: Partial<Phase>) => void;
  deletePhase: (id: string) => void;
  reorderPhases: (fromIndex: number, toIndex: number) => void;
  
  // Element Actions
  addElement: (phaseId: string, element: ElementCreate) => void;
  updateElement: (id: string, data: Partial<Element>) => void;
  deleteElement: (id: string) => void;
  
  // Expectation Actions
  addExpectation: (phaseId: string, exp: ExpectationCreate) => void;
  updateExpectation: (id: string, data: Partial<Expectation>) => void;
  deleteExpectation: (id: string) => void;
  
  // Validation
  validateJourney: (personaIds: string[]) => Promise<void>;
  
  // UI State
  selectPhase: (id: string | null) => void;
  setEditorMode: (mode: 'view' | 'edit' | 'validate') => void;
  setDirty: (isDirty: boolean) => void;
}

export const useJourneyStore = create<JourneyStore>()(
  devtools(
    persist(
      (set, get) => ({
        // Initial State
        journey: null,
        phases: [],
        selectedPhaseId: null,
        editorMode: 'edit',
        validationResults: {},
        isDirty: false,
        isLoading: false,
        
        // Implementations...
      }),
      {
        name: 'journey-storage',
        partialize: (state) => ({
          selectedPhaseId: state.selectedPhaseId,
          editorMode: state.editorMode,
        }),
      }
    )
  )
);
```

---

### 4.2 Core Components

#### JourneyEditorPage
**Datei:** `/frontend/src/features/journeys/pages/JourneyEditorPage.tsx`

```typescript
export function JourneyEditorPage() {
  const { journeyId } = useParams();
  const { journey, loadJourney } = useJourneyStore();
  
  useEffect(() => {
    if (journeyId) {
      loadJourney(journeyId);
    }
  }, [journeyId]);
  
  return (
    <div className="journey-editor">
      <JourneyToolbar />
      <div className="editor-content">
        <JourneyCanvas />
        <PhaseDetailPanel />
      </div>
    </div>
  );
}
```

#### JourneyCanvas
**Datei:** `/frontend/src/features/journeys/components/JourneyCanvas.tsx`

```typescript
export function JourneyCanvas() {
  const { phases, selectedPhaseId, selectPhase, reorderPhases } = useJourneyStore();
  const { attributes, listeners, setNodeRef, transform } = useDndContext();
  
  return (
    <div className="journey-canvas">
      <div className="phases-track">
        {phases.map((phase, index) => (
          <PhaseCard
            key={phase.id}
            phase={phase}
            isSelected={phase.id === selectedPhaseId}
            onSelect={() => selectPhase(phase.id)}
            index={index}
          />
        ))}
        <AddPhaseButton />
      </div>
      
      <EmotionCurve phases={phases} />
      <TouchpointLane phases={phases} />
    </div>
  );
}
```

#### PhaseCard
**Datei:** `/frontend/src/features/journeys/components/PhaseCard.tsx`

```typescript
interface PhaseCardProps {
  phase: Phase;
  isSelected: boolean;
  onSelect: () => void;
  index: number;
}

export function PhaseCard({ phase, isSelected, onSelect, index }: PhaseCardProps) {
  const { attributes, listeners, setNodeRef, transform } = useSortable({
    id: phase.id,
  });
  
  return (
    <div
      ref={setNodeRef}
      className={cn(
        "phase-card",
        isSelected && "selected",
        getStatusColor(phase.validationStatus)
      )}
      onClick={onSelect}
      {...attributes}
      {...listeners}
    >
      <div className="phase-header">
        <span className="phase-number">{index + 1}</span>
        <h3>{phase.name}</h3>
        {phase.validationScore && (
          <Badge variant={getScoreVariant(phase.validationScore)}>
            {phase.validationScore}%
          </Badge>
        )}
      </div>
      
      <div className="phase-meta">
        <span className="duration">
          {formatDuration(phase.expectedDurationMin, phase.expectedDurationMax)}
        </span>
        <EmotionIcon emotion={phase.expectedEmotion} />
      </div>
      
      <div className="phase-touchpoints">
        {phase.elements
          .filter(el => el.type === 'touchpoint')
          .map(tp => (
            <TouchpointBadge key={tp.id} touchpoint={tp} />
          ))}
      </div>
    </div>
  );
}
```

#### PhaseDetailPanel
**Datei:** `/frontend/src/features/journeys/components/PhaseDetailPanel.tsx`

```typescript
export function PhaseDetailPanel() {
  const { selectedPhaseId, phases, updatePhase } = useJourneyStore();
  
  const phase = phases.find(p => p.id === selectedPhaseId);
  
  if (!phase) {
    return <EmptyState message="Wähle eine Phase aus" />;
  }
  
  return (
    <div className="phase-detail-panel">
      <Tabs defaultValue="details">
        <TabsList>
          <TabsTrigger value="details">Details</TabsTrigger>
          <TabsTrigger value="elements">Elements</TabsTrigger>
          <TabsTrigger value="expectations">Expectations</TabsTrigger>
          <TabsTrigger value="validation">Validation</TabsTrigger>
        </TabsList>
        
        <TabsContent value="details">
          <PhaseDetailsForm phase={phase} />
        </TabsContent>
        
        <TabsContent value="elements">
          <PhaseElementsList phase={phase} />
        </TabsContent>
        
        <TabsContent value="expectations">
          <ExpectationsList phase={phase} />
        </TabsContent>
        
        <TabsContent value="validation">
          <ValidationResults phase={phase} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
```

#### ExpectationsList
**Datei:** `/frontend/src/features/journeys/components/ExpectationsList.tsx`

```typescript
export function ExpectationsList({ phase }: { phase: Phase }) {
  const { addExpectation, updateExpectation, deleteExpectation } = useJourneyStore();
  const [isAdding, setIsAdding] = useState(false);
  
  return (
    <div className="expectations-list">
      <div className="list-header">
        <h3>Erwartete Metriken</h3>
        <Button onClick={() => setIsAdding(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Add Expectation
        </Button>
      </div>
      
      {phase.expectations?.map(exp => (
        <ExpectationCard
          key={exp.id}
          expectation={exp}
          onUpdate={(data) => updateExpectation(exp.id, data)}
          onDelete={() => deleteExpectation(exp.id)}
        />
      ))}
      
      {isAdding && (
        <ExpectationForm
          phaseId={phase.id}
          onSubmit={(data) => {
            addExpectation(phase.id, data);
            setIsAdding(false);
          }}
          onCancel={() => setIsAdding(false)}
        />
      )}
    </div>
  );
}
```

#### ValidationResults
**Datei:** `/frontend/src/features/journeys/components/ValidationResults.tsx`

```typescript
export function ValidationResults({ phase }: { phase: Phase }) {
  const { validationResults, validateJourney } = useJourneyStore();
  const [selectedPersonas, setSelectedPersonas] = useState<string[]>([]);
  const { data: personas } = useTargetGroupPersonas();
  
  const result = validationResults[phase.id];
  
  return (
    <div className="validation-results">
      <div className="validation-header">
        <h3>Persona Validation</h3>
        <div className="persona-selector">
          <MultiSelect
            options={personas}
            value={selectedPersonas}
            onChange={setSelectedPersonas}
            placeholder="Select Personas"
          />
          <Button
            onClick={() => validateJourney(selectedPersonas)}
            disabled={selectedPersonas.length === 0}
          >
            Validate
          </Button>
        </div>
      </div>
      
      {result && (
        <>
          <Card className="fit-score-card">
            <CardHeader>
              <CardTitle>Fit Score</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="score-display">
                <span className={cn(
                  "score-value",
                  getScoreColor(result.fitScore)
                )}>
                  {result.fitScore}%
                </span>
                <Badge variant={getScoreVariant(result.status)}>
                  {result.status}
                </Badge>
              </div>
            </CardContent>
          </Card>
          
          <Card className="friction-points-card">
            <CardHeader>
              <CardTitle>Friction Points</CardTitle>
            </CardHeader>
            <CardContent>
              {result.frictionPoints.map(fp => (
                <Alert key={fp.id} variant={getSeverityVariant(fp.severity)}>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>{fp.description}</AlertTitle>
                  {fp.personaQuote && (
                    <AlertDescription className="persona-quote">
                      "{fp.personaQuote}"
                    </AlertDescription>
                  )}
                </Alert>
              ))}
            </CardContent>
          </Card>
          
          <Card className="recommendations-card">
            <CardHeader>
              <CardTitle>Recommendations</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="recommendations-list">
                {result.recommendations.map((rec, idx) => (
                  <li key={idx}>
                    <CheckCircle className="w-4 h-4 text-green-500" />
                    <span>{rec}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
```

---

### 4.3 Additional Views

#### JourneyDashboard
**Datei:** `/frontend/src/features/journeys/pages/JourneyDashboard.tsx`

```typescript
export function JourneyDashboard() {
  const { journey } = useJourneyStore();
  const { data: measurements } = useJourneyMeasurements(journey?.id);
  const { data: insights } = useJourneyInsights(journey?.id);
  
  return (
    <div className="journey-dashboard">
      <div className="dashboard-header">
        <h1>{journey?.name}</h1>
        <div className="actions">
          <Button variant="outline">
            <BarChart3 className="w-4 h-4 mr-2" />
            Export Report
          </Button>
          <Button>
            <RefreshCw className="w-4 h-4 mr-2" />
            Sync Data
          </Button>
        </div>
      </div>
      
      <div className="dashboard-grid">
        <Card className="col-span-2">
          <CardHeader>
            <CardTitle>Expected vs Actual Performance</CardTitle>
          </CardHeader>
          <CardContent>
            <ExpectationVsActualChart measurements={measurements} />
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle>Recent Insights</CardTitle>
          </CardHeader>
          <CardContent>
            <InsightsList insights={insights} />
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle>Phase Performance</CardTitle>
          </CardHeader>
          <CardContent>
            <PhasePerformanceList phases={journey?.phases} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
```

---

## 📋 Phase 5: Integration & Testing

### 5.1 API Client
**Datei:** `/frontend/src/lib/api/journeys.ts`

```typescript
export const journeysApi = {
  // CRUD
  createJourney: (data: JourneyCreate) => 
    api.post<JourneyResponse>('/journeys', data),
  
  getJourney: (id: string) => 
    api.get<JourneyResponse>(`/journeys/${id}`),
  
  updateJourney: (id: string, data: Partial<Journey>) => 
    api.put<JourneyResponse>(`/journeys/${id}`, data),
  
  deleteJourney: (id: string) => 
    api.delete(`/journeys/${id}`),
  
  listJourneys: (params?: ListParams) => 
    api.get<JourneyResponse[]>('/journeys', { params }),
  
  // Phases
  createPhase: (journeyId: string, data: PhaseCreate) => 
    api.post<PhaseResponse>(`/journeys/${journeyId}/phases`, data),
  
  updatePhase: (journeyId: string, phaseId: string, data: Partial<Phase>) => 
    api.put<PhaseResponse>(`/journeys/${journeyId}/phases/${phaseId}`, data),
  
  deletePhase: (journeyId: string, phaseId: string) => 
    api.delete(`/journeys/${journeyId}/phases/${phaseId}`),
  
  reorderPhases: (journeyId: string, phaseOrders: PhaseOrder[]) => 
    api.post(`/journeys/${journeyId}/phases/reorder`, { phaseOrders }),
  
  // Validation
  validateJourney: (journeyId: string, request: ValidationRequest) => 
    api.post<JourneyValidationReport>(`/journeys/${journeyId}/validate`, request),
  
  // Tracking
  syncMeasurements: (journeyId: string) => 
    api.post(`/journeys/${journeyId}/tracking/sync`),
  
  getMeasurements: (journeyId: string, params?: MeasurementParams) => 
    api.get<MeasurementResponse[]>(`/journeys/${journeyId}/measurements`, { params }),
  
  // Insights
  getInsights: (journeyId: string, params?: InsightParams) => 
    api.get<InsightResponse[]>(`/journeys/${journeyId}/insights`, { params }),
};
```

---

### 5.2 React Query Hooks
**Datei:** `/frontend/src/features/journeys/hooks/useJourneys.ts`

```typescript
export function useJourney(id: string | undefined) {
  return useQuery({
    queryKey: ['journey', id],
    queryFn: () => journeysApi.getJourney(id!),
    enabled: !!id,
  });
}

export function useJourneys(params?: ListParams) {
  return useQuery({
    queryKey: ['journeys', params],
    queryFn: () => journeysApi.listJourneys(params),
  });
}

export function useCreateJourney() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: journeysApi.createJourney,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['journeys'] });
    },
  });
}

export function useValidateJourney() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ id, request }: { id: string; request: ValidationRequest }) => 
      journeysApi.validateJourney(id, request),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['journey', id] });
    },
  });
}

export function useJourneyMeasurements(journeyId: string | undefined) {
  return useQuery({
    queryKey: ['journey-measurements', journeyId],
    queryFn: () => journeysApi.getMeasurements(journeyId!),
    enabled: !!journeyId,
    refetchInterval: 5 * 60 * 1000, // Alle 5 Minuten
  });
}

export function useJourneyInsights(journeyId: string | undefined) {
  return useQuery({
    queryKey: ['journey-insights', journeyId],
    queryFn: () => journeysApi.getInsights(journeyId!),
    enabled: !!journeyId,
  });
}

export function useSyncMeasurements() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: journeysApi.syncMeasurements,
    onSuccess: (_, journeyId) => {
      queryClient.invalidateQueries({ queryKey: ['journey-measurements', journeyId] });
      queryClient.invalidateQueries({ queryKey: ['journey-insights', journeyId] });
      toast.success('Measurements synced successfully');
    },
  });
}
```

---

### 5.3 Tests

#### Backend Tests
**Datei:** `/backend/tests/test_journeys.py`

```python
import pytest
from app.services.journey_generation import JourneyGenerationService
from app.services.journey_validation import JourneyValidationService

class TestJourneyGeneration:
    async def test_generate_journey_from_knowledge(self):
        # Test AI-Generation
        pass
    
    async def test_extract_phases_from_text(self):
        # Test Phase Extraction
        pass

class TestJourneyValidation:
    async def test_validate_journey_against_persona(self):
        # Test Validation Logic
        pass
    
    async def test_fit_score_calculation(self):
        # Test Score Berechnung
        pass

class TestAnalyticsIntegration:
    async def test_sync_measurements(self):
        # Test Measurement Sync
        pass
    
    async def test_insight_generation(self):
        # Test Insight Creation
        pass
```

#### Frontend Tests
**Datei:** `/frontend/src/features/journeys/__tests__/JourneyCanvas.test.tsx`

```typescript
import { render, screen, fireEvent } from '@testing-library/react';
import { JourneyCanvas } from '../components/JourneyCanvas';

describe('JourneyCanvas', () => {
  it('renders phases correctly', () => {
    // Test Phase Rendering
  });
  
  it('handles phase selection', () => {
    // Test Selection
  });
  
  it('supports drag and drop reordering', () => {
    // Test D&D
  });
});
```

---

## 📋 Phase 6: Documentation & Deployment

### 6.1 API Documentation
Aktualisiere `/backend/docs/api.md` mit:
- Alle neuen Endpoints
- Request/Response Beispiele
- Validation Rules
- Rate Limits

### 6.2 User Documentation
Erstelle `/docs/features/journey-mapper.md`:
- Feature Overview
- Getting Started Guide
- Best Practices
- Troubleshooting

### 6.3 Migration Guide
Erstelle `/docs/migrations/journey-mapper.md`:
- Datenbank Migration Steps
- Environment Variables
- Breaking Changes
- Rollback Procedure

---

## 🎯 Success Criteria

- [ ] Alle Datenbank Tables erstellt und migriert
- [ ] Backend API vollständig implementiert
- [ ] AI Services funktionieren (Generation, Validation, Insights)
- [ ] Celery Tasks laufen zuverlässig
- [ ] Frontend Editor ist intuitiv bedienbar
- [ ] Drag & Drop funktioniert
- [ ] Validation zeigt aussagekräftige Ergebnisse
- [ ] Reality Tracking integriert mindestens GA4
- [ ] Insights werden automatisch generiert
- [ ] Tests für kritische Funktionen vorhanden
- [ ] Dokumentation vollständig

---

## 🚀 Deployment Checklist

1. **Backend:**
   - [ ] Migrations ausgeführt
   - [ ] Celery Worker gestartet
   - [ ] Celery Beat scheduler aktiv
   - [ ] Environment Variables gesetzt
   - [ ] API Tests erfolgreich

2. **Frontend:**
   - [ ] Components gebaut
   - [ ] API Integration getestet
   - [ ] Bundle Size akzeptabel
   - [ ] Performance optimiert

3. **Infrastructure:**
   - [ ] Redis für Celery läuft
   - [ ] Background Jobs monitoring eingerichtet
   - [ ] Alerts konfiguriert
   - [ ] Backup Strategy definiert

---

## 💡 Hinweise für Cursor

### Priorisierung:
1. **Zuerst Backend Foundation** - Ohne solide Datenbasis geht nichts
2. **Dann AI Services** - Das Herzstück des Features
3. **Parallel Frontend** - Kann parallel zu AI Services entwickelt werden
4. **Zuletzt Integration** - Alles zusammenführen

### Code Quality:
- Nutze TypeScript Types strikt
- Implementiere Error Handling überall
- Schreibe Tests für Business Logic
- Dokumentiere komplexe Algorithmen
- Nutze Design Patterns (Factory, Strategy, Observer)

### Performance:
- Lazy Loading für große Journeys
- Debounce bei Auto-Save
- React.memo für teure Components
- Query Caching mit React Query
- Backend: N+1 Queries vermeiden

### UX Considerations:
- Loading States für alle Async Operations
- Optimistic Updates wo möglich
- Undo/Redo für Editor Actions
- Keyboard Shortcuts
- Responsive Design

---

**Viel Erfolg bei der Implementation! 🚀**
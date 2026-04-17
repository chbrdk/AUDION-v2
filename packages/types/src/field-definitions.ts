/**
 * Generische Feld-Definitionen für editierbare Entitäts-Felder.
 * 
 * Diese Datei definiert, wie Felder für verschiedene Entitäten dargestellt und editiert werden.
 */

/**
 * Definiert ein editierbares Feld für eine Entität.
 */
export type FieldSelectOption = {
  value: string | number;
  label: string;
  /** i18n key (e.g. personaAdmin.genderMale); falls back to label */
  labelKey?: string;
};

export type FieldDefinition = {
  /**
   * Feld-Key (z.B. "gender", "name")
   */
  key: string;
  
  /**
   * Anzeige-Label
   */
  label: string;

  /** Optional i18n dictionary key for the label (e.g. personaAdmin.gender) */
  labelKey?: string;
  
  /**
   * Feld-Typ bestimmt, welches UI-Element verwendet wird
   */
  type: 'text' | 'number' | 'select' | 'textarea' | 'slider' | 'date' | 'boolean';
  
  /**
   * Typ-spezifische Konfiguration
   */
  config?: {
    // Für select
    options?: FieldSelectOption[];
    
    // Für slider
    min?: number;
    max?: number;
    step?: number;
    
    // Für text/textarea
    placeholder?: string;
    multiline?: boolean;
    
    // Validierung
    required?: boolean;
    pattern?: string;
    minLength?: number;
    maxLength?: number;
  };
  
  /**
   * Gruppierung für UI (z.B. "demographics", "basic")
   */
  group?: string;
  
  /**
   * Sektion für UI (z.B. "profile", "metadata")
   */
  section?: string;
  
  /**
   * Reihenfolge innerhalb der Gruppe
   */
  order?: number;
};

/**
 * Feld-Definitionen für verschiedene Entitäten.
 */
export const ENTITY_FIELD_DEFINITIONS: Record<string, FieldDefinition[]> = {
  persona: [
    // Basic Fields
    {
      key: 'name',
      label: 'Name',
      labelKey: 'personaAdmin.name',
      type: 'text',
      group: 'basic',
      order: 1,
      config: { required: true }
    },
    {
      key: 'headline',
      label: 'Headline',
      labelKey: 'personaAdmin.headline',
      type: 'text',
      group: 'basic',
      order: 2,
    },
    {
      key: 'segment',
      label: 'Segment',
      labelKey: 'personaAdmin.segment',
      type: 'text',
      group: 'basic',
      order: 3,
    },
    
    // Demographics
    {
      key: 'gender',
      label: 'Gender',
      labelKey: 'personaAdmin.gender',
      type: 'select',
      group: 'demographics',
      order: 1,
      config: {
        options: [
          { value: 'male', label: 'Male', labelKey: 'personaAdmin.genderMale' },
          { value: 'female', label: 'Female', labelKey: 'personaAdmin.genderFemale' },
          { value: 'diverse', label: 'Diverse', labelKey: 'personaAdmin.genderDiverse' }
        ]
      }
    },
    {
      key: 'age',
      label: 'Age',
      labelKey: 'personaAdmin.age',
      type: 'slider',
      group: 'demographics',
      order: 2,
      config: { min: 18, max: 100, step: 1 }
    },
    {
      key: 'location',
      label: 'Location',
      labelKey: 'personaAdmin.location',
      type: 'text',
      group: 'demographics',
      order: 3,
    },
    {
      key: 'media_affinity',
      label: 'Media Affinity',
      labelKey: 'personaAdmin.mediaAffinity',
      type: 'slider',
      group: 'demographics',
      order: 4,
      config: { min: 0, max: 100, step: 1 }
    },
    {
      key: 'full_name',
      label: 'Full Name',
      labelKey: 'personaAdmin.fullName',
      type: 'text',
      group: 'demographics',
      order: 5,
    },
  ],
  
  targetGroup: [
    {
      key: 'status',
      label: 'Publication status',
      labelKey: 'targetGroupsAdmin.publicationStatus',
      type: 'select',
      group: 'basic',
      order: 0,
      config: {
        options: [
          { value: 'draft', label: 'Draft', labelKey: 'targetGroupsAdmin.statusDraft' },
          { value: 'published', label: 'Published', labelKey: 'targetGroupsAdmin.statusPublished' },
        ],
      },
    },
    {
      key: 'name',
      label: 'Name',
      labelKey: 'targetGroupsAdmin.name',
      type: 'text',
      group: 'basic',
      order: 1,
      config: { required: true }
    },
    {
      key: 'segment',
      label: 'Segment',
      labelKey: 'targetGroupsAdmin.segment',
      type: 'text',
      group: 'basic',
      order: 2,
      config: { required: true }
    },
    {
      key: 'description',
      label: 'Description',
      labelKey: 'targetGroupsAdmin.description',
      type: 'textarea',
      group: 'basic',
      order: 3,
    },
    {
      key: 'name_de',
      label: 'Name (DE)',
      type: 'text',
      group: 'basic',
      order: 4,
    },
    {
      key: 'segment_de',
      label: 'Segment (DE)',
      type: 'text',
      group: 'basic',
      order: 5,
    },
    {
      key: 'description_de',
      label: 'Description (DE)',
      type: 'textarea',
      group: 'basic',
      order: 6,
    },
  ],
  
  // Zukünftig erweiterbar
  document: [
    {
      key: 'filename',
      label: 'Filename',
      labelKey: 'entityFields.document.filename',
      type: 'text',
      group: 'basic',
      order: 1,
    },
    {
      key: 'insight_summary',
      label: 'Insight Summary',
      labelKey: 'entityFields.document.insightSummary',
      type: 'textarea',
      group: 'metadata',
      order: 1,
    },
  ],
  
  knowledge: [
    {
      key: 'title',
      label: 'Title',
      labelKey: 'entityFields.knowledge.title',
      type: 'text',
      group: 'basic',
      order: 1,
      config: { required: true }
    },
    {
      key: 'content',
      label: 'Content',
      labelKey: 'entityFields.knowledge.content',
      type: 'textarea',
      group: 'basic',
      order: 2,
      config: { required: true }
    },
  ],
};

/**
 * Hole Feld-Definitionen für eine Entität.
 */
export function getFieldDefinitions(entityType: string): FieldDefinition[] {
  return ENTITY_FIELD_DEFINITIONS[entityType] || [];
}

/**
 * Gruppiere Felder nach Gruppen.
 */
export function groupFields(fields: FieldDefinition[]): Record<string, FieldDefinition[]> {
  const grouped: Record<string, FieldDefinition[]> = {};
  
  fields
    .sort((a, b) => (a.order || 0) - (b.order || 0))
    .forEach(field => {
      const group = field.group || 'other';
      if (!grouped[group]) {
        grouped[group] = [];
      }
      grouped[group].push(field);
    });
  
  return grouped;
}

/**
 * Prüfe, ob ein Feld ein demografisches Feld ist (für Persona).
 */
export function isDemographicField(fieldName: string): boolean {
  const personaFields = getFieldDefinitions('persona');
  const field = personaFields.find(f => f.key === fieldName);
  return field?.group === 'demographics';
}


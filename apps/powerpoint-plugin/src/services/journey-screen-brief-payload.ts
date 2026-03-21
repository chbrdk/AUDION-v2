import type {
  ElementResponse,
  JourneyResponse,
  PhaseResponse,
  Persona,
  TargetGroup,
} from '../types';

/**
 * JSON body for `POST /api/v1/journey-screen-brief` (CREATION).
 * Kept in sync with CREATION `journeyScreenBriefRequestSchema`.
 */
export type JourneyScreenBriefRequestBody = {
  journey: Pick<JourneyResponse, 'id' | 'name' | 'journey_type' | 'description' | 'phases'>;
  phaseId: string;
  /** `id` / `headline` omitted when empty (CREATION accepts optional). */
  persona: Pick<Persona, 'name' | 'segment'> & { id?: string; headline?: string };
  targetGroup?: Pick<TargetGroup, 'id' | 'name' | 'description'>;
  locale?: 'de' | 'en';
  componentLibrary?: 'default' | 'porsche';
  renderMode?: 'production' | 'experimental' | 'free';
  marketingTemplate?: 'default' | 'porsche-editorial';
};

export type BuildJourneyScreenBriefOptions = {
  targetGroup?: TargetGroup | null;
  locale?: 'de' | 'en';
  componentLibrary?: 'default' | 'porsche';
  renderMode?: 'production' | 'experimental' | 'free';
  marketingTemplate?: 'default' | 'porsche-editorial';
};

function safeTrimmedString(value: unknown, fallback: string): string {
  if (value == null) return fallback;
  const s = String(value).trim();
  return s.length > 0 ? s : fallback;
}

function optionalString(value: unknown): string | undefined {
  if (value == null) return undefined;
  const s = String(value).trim();
  return s.length > 0 ? s : undefined;
}

function optionalId(value: unknown): string | undefined {
  if (value == null) return undefined;
  const s = String(value).trim();
  return s.length > 0 ? s : undefined;
}

/**
 * AUDION APIs often return `null` for optional fields; CREATION Zod expects strings or omitted keys — never JSON `null`.
 */
export function sanitizeElementForScreenBrief(el: ElementResponse): ElementResponse {
  const meta = el.metadata;
  const cleanMeta =
    meta != null && typeof meta === 'object' && !Array.isArray(meta)
      ? (meta as Record<string, unknown>)
      : undefined;
  return {
    id: optionalId(el.id) ?? '',
    element_type: safeTrimmedString(el.element_type, 'unknown'),
    content: el.content == null ? '' : String(el.content),
    element_order: typeof el.element_order === 'number' && !Number.isNaN(el.element_order) ? el.element_order : 0,
    ...(cleanMeta && Object.keys(cleanMeta).length > 0 ? { metadata: cleanMeta } : {}),
  };
}

export function sanitizePhaseForScreenBrief(phase: PhaseResponse): PhaseResponse {
  const rawElements = Array.isArray(phase.elements) ? phase.elements : [];
  const elements = rawElements
    .filter((e): e is ElementResponse => e != null && typeof e === 'object')
    .map((e) => sanitizeElementForScreenBrief(e));

  return {
    id: safeTrimmedString(phase.id, 'unknown-phase'),
    name: safeTrimmedString(phase.name, 'Phase'),
    description: optionalString(phase.description),
    phase_order:
      typeof phase.phase_order === 'number' && !Number.isNaN(phase.phase_order) ? phase.phase_order : 0,
    elements,
  };
}

export function sanitizeJourneyForScreenBrief(journey: JourneyResponse): Pick<
  JourneyResponse,
  'id' | 'name' | 'journey_type' | 'description' | 'phases'
> {
  const rawPhases = Array.isArray(journey.phases) ? journey.phases : [];
  const phases = rawPhases
    .filter((p): p is PhaseResponse => p != null && typeof p === 'object')
    .map((p) => sanitizePhaseForScreenBrief(p));

  return {
    id: safeTrimmedString(journey.id, 'unknown-journey'),
    name: safeTrimmedString(journey.name, 'Journey'),
    journey_type: journey.journey_type == null ? '' : String(journey.journey_type),
    description: optionalString(journey.description),
    phases,
  };
}

/**
 * Builds the CREATION request body from a full journey (AUDION API) and selections.
 * @throws If `phaseId` is not found on `journey.phases`.
 */
export function buildJourneyScreenBriefRequestBody(
  journey: JourneyResponse,
  phaseId: string,
  persona: Persona,
  options?: BuildJourneyScreenBriefOptions
): JourneyScreenBriefRequestBody {
  const sanitizedJourney = sanitizeJourneyForScreenBrief(journey);
  const phase = sanitizedJourney.phases?.find((p) => p.id === phaseId);
  if (!phase) {
    throw new Error(`Unknown phaseId: ${phaseId}`);
  }

  const body: JourneyScreenBriefRequestBody = {
    journey: sanitizedJourney,
    phaseId,
    persona: (() => {
      const pid = optionalId(persona.id);
      const headline = optionalString(persona.headline);
      return {
        ...(pid ? { id: pid } : {}),
        name: safeTrimmedString(persona.name, 'Persona'),
        segment: safeTrimmedString(persona.segment, 'Segment'),
        ...(headline ? { headline } : {}),
      };
    })(),
  };

  const tg = options?.targetGroup;
  if (tg != null) {
    const tgId = optionalId(tg.id);
    const tgName = safeTrimmedString(tg.name, '');
    const tgDesc = optionalString(tg.description);
    if (tgId && tgName) {
      body.targetGroup = {
        id: tgId,
        name: tgName,
        ...(tgDesc ? { description: tgDesc } : {}),
      };
    }
  }

  if (options?.locale) body.locale = options.locale;
  if (options?.componentLibrary) body.componentLibrary = options.componentLibrary;
  if (options?.renderMode) body.renderMode = options.renderMode;
  if (options?.marketingTemplate) body.marketingTemplate = options.marketingTemplate;

  return body;
}

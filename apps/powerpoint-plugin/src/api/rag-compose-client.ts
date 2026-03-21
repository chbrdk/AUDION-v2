/**
 * RAG Compose API client.
 * POST /api/v1/compose → composition JSON + resolved component keys.
 * Used in RAGDesignPanel (browser/iframe).
 */

export type ViewportType = 'desktop' | 'tablet' | 'mobile';

export interface ComposeRequest {
  prompt: string;
  projectId?: string;
  slideContext?: string;
  viewport?: ViewportType;
  preferences?: string;
}

export interface ComposeResponse {
  compositionId?: string;
  composition: CompositionJSON;
  resolvedKeys: Record<string, string>;
  resolvedTypes?: Record<string, 'component' | 'component_set'>;
  warnings?: string[];
}

export interface CompositionJSON {
  page: string;
  width?: number;
  sectionGap?: number;
  sections: CompositionSection[];
}

export interface CompositionSection {
  name: string;
  type?: 'hero' | 'features' | 'cta' | 'footer' | 'content' | 'generic';
  layout?: 'vertical' | 'horizontal';
  padding?: number | [number, number] | [number, number, number, number];
  gap?: number;
  fill?: string;
  maxWidth?: number;
  align?: 'start' | 'center' | 'end';
  justify?: 'start' | 'center' | 'end' | 'space-between';
  children: CompositionChild[];
}

export type CompositionChild =
  | InstanceNode
  | RawTextNode
  | SpacerNode
  | GroupNode
  | GridNode
  | FrameNode;

export interface InstanceNode {
  type: 'instance';
  component: string;
  properties?: Record<string, string | boolean | number>;
  /** Set first text layer (for simple components like Button). */
  label?: string;
  /** Set multiple text layers by Figma layer name. Keys: layer names (e.g. "Headline", "Body"). Values: content. */
  textOverrides?: Record<string, string>;
}

export interface RawTextNode {
  type: 'raw_text';
  content: string;
  fontSize?: number;
  fontWeight?: 'regular' | 'medium' | 'semibold' | 'bold';
  color?: string;
  align?: 'left' | 'center' | 'right';
  maxWidth?: number;
}

export interface SpacerNode {
  type: 'spacer';
  height?: number;
}

export interface GroupNode {
  type: 'group';
  name?: string;
  layout: 'horizontal' | 'vertical';
  gap?: number;
  align?: 'start' | 'center' | 'end' | 'stretch';
  justify?: 'start' | 'center' | 'end' | 'space-between';
  children: CompositionChild[];
}

export interface GridNode {
  type: 'grid';
  columns: number;
  gap?: number;
  minColumnWidth?: number;
  children: CompositionChild[];
}

export interface FrameNode {
  type: 'frame';
  name?: string;
  width?: number;
  height?: number;
  fill?: string;
  cornerRadius?: number;
  children?: CompositionChild[];
}

export async function composeDesign(
  baseUrl: string,
  request: ComposeRequest
): Promise<ComposeResponse> {
  const url = `${baseUrl.replace(/\/$/, '')}/api/v1/compose`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });

  if (!res.ok) {
    const text = await res.text();
    let msg = res.statusText;
    try {
      const json = JSON.parse(text) as { error?: string; message?: string };
      msg = json.error ?? json.message ?? msg;
    } catch {
      if (text) msg = text.slice(0, 200);
    }
    throw new Error(msg);
  }

  const data = (await res.json()) as ComposeResponse;
  if (!data.composition || !data.resolvedKeys) {
    throw new Error('Invalid compose response: missing composition or resolvedKeys');
  }
  return { ...data, resolvedTypes: data.resolvedTypes ?? {} };
}

export interface CrawlRequest {
  projectId: string;
  fileKey: string;
  /** Include thumbnails (default true). Required for vision enrichment. */
  includeThumbnails?: boolean;
  /** Run vision analysis on thumbnails to detect text slots (default true when thumbnails enabled). */
  enrichWithVision?: boolean;
}

export interface CrawlResponse {
  projectId: string;
  componentCount: number;
  componentSetCount: number;
  errors: Array<{ stage: string; componentName?: string; message: string }>;
  durationMs: number;
  /** Text layers per component (document extract + vision). For debugging. */
  textLayersByComponent?: Array<{
    name: string;
    textLayers: Array<{ name: string; inferredRole?: string }>;
  }>;
}

export async function crawlLibrary(
  baseUrl: string,
  request: CrawlRequest
): Promise<CrawlResponse> {
  const url = `${baseUrl.replace(/\/$/, '')}/api/v1/crawl`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });

  if (!res.ok) {
    const text = await res.text();
    let msg = res.statusText;
    try {
      const json = JSON.parse(text) as { error?: string; message?: string };
      msg = json.error ?? json.message ?? msg;
    } catch {
      if (text) msg = text.slice(0, 200);
    }
    throw new Error(msg);
  }

  return (await res.json()) as CrawlResponse;
}

export async function rateComposition(
  baseUrl: string,
  compositionId: string,
  rating: 'up' | 'down'
): Promise<void> {
  const url = `${baseUrl.replace(/\/$/, '')}/api/v1/rate-composition`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ compositionId, rating }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || res.statusText);
  }
}

export async function validateLayout(
  baseUrl: string,
  screenshotBase64: string
): Promise<{ feedback: string }> {
  const url = `${baseUrl.replace(/\/$/, '')}/api/v1/validate-layout`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ screenshot: screenshotBase64 }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || res.statusText);
  }
  return (await res.json()) as { feedback: string };
}

/** Single component in add-components request; plugin can send full variant/property data for sets. */
export interface AddComponentItem {
  key: string;
  name: string;
  nodeId?: string;
  description?: string;
  componentType: 'component' | 'component_set';
  bounds?: { x: number; y: number; width: number; height: number };
  properties?: Record<string, { type: string; name: string; fullName: string; defaultValue?: string | boolean; options?: string[]; preferredValues?: Array<{ type: string; key: string }> }>;
  variants?: Array<{ name: string; key: string; properties: Record<string, string> }>;
  variantCount?: number;
  textLayers?: Array<{ name: string }>;
}

export interface AddComponentsRequest {
  projectId: string;
  fileKey?: string;
  components: AddComponentItem[];
  categories?: {
    designSystem?: string;
    aestheticStyle?: string;
    usageHint?: string;
    commonContexts?: string[];
  };
}

export interface AddComponentsResponse {
  addedCount: number;
  updatedCount: number;
  durationMs: number;
}

export async function addComponentsToRAG(
  baseUrl: string,
  request: AddComponentsRequest
): Promise<AddComponentsResponse> {
  const url = `${baseUrl.replace(/\/$/, '')}/api/v1/add-components`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });

  if (!res.ok) {
    const text = await res.text();
    let msg = res.statusText;
    try {
      const json = JSON.parse(text) as { error?: string; message?: string };
      msg = json.error ?? json.message ?? msg;
    } catch {
      if (text) msg = text.slice(0, 200);
    }
    throw new Error(msg);
  }

  return (await res.json()) as AddComponentsResponse;
}

/**
 * Reset CREATION database (truncate all tables). Temporary dev helper – no auth.
 */
export async function resetCreationDb(baseUrl: string): Promise<{ ok: boolean; message?: string }> {
  const url = `${baseUrl.replace(/\/$/, '')}/api/v1/admin/reset-db`;
  const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' } });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || res.statusText);
  }
  return (await res.json()) as { ok: boolean; message?: string };
}

/**
 * Returns a mock composition for development when backend is unavailable.
 */
export function getMockComposition(prompt: string): ComposeResponse {
  return {
    compositionId: `mock-${Date.now()}`,
    composition: {
      page: 'Mock Page',
      width: 1440,
      sections: [
        {
          name: 'Hero',
          layout: 'vertical',
          padding: [80, 24],
          gap: 24,
          align: 'center',
          children: [
            {
              type: 'raw_text',
              content: prompt || 'Design preview',
              fontSize: 36,
              fontWeight: 'bold',
              align: 'center',
            },
            {
              type: 'spacer',
              height: 48,
            },
            {
              type: 'raw_text',
              content: 'Backend not configured. Add RAG API URL in settings to compose from library.',
              fontSize: 16,
              align: 'center',
              maxWidth: 480,
            },
          ],
        },
      ],
    },
    resolvedKeys: {},
    warnings: ['Mock composition: RAG backend not available'],
  };
}

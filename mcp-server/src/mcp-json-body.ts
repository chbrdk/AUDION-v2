/**
 * Normalize MCP tool args into JSON bodies for AUDION APIs (audion-v3 Next + legacy FastAPI).
 *
 * - Strips injected Access Model B meta (`actorUserId`) — never send it in the HTTP body.
 * - Maps `project_id` ↔ `projectId` (assistant/MCP snake_case vs contracts camelCase).
 * - Omits path-param keys that belong in the URL, not the body.
 */

const META_KEYS = new Set(['actorUserId']);

function asRecord(args: unknown): Record<string, unknown> {
  if (!args || typeof args !== 'object' || Array.isArray(args)) return {};
  return { ...(args as Record<string, unknown>) };
}

function trimStr(v: unknown): string {
  return typeof v === 'string' ? v.trim() : '';
}

/** Resolve Audion project id from either casing. */
export function resolveProjectId(args: unknown): string {
  const a = asRecord(args);
  return trimStr(a.projectId) || trimStr(a.project_id) || '';
}

export type JsonBodyOptions = {
  /** Keys to drop (path params / MCP-only). Always drops actorUserId. */
  omit?: string[];
  /**
   * How to emit project binding on the body.
   * - `both` (default): set projectId + project_id when either was provided (max compatibility)
   * - `projectId`: audion-v3 contracts only
   * - `project_id`: FastAPI-era only
   * - `none`: leave as-is after omit (no remap)
   */
  projectIdMode?: 'both' | 'projectId' | 'project_id' | 'none';
  /** Map FastAPI `segment` → contracts `role` when role missing. */
  mapSegmentToRole?: boolean;
};

/**
 * Build a safe JSON body for POST/PATCH/PUT from MCP tool arguments.
 */
export function jsonBodyFromToolArgs(
  args: unknown,
  options: JsonBodyOptions = {}
): Record<string, unknown> {
  const {
    omit = [],
    projectIdMode = 'both',
    mapSegmentToRole = false,
  } = options;
  const body = asRecord(args);

  for (const key of META_KEYS) delete body[key];
  for (const key of omit) delete body[key];

  if (projectIdMode !== 'none') {
    const projectId = resolveProjectId(body);
    if (projectId) {
      if (projectIdMode === 'projectId' || projectIdMode === 'both') {
        body.projectId = projectId;
      }
      if (projectIdMode === 'project_id' || projectIdMode === 'both') {
        body.project_id = projectId;
      }
      if (projectIdMode === 'projectId') delete body.project_id;
      if (projectIdMode === 'project_id') delete body.projectId;
    }
  }

  if (mapSegmentToRole) {
    const role = trimStr(body.role);
    const segment = trimStr(body.segment);
    if (!role && segment) body.role = segment;
  }

  return body;
}

export function jsonBodyString(args: unknown, options?: JsonBodyOptions): string {
  return JSON.stringify(jsonBodyFromToolArgs(args, options));
}

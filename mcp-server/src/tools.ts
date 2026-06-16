/**
 * AUDION MCP tools: proxy to AUDION FastAPI API with Bearer token.
 */
import { z } from 'zod';
import { audionFetch, isAudionError } from './audion-client.js';
import { registerUxJourneyTools } from './tools-ux-journey.js';
import { registerChatTools } from './tools-chat.js';

function toTextContent(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  return JSON.stringify(value, null, 2);
}

type Server = {
  registerTool: (
    name: string,
    config: {
      title?: string;
      description?: string;
      inputSchema?: z.ZodTypeAny;
    },
    cb: (
      args: unknown
    ) => Promise<{ content: Array<{ type: 'text'; text: string }> }>
  ) => void;
};

export function registerAudionTools(server: Server): void {
  const base = (path: string, options?: RequestInit) =>
    audionFetch(path, options);

  // --- health ---
  server.registerTool(
    'audion.health',
    {
      title: 'Health check',
      description: 'Check AUDION API health.',
      inputSchema: z.object({}),
    },
    async () => {
      const res = await base('/health');
      if (isAudionError(res))
        return { content: [{ type: 'text', text: JSON.stringify(res) }] };
      return { content: [{ type: 'text', text: toTextContent(res) }] };
    }
  );

  // --- auth ---
  server.registerTool(
    'audion.auth_me',
    {
      title: 'Get current user',
      description: 'Get the authenticated user profile (GET /auth/me).',
      inputSchema: z.object({}),
    },
    async () => {
      const res = await base('/auth/me');
      if (isAudionError(res))
        return { content: [{ type: 'text', text: JSON.stringify(res) }] };
      return { content: [{ type: 'text', text: toTextContent(res) }] };
    }
  );

  server.registerTool(
    'audion.auth_me_patch',
    {
      title: 'Update current user profile',
      description: 'PATCH /auth/me with optional email, name, company, avatar_url, locale.',
      inputSchema: z.object({
        email: z.string().email().optional(),
        name: z.string().optional(),
        company: z.string().optional(),
        avatar_url: z.string().url().optional(),
        locale: z.enum(['de', 'en']).optional(),
      }),
    },
    async (args) => {
      const body = args as Record<string, unknown>;
      const res = await base('/auth/me', {
        method: 'PATCH',
        body: JSON.stringify(body),
      });
      if (isAudionError(res))
        return { content: [{ type: 'text', text: JSON.stringify(res) }] };
      return { content: [{ type: 'text', text: toTextContent(res) }] };
    }
  );

  server.registerTool(
    'audion.auth_tokens_list',
    {
      title: 'List API tokens',
      description: 'List API tokens for the current user (GET /auth/tokens).',
      inputSchema: z.object({}),
    },
    async () => {
      const res = await base('/auth/tokens');
      if (isAudionError(res))
        return { content: [{ type: 'text', text: JSON.stringify(res) }] };
      return { content: [{ type: 'text', text: toTextContent(res) }] };
    }
  );

  server.registerTool(
    'audion.auth_tokens_create',
    {
      title: 'Create API token',
      description: 'Create an API token (POST /auth/tokens). Returns token once.',
      inputSchema: z.object({
        name: z.string().optional().describe('Optional label for the token'),
      }),
    },
    async (args) => {
      const body = args as { name?: string };
      const res = await base('/auth/tokens', {
        method: 'POST',
        body: JSON.stringify(body ?? {}),
      });
      if (isAudionError(res))
        return { content: [{ type: 'text', text: JSON.stringify(res) }] };
      return { content: [{ type: 'text', text: toTextContent(res) }] };
    }
  );

  server.registerTool(
    'audion.auth_tokens_revoke',
    {
      title: 'Revoke API token',
      description: 'Revoke an API token by id (DELETE /auth/tokens/:id).',
      inputSchema: z.object({
        token_id: z.string().describe('Token ID to revoke'),
      }),
    },
    async (args) => {
      const { token_id } = args as { token_id: string };
      const res = await base(`/auth/tokens/${encodeURIComponent(token_id)}`, {
        method: 'DELETE',
      });
      if (isAudionError(res))
        return { content: [{ type: 'text', text: JSON.stringify(res) }] };
      return { content: [{ type: 'text', text: toTextContent(res ?? 'OK') }] };
    }
  );

  // --- projects ---
  server.registerTool(
    'audion.projects_list',
    {
      title: 'List projects',
      description: 'List projects for the current user (GET /projects).',
      inputSchema: z.object({}),
    },
    async () => {
      const res = await base('/projects');
      if (isAudionError(res))
        return { content: [{ type: 'text', text: JSON.stringify(res) }] };
      return { content: [{ type: 'text', text: toTextContent(res) }] };
    }
  );

  server.registerTool(
    'audion.project_get',
    {
      title: 'Get project',
      description: 'Get a project by id (GET /projects/:id).',
      inputSchema: z.object({
        project_id: z.string().describe('Project ID'),
      }),
    },
    async (args) => {
      const { project_id } = args as { project_id: string };
      const res = await base(`/projects/${encodeURIComponent(project_id)}`);
      if (isAudionError(res))
        return { content: [{ type: 'text', text: JSON.stringify(res) }] };
      return { content: [{ type: 'text', text: toTextContent(res) }] };
    }
  );

  server.registerTool(
    'audion.project_create',
    {
      title: 'Create project',
      description: 'Create a new project (POST /projects).',
      inputSchema: z.object({
        name: z.string().describe('Project name'),
      }),
    },
    async (args) => {
      const body = args as { name: string };
      const res = await base('/projects', {
        method: 'POST',
        body: JSON.stringify(body),
      });
      if (isAudionError(res))
        return { content: [{ type: 'text', text: JSON.stringify(res) }] };
      return { content: [{ type: 'text', text: toTextContent(res) }] };
    }
  );

  server.registerTool(
    'audion.project_research_start',
    {
      title: 'Start project research',
      description: 'Start async website research for a project (POST /projects/:id/research/start).',
      inputSchema: z.object({
        project_id: z.string().describe('AUDION project ID'),
        seed_url: z.string().optional().describe('Optional seed URL'),
      }),
    },
    async (args) => {
      const { project_id, seed_url } = args as { project_id: string; seed_url?: string };
      const res = await base(`/projects/${encodeURIComponent(project_id)}/research/start`, {
        method: 'POST',
        body: JSON.stringify({
          ...(seed_url ? { seed_url } : {}),
        }),
      });
      if (isAudionError(res))
        return { content: [{ type: 'text', text: JSON.stringify(res) }] };
      return { content: [{ type: 'text', text: toTextContent(res) }] };
    }
  );

  server.registerTool(
    'audion.project_update',
    {
      title: 'Update project',
      description: 'Update a project (PATCH /projects/:id).',
      inputSchema: z.object({
        project_id: z.string(),
        name: z.string().optional(),
      }),
    },
    async (args) => {
      const { project_id, ...rest } = args as { project_id: string; name?: string };
      const res = await base(`/projects/${encodeURIComponent(project_id)}`, {
        method: 'PATCH',
        body: JSON.stringify(rest),
      });
      if (isAudionError(res))
        return { content: [{ type: 'text', text: JSON.stringify(res) }] };
      return { content: [{ type: 'text', text: toTextContent(res) }] };
    }
  );

  server.registerTool(
    'audion.project_member_add',
    {
      title: 'Add project member',
      description: 'Add a member to a project (POST /projects/:id/members).',
      inputSchema: z.object({
        project_id: z.string(),
        user_id: z.string().optional(),
        email: z.string().email().optional(),
        role: z.enum(['owner', 'admin', 'member']).optional(),
      }),
    },
    async (args) => {
      const { project_id, ...body } = args as {
        project_id: string;
        user_id?: string;
        email?: string;
        role?: string;
      };
      const res = await base(
        `/projects/${encodeURIComponent(project_id)}/members`,
        { method: 'POST', body: JSON.stringify(body) }
      );
      if (isAudionError(res))
        return { content: [{ type: 'text', text: JSON.stringify(res) }] };
      return { content: [{ type: 'text', text: toTextContent(res) }] };
    }
  );

  server.registerTool(
    'audion.project_member_remove',
    {
      title: 'Remove project member',
      description: 'Remove a member from a project (DELETE /projects/:id/members/:member_id).',
      inputSchema: z.object({
        project_id: z.string(),
        member_id: z.string(),
      }),
    },
    async (args) => {
      const { project_id, member_id } = args as {
        project_id: string;
        member_id: string;
      };
      const res = await base(
        `/projects/${encodeURIComponent(project_id)}/members/${encodeURIComponent(member_id)}`,
        { method: 'DELETE' }
      );
      if (isAudionError(res))
        return { content: [{ type: 'text', text: JSON.stringify(res) }] };
      return { content: [{ type: 'text', text: toTextContent(res ?? 'OK') }] };
    }
  );

  server.registerTool(
    'audion.project_suggest_target_groups',
    {
      title: 'Suggest target groups for project',
      description:
        'AI-suggest target groups from project company context, optional research and CHECKION site topics (POST /projects/:id/suggest-target-groups).',
      inputSchema: z.object({
        project_id: z.string(),
        max_suggestions: z.number().int().min(1).max(10).optional(),
        bilingual: z.boolean().optional(),
        output_locale: z.enum(['de', 'en']).optional(),
        include_project_research: z.boolean().optional(),
        include_checkion_topics: z.boolean().optional(),
        force_refresh: z.boolean().optional(),
      }),
    },
    async (args) => {
      const {
        project_id,
        force_refresh,
        max_suggestions,
        bilingual,
        output_locale,
        include_project_research,
        include_checkion_topics,
      } = args as {
        project_id: string;
        force_refresh?: boolean;
        max_suggestions?: number;
        bilingual?: boolean;
        output_locale?: 'de' | 'en';
        include_project_research?: boolean;
        include_checkion_topics?: boolean;
      };
      const q = force_refresh ? '?force_refresh=true' : '';
      const body: Record<string, unknown> = {};
      if (max_suggestions != null) body.max_suggestions = max_suggestions;
      if (bilingual != null) body.bilingual = bilingual;
      if (output_locale) body.output_locale = output_locale;
      if (include_project_research != null) body.include_project_research = include_project_research;
      if (include_checkion_topics != null) body.include_checkion_topics = include_checkion_topics;
      const res = await base(
        `/projects/${encodeURIComponent(project_id)}/suggest-target-groups${q}`,
        {
          method: 'POST',
          body: JSON.stringify(Object.keys(body).length ? body : {}),
        }
      );
      if (isAudionError(res))
        return { content: [{ type: 'text', text: JSON.stringify(res) }] };
      return { content: [{ type: 'text', text: toTextContent(res) }] };
    }
  );

  server.registerTool(
    'audion.project_research_latest',
    {
      title: 'Latest project research',
      description: 'GET /projects/:id/research/latest – latest AI website research summary.',
      inputSchema: z.object({ project_id: z.string() }),
    },
    async (args) => {
      const { project_id } = args as { project_id: string };
      const res = await base(`/projects/${encodeURIComponent(project_id)}/research/latest`);
      if (isAudionError(res))
        return { content: [{ type: 'text', text: JSON.stringify(res) }] };
      return { content: [{ type: 'text', text: toTextContent(res) }] };
    }
  );

  server.registerTool(
    'audion.project_research_status',
    {
      title: 'Project research run status',
      description: 'GET /projects/:id/research/status?run_id=…',
      inputSchema: z.object({
        project_id: z.string(),
        run_id: z.string(),
      }),
    },
    async (args) => {
      const { project_id, run_id } = args as { project_id: string; run_id: string };
      const res = await base(
        `/projects/${encodeURIComponent(project_id)}/research/status?run_id=${encodeURIComponent(run_id)}`
      );
      if (isAudionError(res))
        return { content: [{ type: 'text', text: JSON.stringify(res) }] };
      return { content: [{ type: 'text', text: toTextContent(res) }] };
    }
  );

  server.registerTool(
    'audion.project_checkion_site_topics',
    {
      title: 'CHECKION site topics for project',
      description:
        'GET /projects/:id/integrations/checkion/site-topics – page topics from linked CHECKION deep scan.',
      inputSchema: z.object({
        project_id: z.string(),
        seed_url: z.string().optional(),
        max_pages: z.number().int().min(1).max(2000).optional(),
      }),
    },
    async (args) => {
      const { project_id, seed_url, max_pages } = args as {
        project_id: string;
        seed_url?: string;
        max_pages?: number;
      };
      const params = new URLSearchParams();
      if (seed_url) params.set('seed_url', seed_url);
      if (max_pages != null) params.set('max_pages', String(max_pages));
      const q = params.toString() ? `?${params}` : '';
      const res = await base(
        `/projects/${encodeURIComponent(project_id)}/integrations/checkion/site-topics${q}`
      );
      if (isAudionError(res))
        return { content: [{ type: 'text', text: JSON.stringify(res) }] };
      return { content: [{ type: 'text', text: toTextContent(res) }] };
    }
  );

  server.registerTool(
    'audion.project_bootstrap',
    {
      title: 'Bootstrap project (easy setup)',
      description:
        'POST /projects/bootstrap – create project + default target group + persona from website URL.',
      inputSchema: z.object({
        name: z.string(),
        website_url: z.string(),
        company_context: z.string().optional(),
        description: z.string().optional(),
      }),
    },
    async (args) => {
      const body = args as Record<string, unknown>;
      const res = await base('/projects/bootstrap', {
        method: 'POST',
        body: JSON.stringify(body),
      });
      if (isAudionError(res))
        return { content: [{ type: 'text', text: JSON.stringify(res) }] };
      return { content: [{ type: 'text', text: toTextContent(res) }] };
    }
  );

  // --- personas ---
  server.registerTool(
    'audion.personas_list',
    {
      title: 'List personas',
      description: 'List personas with optional project_id filter (GET /personas).',
      inputSchema: z.object({
        project_id: z.string().optional(),
      }),
    },
    async (args) => {
      const { project_id } = (args ?? {}) as { project_id?: string };
      const q = project_id
        ? `?project_id=${encodeURIComponent(project_id)}`
        : '';
      const res = await base(`/personas${q}`);
      if (isAudionError(res))
        return { content: [{ type: 'text', text: JSON.stringify(res) }] };
      return { content: [{ type: 'text', text: toTextContent(res) }] };
    }
  );

  server.registerTool(
    'audion.persona_get',
    {
      title: 'Get persona',
      description: 'Get a persona by id (GET /personas/:id).',
      inputSchema: z.object({ persona_id: z.string() }),
    },
    async (args) => {
      const { persona_id } = args as { persona_id: string };
      const res = await base(`/personas/${encodeURIComponent(persona_id)}`);
      if (isAudionError(res))
        return { content: [{ type: 'text', text: JSON.stringify(res) }] };
      return { content: [{ type: 'text', text: toTextContent(res) }] };
    }
  );

  server.registerTool(
    'audion.persona_create',
    {
      title: 'Create persona',
      description: 'Create a persona (POST /personas).',
      inputSchema: z.object({
        project_id: z.string(),
        name: z.string(),
        segment: z.string(),
        headline: z.string(),
        profile: z.record(z.unknown()),
        confidence: z.number(),
        version: z.string(),
        target_group_id: z.string().optional(),
      }),
    },
    async (args) => {
      const body = args as Record<string, unknown>;
      const res = await base('/personas', {
        method: 'POST',
        body: JSON.stringify(body),
      });
      if (isAudionError(res))
        return { content: [{ type: 'text', text: JSON.stringify(res) }] };
      return { content: [{ type: 'text', text: toTextContent(res) }] };
    }
  );

  server.registerTool(
    'audion.persona_patch',
    {
      title: 'Update persona',
      description: 'Update a persona (PATCH /personas/:id).',
      inputSchema: z.object({
        persona_id: z.string(),
        name: z.string().optional(),
        segment: z.string().optional(),
      }),
    },
    async (args) => {
      const { persona_id, ...rest } = args as {
        persona_id: string;
        name?: string;
        segment?: string;
      };
      const res = await base(`/personas/${encodeURIComponent(persona_id)}`, {
        method: 'PATCH',
        body: JSON.stringify(rest),
      });
      if (isAudionError(res))
        return { content: [{ type: 'text', text: JSON.stringify(res) }] };
      return { content: [{ type: 'text', text: toTextContent(res) }] };
    }
  );

  server.registerTool(
    'audion.persona_delete',
    {
      title: 'Delete persona',
      description: 'Delete a persona (DELETE /personas/:id).',
      inputSchema: z.object({ persona_id: z.string() }),
    },
    async (args) => {
      const { persona_id } = args as { persona_id: string };
      const res = await base(`/personas/${encodeURIComponent(persona_id)}`, {
        method: 'DELETE',
      });
      if (isAudionError(res))
        return { content: [{ type: 'text', text: JSON.stringify(res) }] };
      return { content: [{ type: 'text', text: toTextContent(res ?? 'OK') }] };
    }
  );

  server.registerTool(
    'audion.personas_generate',
    {
      title: 'Generate persona',
      description: 'Generate a persona (POST /personas/generate).',
      inputSchema: z.object({
        segment: z.string(),
        project_id: z.string(),
        persona_id: z.string().optional(),
      }),
    },
    async (args) => {
      const body = args as Record<string, unknown>;
      const res = await base('/personas/generate', {
        method: 'POST',
        body: JSON.stringify(body),
      });
      if (isAudionError(res))
        return { content: [{ type: 'text', text: JSON.stringify(res) }] };
      return { content: [{ type: 'text', text: toTextContent(res) }] };
    }
  );

  server.registerTool(
    'audion.persona_ai_pain_points',
    {
      title: 'Persona AI pain points',
      description: 'POST /personas/:id/ai/pain-points',
      inputSchema: z.object({
        persona_id: z.string(),
        body: z.record(z.unknown()).optional(),
      }),
    },
    async (args) => {
      const { persona_id, body: b } = args as {
        persona_id: string;
        body?: Record<string, unknown>;
      };
      const res = await base(
        `/personas/${encodeURIComponent(persona_id)}/ai/pain-points`,
        { method: 'POST', body: JSON.stringify(b ?? {}) }
      );
      if (isAudionError(res))
        return { content: [{ type: 'text', text: JSON.stringify(res) }] };
      return { content: [{ type: 'text', text: toTextContent(res) }] };
    }
  );

  server.registerTool(
    'audion.persona_ai_interests',
    {
      title: 'Persona AI interests',
      description: 'POST /personas/:id/ai/interests',
      inputSchema: z.object({
        persona_id: z.string(),
        body: z.record(z.unknown()).optional(),
      }),
    },
    async (args) => {
      const { persona_id, body: b } = args as {
        persona_id: string;
        body?: Record<string, unknown>;
      };
      const res = await base(
        `/personas/${encodeURIComponent(persona_id)}/ai/interests`,
        { method: 'POST', body: JSON.stringify(b ?? {}) }
      );
      if (isAudionError(res))
        return { content: [{ type: 'text', text: JSON.stringify(res) }] };
      return { content: [{ type: 'text', text: toTextContent(res) }] };
    }
  );

  server.registerTool(
    'audion.persona_ai_values',
    {
      title: 'Persona AI values',
      description: 'POST /personas/:id/ai/values',
      inputSchema: z.object({
        persona_id: z.string(),
        body: z.record(z.unknown()).optional(),
      }),
    },
    async (args) => {
      const { persona_id, body: b } = args as {
        persona_id: string;
        body?: Record<string, unknown>;
      };
      const res = await base(
        `/personas/${encodeURIComponent(persona_id)}/ai/values`,
        { method: 'POST', body: JSON.stringify(b ?? {}) }
      );
      if (isAudionError(res))
        return { content: [{ type: 'text', text: JSON.stringify(res) }] };
      return { content: [{ type: 'text', text: toTextContent(res) }] };
    }
  );

  server.registerTool(
    'audion.persona_ai_goals',
    {
      title: 'Persona AI goals',
      description: 'POST /personas/:id/ai/goals',
      inputSchema: z.object({
        persona_id: z.string(),
        body: z.record(z.unknown()).optional(),
      }),
    },
    async (args) => {
      const { persona_id, body: b } = args as {
        persona_id: string;
        body?: Record<string, unknown>;
      };
      const res = await base(
        `/personas/${encodeURIComponent(persona_id)}/ai/goals`,
        { method: 'POST', body: JSON.stringify(b ?? {}) }
      );
      if (isAudionError(res))
        return { content: [{ type: 'text', text: JSON.stringify(res) }] };
      return { content: [{ type: 'text', text: toTextContent(res) }] };
    }
  );

  // --- target groups ---
  server.registerTool(
    'audion.target_groups_list',
    {
      title: 'List target groups',
      description: 'List target groups (GET /target-groups). Optional project_id.',
      inputSchema: z.object({ project_id: z.string().optional() }),
    },
    async (args) => {
      const { project_id } = (args ?? {}) as { project_id?: string };
      const q = project_id
        ? `?project_id=${encodeURIComponent(project_id)}`
        : '';
      const res = await base(`/target-groups${q}`);
      if (isAudionError(res))
        return { content: [{ type: 'text', text: JSON.stringify(res) }] };
      return { content: [{ type: 'text', text: toTextContent(res) }] };
    }
  );

  server.registerTool(
    'audion.target_group_get',
    {
      title: 'Get target group',
      description: 'Get a target group by id (GET /target-groups/:id).',
      inputSchema: z.object({ target_group_id: z.string() }),
    },
    async (args) => {
      const { target_group_id } = args as { target_group_id: string };
      const res = await base(
        `/target-groups/${encodeURIComponent(target_group_id)}`
      );
      if (isAudionError(res))
        return { content: [{ type: 'text', text: JSON.stringify(res) }] };
      return { content: [{ type: 'text', text: toTextContent(res) }] };
    }
  );

  server.registerTool(
    'audion.target_group_create',
    {
      title: 'Create target group',
      description: 'Create a target group (POST /target-groups).',
      inputSchema: z.object({
        project_id: z.string(),
        name: z.string(),
        description: z.string().optional(),
        segment: z.string(),
      }),
    },
    async (args) => {
      const body = args as Record<string, unknown>;
      const res = await base('/target-groups', {
        method: 'POST',
        body: JSON.stringify(body),
      });
      if (isAudionError(res))
        return { content: [{ type: 'text', text: JSON.stringify(res) }] };
      return { content: [{ type: 'text', text: toTextContent(res) }] };
    }
  );

  server.registerTool(
    'audion.target_group_patch',
    {
      title: 'Update target group',
      description: 'Update a target group (PATCH /target-groups/:id).',
      inputSchema: z.object({
        target_group_id: z.string(),
        name: z.string().optional(),
        description: z.string().optional(),
        segment: z.string().optional(),
      }),
    },
    async (args) => {
      const { target_group_id, ...rest } = args as {
        target_group_id: string;
        name?: string;
        description?: string;
        segment?: string;
      };
      const res = await base(
        `/target-groups/${encodeURIComponent(target_group_id)}`,
        { method: 'PATCH', body: JSON.stringify(rest) }
      );
      if (isAudionError(res))
        return { content: [{ type: 'text', text: JSON.stringify(res) }] };
      return { content: [{ type: 'text', text: toTextContent(res) }] };
    }
  );

  server.registerTool(
    'audion.target_group_delete',
    {
      title: 'Delete target group',
      description: 'Delete a target group (DELETE /target-groups/:id).',
      inputSchema: z.object({ target_group_id: z.string() }),
    },
    async (args) => {
      const { target_group_id } = args as { target_group_id: string };
      const res = await base(
        `/target-groups/${encodeURIComponent(target_group_id)}`,
        { method: 'DELETE' }
      );
      if (isAudionError(res))
        return { content: [{ type: 'text', text: JSON.stringify(res) }] };
      return { content: [{ type: 'text', text: toTextContent(res ?? 'OK') }] };
    }
  );

  server.registerTool(
    'audion.target_group_knowledge_chunks',
    {
      title: 'Target group knowledge chunks',
      description: 'GET /target-groups/:id/knowledge/chunks',
      inputSchema: z.object({ target_group_id: z.string() }),
    },
    async (args) => {
      const { target_group_id } = args as { target_group_id: string };
      const res = await base(
        `/target-groups/${encodeURIComponent(target_group_id)}/knowledge/chunks`
      );
      if (isAudionError(res))
        return { content: [{ type: 'text', text: JSON.stringify(res) }] };
      return { content: [{ type: 'text', text: toTextContent(res) }] };
    }
  );

  server.registerTool(
    'audion.target_group_knowledge_clusters',
    {
      title: 'Target group knowledge clusters',
      description: 'GET /target-groups/:id/knowledge/clusters',
      inputSchema: z.object({ target_group_id: z.string() }),
    },
    async (args) => {
      const { target_group_id } = args as { target_group_id: string };
      const res = await base(
        `/target-groups/${encodeURIComponent(target_group_id)}/knowledge/clusters`
      );
      if (isAudionError(res))
        return { content: [{ type: 'text', text: JSON.stringify(res) }] };
      return { content: [{ type: 'text', text: toTextContent(res) }] };
    }
  );

  server.registerTool(
    'audion.target_group_knowledge_list',
    {
      title: 'Target group knowledge list',
      description: 'GET /target-groups/:id/knowledge',
      inputSchema: z.object({ target_group_id: z.string() }),
    },
    async (args) => {
      const { target_group_id } = args as { target_group_id: string };
      const res = await base(
        `/target-groups/${encodeURIComponent(target_group_id)}/knowledge`
      );
      if (isAudionError(res))
        return { content: [{ type: 'text', text: JSON.stringify(res) }] };
      return { content: [{ type: 'text', text: toTextContent(res) }] };
    }
  );

  server.registerTool(
    'audion.target_group_knowledge_create',
    {
      title: 'Create target group knowledge entry',
      description: 'POST /target-groups/:id/knowledge',
      inputSchema: z.object({
        target_group_id: z.string(),
        title: z.string(),
        content: z.string(),
        metadata: z.record(z.unknown()).optional(),
      }),
    },
    async (args) => {
      const { target_group_id, ...body } = args as {
        target_group_id: string;
        title: string;
        content: string;
        metadata?: Record<string, unknown>;
      };
      const res = await base(
        `/target-groups/${encodeURIComponent(target_group_id)}/knowledge`,
        { method: 'POST', body: JSON.stringify(body) }
      );
      if (isAudionError(res))
        return { content: [{ type: 'text', text: JSON.stringify(res) }] };
      return { content: [{ type: 'text', text: toTextContent(res) }] };
    }
  );

  server.registerTool(
    'audion.target_group_documents_list',
    {
      title: 'Target group documents list',
      description: 'GET /target-groups/:id/documents',
      inputSchema: z.object({ target_group_id: z.string() }),
    },
    async (args) => {
      const { target_group_id } = args as { target_group_id: string };
      const res = await base(
        `/target-groups/${encodeURIComponent(target_group_id)}/documents`
      );
      if (isAudionError(res))
        return { content: [{ type: 'text', text: JSON.stringify(res) }] };
      return { content: [{ type: 'text', text: toTextContent(res) }] };
    }
  );

  server.registerTool(
    'audion.target_group_personas_list',
    {
      title: 'Target group personas list',
      description: 'GET /target-groups/:id/personas',
      inputSchema: z.object({ target_group_id: z.string() }),
    },
    async (args) => {
      const { target_group_id } = args as { target_group_id: string };
      const res = await base(
        `/target-groups/${encodeURIComponent(target_group_id)}/personas`
      );
      if (isAudionError(res))
        return { content: [{ type: 'text', text: JSON.stringify(res) }] };
      return { content: [{ type: 'text', text: toTextContent(res) }] };
    }
  );

  server.registerTool(
    'audion.target_group_suggest_personas',
    {
      title: 'Suggest personas for target group',
      description: 'POST /target-groups/:id/suggest-personas – AI persona suggestions.',
      inputSchema: z.object({
        target_group_id: z.string(),
        max_suggestions: z.number().int().min(1).max(10).optional(),
        output_locale: z.enum(['de', 'en']).optional(),
        include_project_research: z.boolean().optional(),
        include_checkion_topics: z.boolean().optional(),
      }),
    },
    async (args) => {
      const {
        target_group_id,
        max_suggestions,
        output_locale,
        include_project_research,
        include_checkion_topics,
      } = args as {
        target_group_id: string;
        max_suggestions?: number;
        output_locale?: 'de' | 'en';
        include_project_research?: boolean;
        include_checkion_topics?: boolean;
      };
      const body: Record<string, unknown> = {};
      if (max_suggestions != null) body.max_suggestions = max_suggestions;
      if (output_locale) body.output_locale = output_locale;
      if (include_project_research != null) body.include_project_research = include_project_research;
      if (include_checkion_topics != null) body.include_checkion_topics = include_checkion_topics;
      const res = await base(
        `/target-groups/${encodeURIComponent(target_group_id)}/suggest-personas`,
        {
          method: 'POST',
          body: JSON.stringify(Object.keys(body).length ? body : {}),
        }
      );
      if (isAudionError(res))
        return { content: [{ type: 'text', text: JSON.stringify(res) }] };
      return { content: [{ type: 'text', text: toTextContent(res) }] };
    }
  );

  server.registerTool(
    'audion.target_group_personas_generate',
    {
      title: 'Generate persona for target group',
      description: 'POST /target-groups/:id/personas/generate – AI persona from target group knowledge.',
      inputSchema: z.object({
        target_group_id: z.string(),
        segment: z.string(),
        description: z.string().optional(),
        filter_mode: z.enum(['auto', 'documents', 'chunks_manual']).optional(),
        document_ids: z.array(z.string()).optional(),
        chunk_ids: z.array(z.string()).optional(),
        limit_chunks: z.number().int().optional(),
        output_locale: z.enum(['de', 'en']).optional(),
      }),
    },
    async (args) => {
      const { target_group_id, ...body } = args as {
        target_group_id: string;
        segment: string;
        description?: string;
        filter_mode?: string;
        document_ids?: string[];
        chunk_ids?: string[];
        limit_chunks?: number;
        output_locale?: 'de' | 'en';
      };
      const res = await base(
        `/target-groups/${encodeURIComponent(target_group_id)}/personas/generate`,
        {
          method: 'POST',
          body: JSON.stringify(body),
        }
      );
      if (isAudionError(res))
        return { content: [{ type: 'text', text: JSON.stringify(res) }] };
      return { content: [{ type: 'text', text: toTextContent(res) }] };
    }
  );

  // --- journeys ---
  server.registerTool(
    'audion.journeys_generate',
    {
      title: 'Generate journey',
      description: 'POST /journeys/generate',
      inputSchema: z.object({
        target_group_id: z.string(),
        body: z.record(z.unknown()).optional(),
      }),
    },
    async (args) => {
      const { target_group_id, body: b } = args as {
        target_group_id: string;
        body?: Record<string, unknown>;
      };
      const payload = { target_group_id, ...(b ?? {}) };
      const res = await base('/journeys/generate', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      if (isAudionError(res))
        return { content: [{ type: 'text', text: JSON.stringify(res) }] };
      return { content: [{ type: 'text', text: toTextContent(res) }] };
    }
  );

  server.registerTool(
    'audion.journeys_list',
    {
      title: 'List journeys',
      description: 'GET /journeys',
      inputSchema: z.object({
        project_id: z.string().optional(),
        target_group_id: z.string().optional(),
      }),
    },
    async (args) => {
      const params = (args ?? {}) as {
        project_id?: string;
        target_group_id?: string;
      };
      const q = new URLSearchParams();
      if (params.project_id) q.set('project_id', params.project_id);
      if (params.target_group_id)
        q.set('target_group_id', params.target_group_id);
      const query = q.toString() ? `?${q.toString()}` : '';
      const res = await base(`/journeys${query}`);
      if (isAudionError(res))
        return { content: [{ type: 'text', text: JSON.stringify(res) }] };
      return { content: [{ type: 'text', text: toTextContent(res) }] };
    }
  );

  server.registerTool(
    'audion.journey_get',
    {
      title: 'Get journey',
      description: 'GET /journeys/:id',
      inputSchema: z.object({ journey_id: z.string() }),
    },
    async (args) => {
      const { journey_id } = args as { journey_id: string };
      const res = await base(
        `/journeys/${encodeURIComponent(journey_id)}`
      );
      if (isAudionError(res))
        return { content: [{ type: 'text', text: JSON.stringify(res) }] };
      return { content: [{ type: 'text', text: toTextContent(res) }] };
    }
  );

  server.registerTool(
    'audion.journey_update',
    {
      title: 'Update journey',
      description: 'PUT /journeys/:id',
      inputSchema: z.object({
        journey_id: z.string(),
        body: z.record(z.unknown()),
      }),
    },
    async (args) => {
      const { journey_id, body } = args as {
        journey_id: string;
        body: Record<string, unknown>;
      };
      const res = await base(
        `/journeys/${encodeURIComponent(journey_id)}`,
        { method: 'PUT', body: JSON.stringify(body) }
      );
      if (isAudionError(res))
        return { content: [{ type: 'text', text: JSON.stringify(res) }] };
      return { content: [{ type: 'text', text: toTextContent(res) }] };
    }
  );

  server.registerTool(
    'audion.journey_delete',
    {
      title: 'Delete journey',
      description: 'DELETE /journeys/:id',
      inputSchema: z.object({ journey_id: z.string() }),
    },
    async (args) => {
      const { journey_id } = args as { journey_id: string };
      const res = await base(
        `/journeys/${encodeURIComponent(journey_id)}`,
        { method: 'DELETE' }
      );
      if (isAudionError(res))
        return { content: [{ type: 'text', text: JSON.stringify(res) }] };
      return { content: [{ type: 'text', text: toTextContent(res ?? 'OK') }] };
    }
  );

  server.registerTool(
    'audion.journey_phases_create',
    {
      title: 'Create journey phase',
      description: 'POST /journeys/:id/phases',
      inputSchema: z.object({
        journey_id: z.string(),
        body: z.record(z.unknown()),
      }),
    },
    async (args) => {
      const { journey_id, body } = args as {
        journey_id: string;
        body: Record<string, unknown>;
      };
      const res = await base(
        `/journeys/${encodeURIComponent(journey_id)}/phases`,
        { method: 'POST', body: JSON.stringify(body) }
      );
      if (isAudionError(res))
        return { content: [{ type: 'text', text: JSON.stringify(res) }] };
      return { content: [{ type: 'text', text: toTextContent(res) }] };
    }
  );

  server.registerTool(
    'audion.journey_validate',
    {
      title: 'Validate journey',
      description: 'POST /journeys/:id/validate',
      inputSchema: z.object({ journey_id: z.string() }),
    },
    async (args) => {
      const { journey_id } = args as { journey_id: string };
      const res = await base(
        `/journeys/${encodeURIComponent(journey_id)}/validate`,
        { method: 'POST' }
      );
      if (isAudionError(res))
        return { content: [{ type: 'text', text: JSON.stringify(res) }] };
      return { content: [{ type: 'text', text: toTextContent(res) }] };
    }
  );

  server.registerTool(
    'audion.journey_validation_report',
    {
      title: 'Get journey validation report',
      description: 'GET /journeys/:id/validation-report',
      inputSchema: z.object({ journey_id: z.string() }),
    },
    async (args) => {
      const { journey_id } = args as { journey_id: string };
      const res = await base(
        `/journeys/${encodeURIComponent(journey_id)}/validation-report`
      );
      if (isAudionError(res))
        return { content: [{ type: 'text', text: JSON.stringify(res) }] };
      return { content: [{ type: 'text', text: toTextContent(res) }] };
    }
  );

  server.registerTool(
    'audion.journey_measurements',
    {
      title: 'Get journey measurements',
      description: 'GET /journeys/:id/measurements',
      inputSchema: z.object({ journey_id: z.string() }),
    },
    async (args) => {
      const { journey_id } = args as { journey_id: string };
      const res = await base(
        `/journeys/${encodeURIComponent(journey_id)}/measurements`
      );
      if (isAudionError(res))
        return { content: [{ type: 'text', text: JSON.stringify(res) }] };
      return { content: [{ type: 'text', text: toTextContent(res) }] };
    }
  );

  server.registerTool(
    'audion.journey_insights',
    {
      title: 'Get journey insights',
      description: 'GET /journeys/:id/insights',
      inputSchema: z.object({ journey_id: z.string() }),
    },
    async (args) => {
      const { journey_id } = args as { journey_id: string };
      const res = await base(
        `/journeys/${encodeURIComponent(journey_id)}/insights`
      );
      if (isAudionError(res))
        return { content: [{ type: 'text', text: JSON.stringify(res) }] };
      return { content: [{ type: 'text', text: toTextContent(res) }] };
    }
  );

  server.registerTool(
    'audion.journey_changes_list',
    {
      title: 'List journey changes',
      description: 'GET /journeys/:id/changes',
      inputSchema: z.object({ journey_id: z.string() }),
    },
    async (args) => {
      const { journey_id } = args as { journey_id: string };
      const res = await base(
        `/journeys/${encodeURIComponent(journey_id)}/changes`
      );
      if (isAudionError(res))
        return { content: [{ type: 'text', text: JSON.stringify(res) }] };
      return { content: [{ type: 'text', text: toTextContent(res) }] };
    }
  );

  // --- ai-assist ---
  server.registerTool(
    'audion.ai_assist_templates',
    {
      title: 'List AI assist templates',
      description: 'GET /ai-assist/templates. Requires project_id query.',
      inputSchema: z.object({ project_id: z.string() }),
    },
    async (args) => {
      const { project_id } = args as { project_id: string };
      const res = await base(
        `/ai-assist/templates?project_id=${encodeURIComponent(project_id)}`
      );
      if (isAudionError(res))
        return { content: [{ type: 'text', text: JSON.stringify(res) }] };
      return { content: [{ type: 'text', text: toTextContent(res) }] };
    }
  );

  server.registerTool(
    'audion.ai_assist_assist',
    {
      title: 'AI assist',
      description: 'POST /ai-assist – execute an AI assist template.',
      inputSchema: z.object({
        template_id: z.string(),
        context: z.record(z.unknown()),
        project_id: z.string().optional(),
        provider: z.string().optional(),
        model: z.string().optional(),
        prompt_variables: z.record(z.unknown()).optional(),
        max_suggestions: z.number().int().optional(),
        metadata: z.record(z.unknown()).optional(),
      }),
    },
    async (args) => {
      const { project_id, ...body } = args as {
        project_id?: string;
        template_id: string;
        context: Record<string, unknown>;
      };
      const q = project_id ? `?project_id=${encodeURIComponent(project_id)}` : '';
      const res = await base(`/ai-assist${q}`, {
        method: 'POST',
        body: JSON.stringify(body),
      });
      if (isAudionError(res))
        return { content: [{ type: 'text', text: JSON.stringify(res) }] };
      return { content: [{ type: 'text', text: toTextContent(res) }] };
    }
  );

  server.registerTool(
    'audion.ai_assist_test',
    {
      title: 'AI assist test',
      description: 'POST /ai-assist/test',
      inputSchema: z.object({
        body: z.record(z.unknown()),
      }),
    },
    async (args) => {
      const { body } = args as { body: Record<string, unknown> };
      const res = await base('/ai-assist/test', {
        method: 'POST',
        body: JSON.stringify(body),
      });
      if (isAudionError(res))
        return { content: [{ type: 'text', text: JSON.stringify(res) }] };
      return { content: [{ type: 'text', text: toTextContent(res) }] };
    }
  );

  // --- settings ---
  server.registerTool(
    'audion.settings_ai_providers',
    {
      title: 'List AI providers',
      description: 'GET /settings/ai/providers',
      inputSchema: z.object({}),
    },
    async () => {
      const res = await base('/settings/ai/providers');
      if (isAudionError(res))
        return { content: [{ type: 'text', text: JSON.stringify(res) }] };
      return { content: [{ type: 'text', text: toTextContent(res) }] };
    }
  );

  server.registerTool(
    'audion.settings_ai_templates_list',
    {
      title: 'List AI templates',
      description: 'GET /settings/ai/templates',
      inputSchema: z.object({ project_id: z.string().optional() }),
    },
    async (args) => {
      const { project_id } = (args ?? {}) as { project_id?: string };
      const q = project_id
        ? `?project_id=${encodeURIComponent(project_id)}`
        : '';
      const res = await base(`/settings/ai/templates${q}`);
      if (isAudionError(res))
        return { content: [{ type: 'text', text: JSON.stringify(res) }] };
      return { content: [{ type: 'text', text: toTextContent(res) }] };
    }
  );

  // --- documents ---
  server.registerTool(
    'audion.documents_job_status',
    {
      title: 'Document job status',
      description: 'GET /documents/:job_id/status. Returns processing job status.',
      inputSchema: z.object({
        job_id: z.string(),
        project_id: z.string().optional(),
      }),
    },
    async (args) => {
      const { job_id, project_id } = args as {
        job_id: string;
        project_id?: string;
      };
      const q = project_id
        ? `?project_id=${encodeURIComponent(project_id)}`
        : '';
      const res = await base(
        `/documents/${encodeURIComponent(job_id)}/status${q}`
      );
      if (isAudionError(res))
        return { content: [{ type: 'text', text: JSON.stringify(res) }] };
      return { content: [{ type: 'text', text: toTextContent(res) }] };
    }
  );

  // --- queue ---
  server.registerTool(
    'audion.queue_jobs_list',
    {
      title: 'List queue jobs',
      description: 'GET /queue/jobs. Requires project_id.',
      inputSchema: z.object({
        project_id: z.string(),
        status: z.string().optional(),
        document_id: z.string().optional(),
        page: z.number().optional(),
        page_size: z.number().optional(),
      }),
    },
    async (args) => {
      const { project_id, ...rest } = args as {
        project_id: string;
        status?: string;
        document_id?: string;
        page?: number;
        page_size?: number;
      };
      const q = new URLSearchParams({ project_id });
      if (rest.status) q.set('status', rest.status);
      if (rest.document_id) q.set('document_id', rest.document_id);
      if (rest.page != null) q.set('page', String(rest.page));
      if (rest.page_size != null) q.set('page_size', String(rest.page_size));
      const res = await base(`/queue/jobs?${q.toString()}`);
      if (isAudionError(res))
        return { content: [{ type: 'text', text: JSON.stringify(res) }] };
      return { content: [{ type: 'text', text: toTextContent(res) }] };
    }
  );

  server.registerTool(
    'audion.queue_job_get',
    {
      title: 'Get queue job',
      description: 'GET /queue/jobs/:job_id. Requires project_id.',
      inputSchema: z.object({
        job_id: z.string(),
        project_id: z.string(),
      }),
    },
    async (args) => {
      const { job_id, project_id } = args as {
        job_id: string;
        project_id: string;
      };
      const res = await base(
        `/queue/jobs/${encodeURIComponent(job_id)}?project_id=${encodeURIComponent(project_id)}`
      );
      if (isAudionError(res))
        return { content: [{ type: 'text', text: JSON.stringify(res) }] };
      return { content: [{ type: 'text', text: toTextContent(res) }] };
    }
  );

  server.registerTool(
    'audion.queue_stats',
    {
      title: 'Queue stats',
      description: 'GET /queue/stats. Optional project_id.',
      inputSchema: z.object({ project_id: z.string().optional() }),
    },
    async (args) => {
      const { project_id } = (args ?? {}) as { project_id?: string };
      const q = project_id
        ? `?project_id=${encodeURIComponent(project_id)}`
        : '';
      const res = await base(`/queue/stats${q}`);
      if (isAudionError(res))
        return { content: [{ type: 'text', text: JSON.stringify(res) }] };
      return { content: [{ type: 'text', text: toTextContent(res) }] };
    }
  );

  server.registerTool(
    'audion.queue_service_status',
    {
      title: 'Queue service status',
      description: 'GET /queue/service-status',
      inputSchema: z.object({}),
    },
    async () => {
      const res = await base('/queue/service-status');
      if (isAudionError(res))
        return { content: [{ type: 'text', text: JSON.stringify(res) }] };
      return { content: [{ type: 'text', text: toTextContent(res) }] };
    }
  );

  registerUxJourneyTools(server, base);
  registerChatTools(server);
}

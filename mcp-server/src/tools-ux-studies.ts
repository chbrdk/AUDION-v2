import { z } from 'zod';
import { type AudionFetchError } from './audion-client.js';

type ToolServer = {
  registerTool: (
    name: string,
    config: {
      title?: string;
      description?: string;
      inputSchema?: z.ZodTypeAny;
    },
    cb: (args: unknown) => Promise<{ content: Array<{ type: 'text'; text: string }> }>
  ) => void;
};

type AudionBase = (
  path: string,
  options?: RequestInit
) => Promise<unknown | AudionFetchError>;

function textResult(value: unknown) {
  return {
    content: [
      {
        type: 'text' as const,
        text: typeof value === 'string' ? value : JSON.stringify(value, null, 2),
      },
    ],
  };
}

export function registerUxStudyTools(server: ToolServer, base: AudionBase): void {
  server.registerTool(
    'audion.ux_study_list',
    {
      title: 'List UX studies',
      description: 'GET /ux-studies',
      inputSchema: z.object({
        page: z.number().optional(),
        page_size: z.number().optional(),
        project_id: z.string().optional(),
      }),
    },
    async (args) => {
      const a = args as { page?: number; page_size?: number; project_id?: string };
      const q = new URLSearchParams();
      if (a.page) q.set('page', String(a.page));
      if (a.page_size) q.set('page_size', String(a.page_size));
      if (a.project_id) q.set('project_id', a.project_id);
      const res = await base(`/ux-studies?${q.toString()}`);
      return textResult(res);
    }
  );

  server.registerTool(
    'audion.ux_study_get',
    {
      title: 'Get UX study',
      description: 'GET /ux-studies/{study_id}',
      inputSchema: z.object({ study_id: z.string() }),
    },
    async (args) => {
      const { study_id } = args as { study_id: string };
      const res = await base(`/ux-studies/${encodeURIComponent(study_id)}`);
      return textResult(res);
    }
  );

  server.registerTool(
    'audion.ux_study_create',
    {
      title: 'Create UX study',
      description: 'POST /ux-studies',
      inputSchema: z.object({
        name: z.string(),
        status: z.string().optional(),
        description: z.string().optional(),
        project_id: z.string().optional(),
        source_guide: z.string().optional(),
        target_url_key: z.string().optional(),
        hypothesis_templates: z
          .array(z.object({ id: z.string(), statement: z.string() }))
          .optional(),
      }),
    },
    async (args) => {
      const res = await base('/ux-studies', {
        method: 'POST',
        body: JSON.stringify(args),
      });
      return textResult(res);
    }
  );

  server.registerTool(
    'audion.ux_wave_create',
    {
      title: 'Create UX study wave',
      description: 'POST /ux-studies/{study_id}/waves',
      inputSchema: z.object({
        study_id: z.string(),
        wave_key: z.string(),
        status: z.string().optional(),
        runs: z.array(z.record(z.unknown())).optional(),
      }),
    },
    async (args) => {
      const { study_id, ...body } = args as {
        study_id: string;
        wave_key: string;
        status?: string;
        runs?: Record<string, unknown>[];
      };
      const res = await base(`/ux-studies/${encodeURIComponent(study_id)}/waves`, {
        method: 'POST',
        body: JSON.stringify(body),
      });
      return textResult(res);
    }
  );

  server.registerTool(
    'audion.ux_wave_get',
    {
      title: 'Get UX study wave',
      description: 'GET /ux-studies/{study_id}/waves/{wave_id}',
      inputSchema: z.object({ study_id: z.string(), wave_id: z.string() }),
    },
    async (args) => {
      const { study_id, wave_id } = args as { study_id: string; wave_id: string };
      const res = await base(
        `/ux-studies/${encodeURIComponent(study_id)}/waves/${encodeURIComponent(wave_id)}`
      );
      return textResult(res);
    }
  );

  server.registerTool(
    'audion.ux_wave_evaluate',
    {
      title: 'Evaluate UX study wave',
      description: 'POST /ux-studies/{study_id}/waves/{wave_id}/evaluate',
      inputSchema: z.object({ study_id: z.string(), wave_id: z.string() }),
    },
    async (args) => {
      const { study_id, wave_id } = args as { study_id: string; wave_id: string };
      const res = await base(
        `/ux-studies/${encodeURIComponent(study_id)}/waves/${encodeURIComponent(wave_id)}/evaluate`,
        { method: 'POST' }
      );
      return textResult(res);
    }
  );

  server.registerTool(
    'audion.ux_wave_compare',
    {
      title: 'Compare UX study waves',
      description: 'GET /ux-studies/{study_id}/waves/{wave_id}/compare/{other_wave_id}',
      inputSchema: z.object({
        study_id: z.string(),
        wave_id: z.string(),
        other_wave_id: z.string(),
      }),
    },
    async (args) => {
      const { study_id, wave_id, other_wave_id } = args as {
        study_id: string;
        wave_id: string;
        other_wave_id: string;
      };
      const res = await base(
        `/ux-studies/${encodeURIComponent(study_id)}/waves/${encodeURIComponent(wave_id)}/compare/${encodeURIComponent(other_wave_id)}`
      );
      return textResult(res);
    }
  );

  server.registerTool(
    'audion.ux_wave_start',
    {
      title: 'Start UX study wave runs',
      description: 'POST /ux-studies/{study_id}/waves/{wave_id}/start — orchestrates UX Journey Agent jobs',
      inputSchema: z.object({
        study_id: z.string(),
        wave_id: z.string(),
        sequential: z.boolean().optional(),
      }),
    },
    async (args) => {
      const { study_id, wave_id, sequential } = args as {
        study_id: string;
        wave_id: string;
        sequential?: boolean;
      };
      const q = sequential === false ? '?sequential=false' : '';
      const res = await base(
        `/ux-studies/${encodeURIComponent(study_id)}/waves/${encodeURIComponent(wave_id)}/start${q}`,
        { method: 'POST' }
      );
      return textResult(res);
    }
  );

  server.registerTool(
    'audion.ux_wave_sync',
    {
      title: 'Sync UX study wave run statuses',
      description: 'POST /ux-studies/{study_id}/waves/{wave_id}/sync',
      inputSchema: z.object({ study_id: z.string(), wave_id: z.string() }),
    },
    async (args) => {
      const { study_id, wave_id } = args as { study_id: string; wave_id: string };
      const res = await base(
        `/ux-studies/${encodeURIComponent(study_id)}/waves/${encodeURIComponent(wave_id)}/sync`,
        { method: 'POST' }
      );
      return textResult(res);
    }
  );
}

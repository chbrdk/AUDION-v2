import { z } from 'zod';
import { audionFetchBinary } from './binary-fetch.js';
import { isAudionError, type AudionFetchError } from './audion-client.js';

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

export function registerUxJourneyTools(server: ToolServer, base: AudionBase): void {
  server.registerTool(
    'audion.ux_journey_run_start',
    {
      title: 'Start UX journey agent run',
      description: 'POST /ux-journey-agent/run – start browser UX journey recording.',
      inputSchema: z.object({ body: z.record(z.unknown()) }),
    },
    async (args) => {
      const { body } = args as { body: Record<string, unknown> };
      const res = await base('/ux-journey-agent/run', {
        method: 'POST',
        body: JSON.stringify(body),
      });
      if (isAudionError(res)) return textResult(res);
      return textResult(res);
    }
  );

  server.registerTool(
    'audion.ux_journey_run_get',
    {
      title: 'Get UX journey run status',
      description: 'GET /ux-journey-agent/run/{job_id}',
      inputSchema: z.object({ job_id: z.string() }),
    },
    async (args) => {
      const { job_id } = args as { job_id: string };
      const res = await base(`/ux-journey-agent/run/${encodeURIComponent(job_id)}`);
      if (isAudionError(res)) return textResult(res);
      return textResult(res);
    }
  );

  server.registerTool(
    'audion.ux_journey_run_cancel',
    {
      title: 'Cancel UX journey run',
      description: 'POST /ux-journey-agent/run/{job_id}/cancel',
      inputSchema: z.object({ job_id: z.string() }),
    },
    async (args) => {
      const { job_id } = args as { job_id: string };
      const res = await base(`/ux-journey-agent/run/${encodeURIComponent(job_id)}/cancel`, {
        method: 'POST',
      });
      if (isAudionError(res)) return textResult(res);
      return textResult(res);
    }
  );

  server.registerTool(
    'audion.ux_journey_run_video_finalize',
    {
      title: 'Finalize UX journey video',
      description: 'POST /ux-journey-agent/run/{job_id}/video/finalize (may take minutes).',
      inputSchema: z.object({ job_id: z.string(), force: z.boolean().optional() }),
    },
    async (args) => {
      const { job_id, force } = args as { job_id: string; force?: boolean };
      const q = force ? '?force=1' : '';
      const res = await base(
        `/ux-journey-agent/run/${encodeURIComponent(job_id)}/video/finalize${q}`,
        { method: 'POST' }
      );
      if (isAudionError(res)) return textResult(res);
      return textResult(res);
    }
  );

  server.registerTool(
    'audion.ux_journey_run_live_diag',
    {
      title: 'UX journey live diagnostics',
      description: 'GET /ux-journey-agent/run/{job_id}/live/diag',
      inputSchema: z.object({ job_id: z.string() }),
    },
    async (args) => {
      const { job_id } = args as { job_id: string };
      const res = await base(`/ux-journey-agent/run/${encodeURIComponent(job_id)}/live/diag`);
      if (isAudionError(res)) return textResult(res);
      return textResult(res);
    }
  );

  server.registerTool(
    'audion.ux_journey_step_screenshot',
    {
      title: 'UX journey step screenshot',
      description:
        'GET step screenshot as base64 JSON (max 512KB). For full video use run status + video URL in AUDION UI.',
      inputSchema: z.object({ job_id: z.string(), step_no: z.number().int().min(0) }),
    },
    async (args) => {
      const { job_id, step_no } = args as { job_id: string; step_no: number };
      const baseUrl = process.env.AUDION_API_URL ?? '';
      const token = process.env.AUDION_API_TOKEN ?? '';
      const res = await audionFetchBinary(
        baseUrl,
        token,
        `/ux-journey-agent/run/${encodeURIComponent(job_id)}/step/${step_no}/screenshot`
      );
      if ('error' in res && res.error) return textResult(res);
      return textResult(res);
    }
  );

  server.registerTool(
    'audion.ux_journey_live_frame',
    {
      title: 'UX journey live frame',
      description: 'GET latest live JPEG as base64 JSON (while run is active).',
      inputSchema: z.object({ job_id: z.string() }),
    },
    async (args) => {
      const { job_id } = args as { job_id: string };
      const baseUrl = process.env.AUDION_API_URL ?? '';
      const token = process.env.AUDION_API_TOKEN ?? '';
      const res = await audionFetchBinary(
        baseUrl,
        token,
        `/ux-journey-agent/run/${encodeURIComponent(job_id)}/live`
      );
      if ('error' in res && res.error) return textResult(res);
      return textResult(res);
    }
  );

  server.registerTool(
    'audion.persona_admin_ux_journey_runs_list',
    {
      title: 'List persona UX journey runs',
      description: 'GET /api/persona-admin/{persona_id}/ux-journey-runs',
      inputSchema: z.object({ persona_id: z.string(), limit: z.number().int().optional() }),
    },
    async (args) => {
      const { persona_id, limit } = args as { persona_id: string; limit?: number };
      const q = limit != null ? `?limit=${encodeURIComponent(String(limit))}` : '';
      const res = await base(
        `/api/persona-admin/${encodeURIComponent(persona_id)}/ux-journey-runs${q}`
      );
      if (isAudionError(res)) return textResult(res);
      return textResult(res);
    }
  );

  server.registerTool(
    'audion.persona_admin_ux_journey_run_upsert',
    {
      title: 'Record persona UX journey run',
      description: 'POST /api/persona-admin/{persona_id}/ux-journey-runs',
      inputSchema: z.object({
        persona_id: z.string(),
        body: z.record(z.unknown()),
      }),
    },
    async (args) => {
      const { persona_id, body } = args as { persona_id: string; body: Record<string, unknown> };
      const res = await base(
        `/api/persona-admin/${encodeURIComponent(persona_id)}/ux-journey-runs`,
        { method: 'POST', body: JSON.stringify(body) }
      );
      if (isAudionError(res)) return textResult(res);
      return textResult(res);
    }
  );

  server.registerTool(
    'audion.persona_admin_ux_journey_run_convert',
    {
      title: 'Convert UX journey run to journey',
      description: 'POST /api/persona-admin/{persona_id}/ux-journey-runs/{run_id}/convert',
      inputSchema: z.object({
        persona_id: z.string(),
        run_id: z.string(),
        body: z.record(z.unknown()).optional(),
      }),
    },
    async (args) => {
      const { persona_id, run_id, body } = args as {
        persona_id: string;
        run_id: string;
        body?: Record<string, unknown>;
      };
      const res = await base(
        `/api/persona-admin/${encodeURIComponent(persona_id)}/ux-journey-runs/${encodeURIComponent(run_id)}/convert`,
        { method: 'POST', body: JSON.stringify(body ?? {}) }
      );
      if (isAudionError(res)) return textResult(res);
      return textResult(res);
    }
  );
}

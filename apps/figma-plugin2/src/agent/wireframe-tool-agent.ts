/**
 * Wireframe Tool Agent – OpenAI Chat Completions with tools (createSection, createButton, addText).
 * Loop: request → tool_calls → executeTool for each → append results to messages → repeat.
 */

import type { ToolName } from './execute-tool';
import { executeTool } from './execute-tool';
import type { NodeMap } from './figma-atoms';
import type { ToolContext } from './figma-molecules';

/** Schema for a single property (supports arrays via items, including nested). */
export interface OpenAIPropertySchema {
  type: string;
  description?: string;
  enum?: string[];
  items?: OpenAIPropertySchema | { type: string };
  properties?: Record<string, { type: string; description?: string }>;
  required?: string[];
}

/** OpenAI tool definition (function calling). */
export interface OpenAITool {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: {
      type: 'object';
      properties: Record<string, OpenAIPropertySchema>;
      required?: string[];
    };
  };
}

export const FIGMA_WIREFRAME_TOOLS: OpenAITool[] = [
  {
    type: 'function',
    function: {
      name: 'createSection',
      description: 'Create a section container (Frame) inside the stage or a row. Use parentId "stage" for full-width sections, or a rowId for columns. Use direction: "horizontal" to place elements (e.g. buttons, inputs) side by side; "vertical" (default) stacks them. Prefer spacing: "spacious" for more space.',
      parameters: {
        type: 'object',
        properties: {
          parentId: { type: 'string', description: 'Use "stage" or a rowId from createRow' },
          name: { type: 'string', description: 'Section name, e.g. Hero, Features' },
          direction: { type: 'string', enum: ['vertical', 'horizontal'], description: 'vertical = stack elements; horizontal = place elements side by side (e.g. buttons next to each other)' },
          spacing: { type: 'string', enum: ['compact', 'normal', 'spacious'], description: 'Preset for gap and padding; use "spacious" for more space' },
          gap: { type: 'number', description: 'Item spacing (overrides spacing preset)' },
          padding: { type: 'number', description: 'Padding (overrides spacing preset)' },
          width: { type: 'number', description: 'Section width (default 400)' },
          height: { type: 'number', description: 'Section height (default 300)' },
          align: { type: 'string', enum: ['min', 'center', 'max'], description: 'Align children: min=left/top, center=centered, max=right/bottom' },
        },
        required: ['parentId', 'name'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'createRow',
      description: 'Create a horizontal row for multi-column layout. Use parentId "stage". Then call createSection with parentId: rowId for each column (e.g. 2 or 3 feature cards side by side). Use align for vertical alignment of row content.',
      parameters: {
        type: 'object',
        properties: {
          parentId: { type: 'string', description: 'Use "stage"' },
          name: { type: 'string', description: 'Row name, e.g. Features row, Pricing row' },
          gap: { type: 'number', description: 'Space between columns (default 24)' },
          padding: { type: 'number', description: 'Row padding (default 20)' },
          align: { type: 'string', enum: ['min', 'center', 'max'], description: 'Vertical alignment of row content' },
        },
        required: ['parentId'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'addText',
      description: 'Add a text block inside an existing section or frame. parentId must be a sectionId returned by createSection.',
      parameters: {
        type: 'object',
        properties: {
          parentId: { type: 'string', description: 'ID of the section/frame (from createSection)' },
          content: { type: 'string', description: 'Text content' },
          variant: { type: 'string', enum: ['h1', 'h2', 'h3', 'body', 'small', 'caption'], description: 'Text style' },
          align: { type: 'string', enum: ['left', 'center', 'right'], description: 'Text alignment' },
        },
        required: ['parentId', 'content'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'createButton',
      description: 'Create a single button inside a section or frame. For multiple buttons side by side (e.g. "Abbrechen" + "Weiter"), use createButtonRow instead. parentId can be a sectionId (direction vertical = button stacks; direction horizontal = use same section and add more createButton calls for side-by-side).',
      parameters: {
        type: 'object',
        properties: {
          parentId: { type: 'string', description: 'ID of the section/frame' },
          label: { type: 'string', description: 'Button label' },
          variant: { type: 'string', enum: ['primary', 'secondary', 'outline'], description: 'Button style' },
          width: { type: 'number', description: 'Button width (default 140)' },
        },
        required: ['parentId', 'label'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'createButtonRow',
      description: 'Create multiple buttons in a row (horizontal) or column (vertical). Use for CTAs like "Abbrechen" + "Weiter" or "Zurück" + "Weiter" side by side, or stacked. Prefer this over multiple createButton when 2+ buttons belong together.',
      parameters: {
        type: 'object',
        properties: {
          parentId: { type: 'string', description: 'ID of the section or frame (e.g. sectionId from createSection)' },
          buttons: {
            type: 'array',
            description: 'Array of { label: string, variant?: "primary"|"secondary"|"outline" }, e.g. [{ label: "Abbrechen", variant: "outline" }, { label: "Weiter", variant: "primary" }]',
            items: {
              type: 'object',
              properties: {
                label: { type: 'string' },
                variant: { type: 'string', description: 'primary, secondary, or outline' },
              },
              required: ['label'],
            },
          },
          direction: { type: 'string', enum: ['horizontal', 'vertical'], description: 'horizontal = buttons side by side (default); vertical = stacked' },
          gap: { type: 'number', description: 'Space between buttons (default 12)' },
        },
        required: ['parentId', 'buttons'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'addPlaceholderImage',
      description: 'Add an image placeholder (gray rectangle with centered label). The label describes the desired image, e.g. "image:produktdetailbild des autos". Always shown in the center of the placeholder.',
      parameters: {
        type: 'object',
        properties: {
          parentId: { type: 'string', description: 'ID of the section or card frame' },
          width: { type: 'number', description: 'Placeholder width (default 320)' },
          height: { type: 'number', description: 'Placeholder height (default 180)' },
          label: { type: 'string', description: 'Short description of the desired image; use "image:..." e.g. "image:produktdetailbild des autos" or "image:Hero-Banner"' },
        },
        required: ['parentId'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'createCard',
      description: 'Create a card with placeholder image, title, optional description and CTA button. Use inside a row for feature/pricing cards side by side. parentId can be stage, sectionId, or rowId.',
      parameters: {
        type: 'object',
        properties: {
          parentId: { type: 'string', description: 'ID of the row or section (e.g. rowId from createRow)' },
          title: { type: 'string', description: 'Card title' },
          description: { type: 'string', description: 'Optional short description' },
          buttonLabel: { type: 'string', description: 'Optional CTA button label' },
          placeholderHeight: { type: 'number', description: 'Height of image placeholder (default 140)' },
        },
        required: ['parentId', 'title'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'createDivider',
      description: 'Create a horizontal or vertical divider line inside a section or frame.',
      parameters: {
        type: 'object',
        properties: {
          parentId: { type: 'string', description: 'ID of the section or frame' },
          orientation: { type: 'string', enum: ['horizontal', 'vertical'], description: 'Line direction (default horizontal)' },
          length: { type: 'number', description: 'Line length in px (default 200)' },
          strokeWeight: { type: 'number', description: 'Line thickness (default 1)' },
        },
        required: ['parentId'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'createAvatar',
      description: 'Create an avatar (circle with initials) inside a section or frame.',
      parameters: {
        type: 'object',
        properties: {
          parentId: { type: 'string', description: 'ID of the section or frame' },
          initials: { type: 'string', description: '1–2 characters, e.g. "AB" for Anna Berger' },
          size: { type: 'number', description: 'Diameter in px (default 40)' },
        },
        required: ['parentId', 'initials'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'createBadge',
      description: 'Create a pill-style badge with a label (e.g. "Neu", "Sale").',
      parameters: {
        type: 'object',
        properties: {
          parentId: { type: 'string', description: 'ID of the section or frame' },
          label: { type: 'string', description: 'Badge text' },
          variant: { type: 'string', enum: ['default', 'primary', 'success'], description: 'Badge style (default: default)' },
        },
        required: ['parentId', 'label'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'createSpacer',
      description: 'Create an invisible spacer (empty frame) to add gap between elements.',
      parameters: {
        type: 'object',
        properties: {
          parentId: { type: 'string', description: 'ID of the section or frame' },
          width: { type: 'number', description: 'Spacer width in px (default 16)' },
          height: { type: 'number', description: 'Spacer height in px (default 16)' },
        },
        required: ['parentId'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'createInput',
      description: 'Create a single form input field with optional label and placeholder. Use for login, search, or single fields.',
      parameters: {
        type: 'object',
        properties: {
          parentId: { type: 'string', description: 'ID of the section or form' },
          label: { type: 'string', description: 'Optional label above the field' },
          placeholder: { type: 'string', description: 'Optional placeholder text inside the field' },
        },
        required: ['parentId'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'createForm',
      description: 'Create a form with multiple fields (e.g. login, contact). Use for contact forms, login forms, or any grouped inputs.',
      parameters: {
        type: 'object',
        properties: {
          parentId: { type: 'string', description: 'Use "stage" or a sectionId' },
          fields: {
            type: 'array',
            description: 'Array of { label: string, placeholder?: string }, e.g. [{ label: "Email", placeholder: "you@example.com" }, { label: "Password", placeholder: "••••••" }]',
            items: {
              type: 'object',
              properties: {
                label: { type: 'string' },
                placeholder: { type: 'string' },
              },
              required: ['label'],
            },
          },
          title: { type: 'string', description: 'Optional form title (e.g. "Login", "Contact")' },
        },
        required: ['parentId', 'fields'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'createTable',
      description: 'Create a data table with header row and optional cell text. Use for pricing tables, feature comparison, or data grids.',
      parameters: {
        type: 'object',
        properties: {
          parentId: { type: 'string', description: 'ID of the section or frame' },
          columns: { type: 'number', description: 'Number of columns (max 10)' },
          rows: { type: 'number', description: 'Number of rows including header (max 20)' },
          headerRow: {
            type: 'array',
            description: 'Optional array of header cell strings; length should match columns',
            items: { type: 'string' },
          },
          cellTexts: {
            type: 'array',
            description: 'Optional 2D array of cell text; each inner array is one data row (no header)',
            items: {
              type: 'array',
              items: { type: 'string' },
            },
          },
        },
        required: ['parentId', 'columns', 'rows'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'setLayout',
      description: 'Update layout of an existing Frame (section, row, or other frame). Use when you need to change layoutMode, itemSpacing, padding, or alignment of a container already created. nodeId must be a frame id (e.g. sectionId, rowId).',
      parameters: {
        type: 'object',
        properties: {
          nodeId: { type: 'string', description: 'ID of the frame to update (from createSection, createRow, etc.)' },
          layoutMode: { type: 'string', enum: ['NONE', 'HORIZONTAL', 'VERTICAL'], description: 'Layout direction' },
          itemSpacing: { type: 'number', description: 'Gap between children' },
          paddingTop: { type: 'number' },
          paddingBottom: { type: 'number' },
          paddingLeft: { type: 'number' },
          paddingRight: { type: 'number' },
          primaryAxisAlignItems: { type: 'string', enum: ['MIN', 'CENTER', 'MAX', 'SPACE_BETWEEN'] },
          counterAxisAlignItems: { type: 'string', enum: ['MIN', 'CENTER', 'MAX'], description: 'Align children on cross axis (e.g. center = centered)' },
        },
        required: ['nodeId'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'createCheckbox',
      description: 'Create a checkbox with optional label. Use for form options like "Newsletter abonnieren", "AGB akzeptiert".',
      parameters: {
        type: 'object',
        properties: {
          parentId: { type: 'string', description: 'ID of the section or form' },
          label: { type: 'string', description: 'Optional label next to the checkbox' },
          checked: { type: 'boolean', description: 'Whether checkbox appears checked (default false)' },
        },
        required: ['parentId'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'createRadio',
      description: 'Create a single radio option (circle + optional label). Call multiple times in the same section for a radio group (e.g. "Option A", "Option B").',
      parameters: {
        type: 'object',
        properties: {
          parentId: { type: 'string', description: 'ID of the section or form' },
          label: { type: 'string', description: 'Optional label next to the radio' },
          selected: { type: 'boolean', description: 'Whether this option appears selected (default false)' },
        },
        required: ['parentId'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'createTextarea',
      description: 'Create a multi-line text field (e.g. for "Nachricht", "Kommentar"). Like createInput but taller; use rows to control height.',
      parameters: {
        type: 'object',
        properties: {
          parentId: { type: 'string', description: 'ID of the section or form' },
          label: { type: 'string', description: 'Optional label above the field' },
          placeholder: { type: 'string', description: 'Optional placeholder text' },
          rows: { type: 'number', description: 'Number of visible lines (default 3, max 8)' },
        },
        required: ['parentId'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'createList',
      description: 'Create a bullet, numbered, or plain list. Use for feature lists, steps, or any list of items.',
      parameters: {
        type: 'object',
        properties: {
          parentId: { type: 'string', description: 'ID of the section or frame' },
          items: {
            type: 'array',
            description: 'Array of strings, one per list item',
            items: { type: 'string' },
          },
          variant: { type: 'string', enum: ['bullet', 'numbered', 'plain'], description: 'bullet = dots, numbered = 1. 2. 3., plain = text only (default bullet)' },
        },
        required: ['parentId', 'items'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'createHeader',
      description: 'Create a top header bar: horizontal section with optional logo, nav items, and CTA button. Use for page header/navigation.',
      parameters: {
        type: 'object',
        properties: {
          parentId: { type: 'string', description: 'Use "stage" for full-width header' },
          logoLabel: { type: 'string', description: 'Optional text for logo area (e.g. brand name)' },
          navItems: {
            type: 'array',
            description: 'Optional array of nav link labels, e.g. ["Home", "Features", "Pricing"]',
            items: { type: 'string' },
          },
          ctaLabel: { type: 'string', description: 'Optional CTA button label (e.g. "Anmelden", "Kontakt")' },
        },
        required: ['parentId'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'createHero',
      description: 'Create a hero block: vertical section with title, optional subtitle, optional image placeholder, optional CTA button. Use for landing hero or section intro.',
      parameters: {
        type: 'object',
        properties: {
          parentId: { type: 'string', description: 'Use "stage" or a sectionId' },
          title: { type: 'string', description: 'Main headline (h1)' },
          subtitle: { type: 'string', description: 'Optional subheading/body text' },
          imageLabel: { type: 'string', description: 'Optional image placeholder label (e.g. "image:Hero-Banner")' },
          ctaLabel: { type: 'string', description: 'Optional CTA button label' },
        },
        required: ['parentId', 'title'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'groupNodes',
      description: 'Group existing nodes into a single group under a parent. Use when you need to group several elements (e.g. logo + text) for selection or layout. childIds must be IDs of nodes already in the nodeMap under the same parent.',
      parameters: {
        type: 'object',
        properties: {
          parentId: { type: 'string', description: 'ID of the container that has (or will have) the grouped nodes' },
          childIds: {
            type: 'array',
            description: 'Array of node IDs to group together',
            items: { type: 'string' },
          },
        },
        required: ['parentId', 'childIds'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'addSvg',
      description: 'Add an icon or vector graphic from SVG code. Use for standalone icons or when you need custom SVG. Pass full SVG markup as svgCode (e.g. "<svg xmlns=\\"http://www.w3.org/2000/svg\\" viewBox=\\"0 0 24 24\\"><path d=\\"M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-7v2h18V6H3z\\"/></svg>"). Optional width/height to resize.',
      parameters: {
        type: 'object',
        properties: {
          parentId: { type: 'string', description: 'ID of the section or frame' },
          svgCode: { type: 'string', description: 'Full SVG markup string (the agent can write simple SVG)' },
          width: { type: 'number', description: 'Optional width in px to resize the SVG frame' },
          height: { type: 'number', description: 'Optional height in px to resize the SVG frame' },
        },
        required: ['parentId', 'svgCode'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'createIconButton',
      description: 'Create a button with an optional icon (from SVG code) and/or label. Use for icon-only buttons (e.g. menu, close, search) or icon+label (e.g. "Download" with download icon). If only label is provided, behaves like createButton.',
      parameters: {
        type: 'object',
        properties: {
          parentId: { type: 'string', description: 'ID of the section or frame' },
          iconSvg: { type: 'string', description: 'SVG markup for the icon (e.g. simple path or full <svg>...</svg>)' },
          label: { type: 'string', description: 'Button label; omit for icon-only button' },
          variant: { type: 'string', enum: ['primary', 'secondary', 'outline'], description: 'Button style' },
          iconSize: { type: 'number', description: 'Icon size in px (default 24)' },
        },
        required: ['parentId'],
      },
    },
  },
];

export const WIREFRAME_TOOL_AGENT_SYSTEM_PROMPT = `You are a Figma wireframe builder. A root frame with id "stage" already exists; all content must go inside it.

Rules:
1. Full-width sections: call createSection with parentId: "stage" and a name. Use spacing: "spacious" for generous spacing.
2. Layout: Use createSection with direction: "horizontal" when elements (buttons, inputs, text+image) should sit side by side; direction: "vertical" (default) when they should stack. Use align: "center" or "max" on createSection/createRow to center or right-align content. To change layout of an existing frame use setLayout(nodeId, ...).
3. Multi-column (feature cards, pricing): call createRow with parentId: "stage", then createCard with parentId: rowId for each card (2 or 3 cards), or createSection(parentId: rowId) for custom columns.
4. For hero images or section images use addPlaceholderImage inside a section. For ready-made cards (image + title + description + button) use createCard.
5. Fill sections with addText, createButton, createButtonRow, addPlaceholderImage, or createCard. Prefer spacing: "spacious".
6. Use createDivider for horizontal or vertical separator lines; createAvatar for user initials in a circle; createBadge for labels like "Neu" or "Sale"; createSpacer for invisible gaps.
7. For contact forms, login forms, or grouped inputs use createForm with fields (each field can have label and placeholder). For a single input use createInput. For checkboxes (e.g. "Newsletter") use createCheckbox; for radio options use createRadio multiple times in same section; for multi-line text use createTextarea with rows.
8. For bullet or numbered lists use createList with items: [...] and variant: "bullet" or "numbered" or "plain".
9. For data grids, pricing tables, or comparison tables use createTable with columns, rows, optional headerRow and cellTexts (max 10 columns, 20 rows).
10. For a top navigation bar use createHeader with parentId "stage", optional logoLabel, navItems array, and ctaLabel. For a hero block (headline + optional subtitle + image + CTA) use createHero. To group existing nodes use groupNodes(parentId, childIds).
11. For icons or custom vector graphics use addSvg(parentId, svgCode) with full SVG markup; you can write simple SVG (e.g. path, circle, rect). For icon-only or icon+label buttons use createIconButton with iconSvg and optional label.
12. When the wireframe is complete, reply with a short summary and do not call any more tools.
13. Use h1 for main headings, h2 for section titles, body for body text.`;

export interface RunWireframeToolAgentOptions {
  fetch: (url: string, opts: { method: string; headers: Record<string, string>; body: string }) => Promise<Response>;
  apiKey: string;
  model: string;
  userPrompt: string;
  viewport: string;
  nodeMap: NodeMap;
  maxSteps?: number;
  requestTimeoutMs?: number;
  onProgress?: (message: string) => void;
}

export type RunWireframeToolAgentResult =
  | { success: true; nodeMap: NodeMap; firstSectionId?: string }
  | { success: false; error: string };

/** One OpenAI message (role + content or tool_calls / tool). */
type ChatMessage =
  | { role: 'system' | 'user' | 'assistant'; content: string }
  | { role: 'assistant'; content: string | null; tool_calls?: Array<{ id: string; type: 'function'; function: { name: string; arguments: string } }> }
  | { role: 'tool'; tool_call_id: string; content: string };

function parseToolArgs(argsJson: string): Record<string, unknown> {
  try {
    return JSON.parse(argsJson) as Record<string, unknown>;
  } catch {
    return {};
  }
}

/**
 * Run the wireframe tool agent: send messages to OpenAI with tools; on tool_calls execute each
 * via executeTool and append results; repeat until no tool_calls or maxSteps.
 */
export async function runWireframeToolAgent(options: RunWireframeToolAgentOptions): Promise<RunWireframeToolAgentResult> {
  const {
    fetch: doFetch,
    apiKey,
    model,
    userPrompt,
    viewport,
    nodeMap,
    maxSteps = 15,
    requestTimeoutMs = 60000,
    onProgress,
  } = options;

  const context: ToolContext = { nodeMap };
  const messages: ChatMessage[] = [
    { role: 'system', content: WIREFRAME_TOOL_AGENT_SYSTEM_PROMPT },
    { role: 'user', content: `Viewport: ${viewport}. Build a wireframe: ${userPrompt}. Use createSection with parentId "stage" for each area, then addText and createButton inside those sections.` },
  ];

  let firstSectionId: string | undefined;
  let step = 0;

  const timeout = <T>(p: Promise<T>, ms: number, msg: string) =>
    Promise.race([
      p,
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error(msg)), ms)
      ),
    ]);

  while (step < maxSteps) {
    step++;
    onProgress?.(`OpenAI (Schritt ${step})…`);

    const body = JSON.stringify({
      model,
      messages,
      tools: FIGMA_WIREFRAME_TOOLS,
      tool_choice: 'auto',
    });

    const res = await timeout(
      doFetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
        body,
      }),
      requestTimeoutMs,
      'OpenAI request timeout'
    );

    if (!res.ok) {
      const errText = await res.text();
      return { success: false, error: `OpenAI ${res.status}: ${errText.slice(0, 200)}` };
    }

    const data = await res.json();
    const choice = data.choices?.[0];
    const message = choice?.message;
    if (!message) {
      return { success: false, error: 'OpenAI response had no message' };
    }

    const assistantContent = typeof message.content === 'string' ? message.content : (message.content ?? null);
    const toolCalls = message.tool_calls;

    messages.push({
      role: 'assistant',
      content: assistantContent,
      ...(toolCalls?.length ? { tool_calls: toolCalls } : {}),
    } as ChatMessage);

    if (!toolCalls || toolCalls.length === 0) {
      return { success: true, nodeMap, firstSectionId };
    }

    onProgress?.(`Führe ${toolCalls.length} Tool(s) aus…`);

    for (const tc of toolCalls) {
      const id = tc.id;
      const name = tc.function?.name as ToolName | undefined;
      const args = parseToolArgs(tc.function?.arguments ?? '{}');

      if (!name || !FIGMA_WIREFRAME_TOOLS.some((t) => t.function.name === name)) {
        messages.push({ role: 'tool', tool_call_id: id, content: JSON.stringify({ success: false, error: `Unknown tool: ${name}` }) });
        continue;
      }

      const result = await executeTool(context, name, args as any);
      const content = result.success
        ? JSON.stringify(result.result)
        : JSON.stringify({ success: false, error: result.error });

      if (result.success && name === 'createSection' && result.result && 'sectionId' in result.result && !firstSectionId) {
        firstSectionId = result.result.sectionId;
      }

      messages.push({ role: 'tool', tool_call_id: id, content });
    }
  }

  return { success: true, nodeMap, firstSectionId };
}

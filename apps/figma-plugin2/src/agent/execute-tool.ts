/**
 * Dispatcher for Figma tool calls. Maps tool names to molecules (createSection, createButton, addText).
 * Used by the tool-based wireframe flow and (later) by the agent loop with OpenAI tools.
 */

import type { ToolContext } from './figma-molecules';
import {
  createSection,
  createRow,
  createButton,
  addText,
  addPlaceholderImage,
  createCard,
  createDivider,
  createAvatar,
  createBadge,
  createSpacer,
  createInput,
  createForm,
  createTable,
  createButtonRow,
  setLayout,
  createCheckbox,
  createRadio,
  createTextarea,
  createList,
  createHeader,
  createHero,
  addSvg,
  createIconButton,
} from './figma-molecules';
import { groupNodes } from './figma-atoms';
import type {
  CreateSectionArgs,
  CreateSectionResult,
  CreateRowArgs,
  CreateRowResult,
  CreateButtonArgs,
  CreateButtonResult,
  CreateButtonRowArgs,
  CreateButtonRowResult,
  AddTextArgs,
  AddTextResult,
  AddPlaceholderImageArgs,
  AddPlaceholderImageResult,
  CreateCardArgs,
  CreateCardResult,
  CreateDividerArgs,
  CreateDividerResult,
  CreateAvatarArgs,
  CreateAvatarResult,
  CreateBadgeArgs,
  CreateBadgeResult,
  CreateSpacerArgs,
  CreateSpacerResult,
  CreateInputArgs,
  CreateInputResult,
  CreateFormArgs,
  CreateFormResult,
  CreateTableArgs,
  CreateTableResult,
  SetLayoutArgs,
  SetLayoutResult,
  CreateCheckboxArgs,
  CreateCheckboxResult,
  CreateRadioArgs,
  CreateRadioResult,
  CreateTextareaArgs,
  CreateTextareaResult,
  CreateListArgs,
  CreateListResult,
  CreateHeaderArgs,
  CreateHeaderResult,
  CreateHeroArgs,
  CreateHeroResult,
  AddSvgArgs,
  AddSvgResult,
  CreateIconButtonArgs,
  CreateIconButtonResult,
} from './figma-molecules';
import type { GroupNodesArgs, GroupNodesResult } from './figma-atoms';

export type ToolName =
  | 'createSection'
  | 'createRow'
  | 'createButton'
  | 'addText'
  | 'addPlaceholderImage'
  | 'createCard'
  | 'createDivider'
  | 'createAvatar'
  | 'createBadge'
  | 'createSpacer'
  | 'createInput'
  | 'createForm'
  | 'createTable'
  | 'createButtonRow'
  | 'setLayout'
  | 'createCheckbox'
  | 'createRadio'
  | 'createTextarea'
  | 'createList'
  | 'createHeader'
  | 'createHero'
  | 'groupNodes';

export type ToolArgsMap = {
  createSection: CreateSectionArgs;
  createRow: CreateRowArgs;
  createButton: CreateButtonArgs;
  addText: AddTextArgs;
  addPlaceholderImage: AddPlaceholderImageArgs;
  createCard: CreateCardArgs;
  createDivider: CreateDividerArgs;
  createAvatar: CreateAvatarArgs;
  createBadge: CreateBadgeArgs;
  createSpacer: CreateSpacerArgs;
  createInput: CreateInputArgs;
  createForm: CreateFormArgs;
  createTable: CreateTableArgs;
  createButtonRow: CreateButtonRowArgs;
  setLayout: SetLayoutArgs;
  createCheckbox: CreateCheckboxArgs;
  createRadio: CreateRadioArgs;
  createTextarea: CreateTextareaArgs;
  createList: CreateListArgs;
  createHeader: CreateHeaderArgs;
  createHero: CreateHeroArgs;
  groupNodes: GroupNodesArgs;
  addSvg: AddSvgArgs;
  createIconButton: CreateIconButtonArgs;
};

export type ToolResultMap = {
  createSection: CreateSectionResult;
  createRow: CreateRowResult;
  createButton: CreateButtonResult;
  addText: AddTextResult;
  addPlaceholderImage: AddPlaceholderImageResult;
  createCard: CreateCardResult;
  createDivider: CreateDividerResult;
  createAvatar: CreateAvatarResult;
  createBadge: CreateBadgeResult;
  createSpacer: CreateSpacerResult;
  createInput: CreateInputResult;
  createForm: CreateFormResult;
  createTable: CreateTableResult;
  createButtonRow: CreateButtonRowResult;
  setLayout: SetLayoutResult;
  createCheckbox: CreateCheckboxResult;
  createRadio: CreateRadioResult;
  createTextarea: CreateTextareaResult;
  createList: CreateListResult;
  createHeader: CreateHeaderResult;
  createHero: CreateHeroResult;
  groupNodes: GroupNodesResult;
  addSvg: AddSvgResult;
  createIconButton: CreateIconButtonResult;
};

export type ExecuteToolResult<T extends ToolName = ToolName> =
  | { success: true; tool: T; result: ToolResultMap[T] }
  | { success: false; tool: string; error: string };

/**
 * Execute a single Figma tool by name with the given args.
 * Async because createButton and addText use loadFont/createText.
 */
export async function executeTool<T extends ToolName>(
  context: ToolContext,
  toolName: T,
  args: ToolArgsMap[T]
): Promise<ExecuteToolResult<T>> {
  try {
    switch (toolName) {
      case 'createSection': {
        const out = createSection(context, args as CreateSectionArgs);
        if (out.success) return { success: true, tool: toolName, result: out } as ExecuteToolResult<T>;
        return { success: false, tool: toolName, error: out.error } as ExecuteToolResult<T>;
      }
      case 'createRow': {
        const out = createRow(context, args as CreateRowArgs);
        if (out.success) return { success: true, tool: toolName, result: out } as ExecuteToolResult<T>;
        return { success: false, tool: toolName, error: out.error } as ExecuteToolResult<T>;
      }
      case 'createButton': {
        const out = await createButton(context, args as CreateButtonArgs);
        if (out.success) return { success: true, tool: toolName, result: out } as ExecuteToolResult<T>;
        return { success: false, tool: toolName, error: out.error } as ExecuteToolResult<T>;
      }
      case 'addText': {
        const out = await addText(context, args as AddTextArgs);
        if (out.success) return { success: true, tool: toolName, result: out } as ExecuteToolResult<T>;
        return { success: false, tool: toolName, error: out.error } as ExecuteToolResult<T>;
      }
      case 'addPlaceholderImage': {
        const out = await addPlaceholderImage(context, args as AddPlaceholderImageArgs);
        if (out.success) return { success: true, tool: toolName, result: out } as ExecuteToolResult<T>;
        return { success: false, tool: toolName, error: out.error } as ExecuteToolResult<T>;
      }
      case 'createCard': {
        const out = await createCard(context, args as CreateCardArgs);
        if (out.success) return { success: true, tool: toolName, result: out } as ExecuteToolResult<T>;
        return { success: false, tool: toolName, error: out.error } as ExecuteToolResult<T>;
      }
      case 'createDivider': {
        const out = createDivider(context, args as CreateDividerArgs);
        if (out.success) return { success: true, tool: toolName, result: out } as ExecuteToolResult<T>;
        return { success: false, tool: toolName, error: out.error } as ExecuteToolResult<T>;
      }
      case 'createAvatar': {
        const out = await createAvatar(context, args as CreateAvatarArgs);
        if (out.success) return { success: true, tool: toolName, result: out } as ExecuteToolResult<T>;
        return { success: false, tool: toolName, error: out.error } as ExecuteToolResult<T>;
      }
      case 'createBadge': {
        const out = await createBadge(context, args as CreateBadgeArgs);
        if (out.success) return { success: true, tool: toolName, result: out } as ExecuteToolResult<T>;
        return { success: false, tool: toolName, error: out.error } as ExecuteToolResult<T>;
      }
      case 'createSpacer': {
        const out = createSpacer(context, args as CreateSpacerArgs);
        if (out.success) return { success: true, tool: toolName, result: out } as ExecuteToolResult<T>;
        return { success: false, tool: toolName, error: out.error } as ExecuteToolResult<T>;
      }
      case 'createInput': {
        const out = await createInput(context, args as CreateInputArgs);
        if (out.success) return { success: true, tool: toolName, result: out } as ExecuteToolResult<T>;
        return { success: false, tool: toolName, error: out.error } as ExecuteToolResult<T>;
      }
      case 'createForm': {
        const out = await createForm(context, args as CreateFormArgs);
        if (out.success) return { success: true, tool: toolName, result: out } as ExecuteToolResult<T>;
        return { success: false, tool: toolName, error: out.error } as ExecuteToolResult<T>;
      }
      case 'createTable': {
        const out = await createTable(context, args as CreateTableArgs);
        if (out.success) return { success: true, tool: toolName, result: out } as ExecuteToolResult<T>;
        return { success: false, tool: toolName, error: out.error } as ExecuteToolResult<T>;
      }
      case 'createButtonRow': {
        const out = await createButtonRow(context, args as CreateButtonRowArgs);
        if (out.success) return { success: true, tool: toolName, result: out } as unknown as ExecuteToolResult<T>;
        return { success: false, tool: toolName, error: out.error } as unknown as ExecuteToolResult<T>;
      }
      case 'setLayout': {
        const out = setLayout(context, args as SetLayoutArgs);
        if (out.success) return { success: true, tool: toolName, result: out } as ExecuteToolResult<T>;
        return { success: false, tool: toolName, error: out.error } as ExecuteToolResult<T>;
      }
      case 'createCheckbox': {
        const out = await createCheckbox(context, args as CreateCheckboxArgs);
        if (out.success) return { success: true, tool: toolName, result: out } as ExecuteToolResult<T>;
        return { success: false, tool: toolName, error: out.error } as ExecuteToolResult<T>;
      }
      case 'createRadio': {
        const out = await createRadio(context, args as CreateRadioArgs);
        if (out.success) return { success: true, tool: toolName, result: out } as ExecuteToolResult<T>;
        return { success: false, tool: toolName, error: out.error } as ExecuteToolResult<T>;
      }
      case 'createTextarea': {
        const out = await createTextarea(context, args as CreateTextareaArgs);
        if (out.success) return { success: true, tool: toolName, result: out } as ExecuteToolResult<T>;
        return { success: false, tool: toolName, error: out.error } as ExecuteToolResult<T>;
      }
      case 'createList': {
        const out = await createList(context, args as CreateListArgs);
        if (out.success) return { success: true, tool: toolName, result: out } as ExecuteToolResult<T>;
        return { success: false, tool: toolName, error: out.error } as ExecuteToolResult<T>;
      }
      case 'createHeader': {
        const out = await createHeader(context, args as CreateHeaderArgs);
        if (out.success) return { success: true, tool: toolName, result: out } as ExecuteToolResult<T>;
        return { success: false, tool: toolName, error: out.error } as ExecuteToolResult<T>;
      }
      case 'createHero': {
        const out = await createHero(context, args as CreateHeroArgs);
        if (out.success) return { success: true, tool: toolName, result: out } as ExecuteToolResult<T>;
        return { success: false, tool: toolName, error: out.error } as ExecuteToolResult<T>;
      }
      case 'groupNodes': {
        const a = args as GroupNodesArgs;
        const out = groupNodes(context.nodeMap, a.parentId, a.childIds, a.id, context.api);
        if (out.success) return { success: true, tool: toolName, result: out } as ExecuteToolResult<T>;
        return { success: false, tool: toolName, error: out.error } as ExecuteToolResult<T>;
      }
      default: {
        const name = toolName as string;
        if (name === 'addSvg') {
          const out = addSvg(context, args as AddSvgArgs);
          if (out.success) return { success: true, tool: toolName, result: out } as unknown as ExecuteToolResult<T>;
          return { success: false, tool: toolName, error: out.error } as unknown as ExecuteToolResult<T>;
        }
        if (name === 'createIconButton') {
          const out = await createIconButton(context, args as CreateIconButtonArgs);
          if (out.success) return { success: true, tool: toolName, result: out } as unknown as ExecuteToolResult<T>;
          return { success: false, tool: toolName, error: out.error } as unknown as ExecuteToolResult<T>;
        }
        return { success: false, tool: name || 'unknown', error: `Unknown tool: ${name || 'unknown'}` } as ExecuteToolResult<T>;
      }
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, tool: toolName, error: message } as ExecuteToolResult<T>;
  }
}

/**
 * Figma Executor Agent – Only agent that knows the Figma Plugin API.
 * Outputs a list of whitelisted commands (no generated code). Self-corrects on interpreter errors.
 *
 * @deprecated Not used by generate-wireframe anymore; the plugin uses only the Wireframe Tool Agent.
 * Kept for reference or potential future use (e.g. export/replay).
 */
import { FIGMA_COMMAND_JSON_SCHEMA } from './figma-command-schema';
import type { FigmaCommand, FigmaExecutorResponse } from './figma-command-schema';

export { FIGMA_COMMAND_JSON_SCHEMA };
export type { FigmaExecutorResponse, FigmaCommand };

export const FIGMA_API_EXPERT_SYSTEM_PROMPT = [
  "Du bist der Figma Executor (Figma Commander). Du bist der EINZIGE Agent, der die Figma Plugin API kennt.",
  "",
  "### DEINE AUFGABE:",
  "Du bekommst eine Design-Spec (neutraler Design-Baum, kein Code). Deine Ausgabe ist AUSSCHLIESSLICH eine Liste von Befehlen (commands) und eine rootId.",
  "Du schreibst KEINEN JavaScript-Code. Du gibst nur das JSON-Objekt { thinking, commands, rootId } zurück.",
  "",
  "### ERLAUBTE BEFEHLE (Whitelist):",
  "- loadFont: { op: 'loadFont', family: string, style: string } – vor jedem createText mit neuer Font aufrufen.",
  "- createFrame: { op: 'createFrame', id, name?, width, height, layoutMode?, primaryAxisSizingMode?, counterAxisSizingMode?, primaryAxisAlignItems?, counterAxisAlignItems?, itemSpacing?, paddingTop?, paddingBottom?, paddingLeft?, paddingRight?, fills?, strokes?, strokeWeight?, cornerRadius?, clipsContent?, opacity?, x?, y? }",
  "- createRectangle: { op: 'createRectangle', id, name?, width, height, fills?, strokes?, strokeWeight?, cornerRadius?, opacity?, x?, y? }",
  "- createEllipse: { op: 'createEllipse', id, name?, width, height, fills?, strokes?, strokeWeight?, opacity?, x?, y? }",
  "- createLine: { op: 'createLine', id, name?, x1?, y1?, x2?, y2?, strokes?, strokeWeight? } – LineNode: resize(width, 0) wird vom Interpreter gesetzt.",
  "- createText: { op: 'createText', id, name?, characters, fontSize, fontFamily, fontStyle, fills?, textAlignHorizontal?, textAutoResize?, opacity?, x?, y? } – Vorher loadFont für diese fontFamily/fontStyle aufrufen.",
  "- appendChild: { op: 'appendChild', parentId, childId } – Hierarchie aufbauen.",
  "- group: { op: 'group', id, name?, childIds: string[], parentId, index? }",
  "",
  "### REGELN:",
  "- Jeder erzeugte Node braucht eine eindeutige id (string). appendChild und group referenzieren diese ids.",
  "- rootId muss die id des Root-Nodes sein, der an den Kontext angehängt wird (meist der äußerste Container der Sektion).",
  "- Reihenfolge: loadFont vor createText; createFrame/createRectangle/createEllipse/createLine/createText vor appendChild; appendChild in logischer Reihenfolge (Eltern vor Kindern).",
  "- appendChild: parentId darf NUR die id eines createFrame sein. createRectangle, createEllipse, createLine und createText können in Figma KEINE Kinder haben – sie dürfen niemals als parentId in appendChild vorkommen. Für Buttons/Cards: createFrame als Container (z.B. id 'btn_frame'), dann createRectangle/createText als Kinder; appendChild(parentId: 'btn_frame', childId: 'btn_rect') usw.",
  "- Farben: fills und strokes als Array von { type: 'SOLID', color: { r, g, b }, opacity? }. r, g, b zwischen 0 und 1.",
  "- Layout: layoutMode 'NONE' | 'HORIZONTAL' | 'VERTICAL'. primaryAxisSizingMode / counterAxisSizingMode 'FIXED' | 'AUTO'.",
  "",
  "### FALLBACK BEI KOMPLEXEN SPECS:",
  "Falls die Design-Spec overlay, hover, aspectRatio oder width/height als Prozent/'100%' enthält: ignoriere diese. Übersetze nur in erlaubte Befehle – z.B. placeholder als createFrame + createRectangle mit festen Pixel-Maßen, Overlays als normale vertikale/horizontale Anordnung (kein Stapeln). Alle width/height als Zahlen (px).",
  "",
  "### SELF-CORRECTION:",
  "Wenn du eine Fehlermeldung vom Interpreter bekommst (error + optional failedCommand), analysiere den Fehler und gib eine korrigierte commands-Liste zurück. Ändere nur das Nötige (z.B. fehlende loadFont, falsche id-Referenz, ungültige Property). Bei 'parent X not found or not a container': X ist ein Rechteck/Text/Ellipse/Line – ersetze parentId durch die id eines createFrame, der dieses Element als Kind haben soll (ggf. createFrame für den Container ergänzen).",
  "",
  "Referenz: https://developers.figma.com/docs/plugins/api/figma/",
].join("\n");

/**
 * Builds the user prompt for the Figma Executor.
 * designSpec: JSON object (design tree) or string description (fallback).
 * For self-correction: pass error and optionally failedCommands.
 */
export function buildApiExpertPrompt(
  designSpec: object | string,
  error?: string,
  failedCommands?: FigmaCommand[],
  researchResults?: string
): string {
  const specStr =
    typeof designSpec === "string"
      ? designSpec
      : JSON.stringify(designSpec, null, 2);

  let p = "ÜBERSETZE DIESE DESIGN-SPEC IN FIGMA-BEFEHLE (commands + rootId):\n\n" + specStr + "\n\nAntworte NUR mit JSON { thinking, commands, rootId }.\n";

  if (error && failedCommands && failedCommands.length > 0) {
    p += "\n⚠️ FEHLER IM VORHERIGEN LAUF:\nFehler: " + error + "\nFehlgeschlagene Befehle (Ausschnitt): " + JSON.stringify(failedCommands.slice(-5)) + "\n\nKorrigiere die Befehle und gib eine vollständige neue commands-Liste zurück.\n";
  }

  if (researchResults) {
    p += "\n🔍 RESEARCH-ERGEBNISSE:\n" + researchResults + "\n\nNutze diese Informationen für korrekte Befehle.\n";
  }

  return p;
}

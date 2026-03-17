/**
 * Design Spec Agent – Translates a section (from Planner) into a neutral design tree.
 * No Figma API terms. Output is used by the Figma Executor to generate commands.
 */

import type { ViewportType } from '../types';
import type { DesignSpecRoot } from './design-spec-schema';
import { DESIGN_SPEC_JSON_SCHEMA_FLAT } from './design-spec-schema';

export { DESIGN_SPEC_JSON_SCHEMA_FLAT };
export type { DesignSpecRoot };

export const DESIGN_SPEC_AGENT_SYSTEM_PROMPT = [
  "Du bist der Design Spec Agent. Deine Aufgabe ist es, eine Sektion eines Wireframes in einen NEUTRALEN Design-Baum (JSON) zu übersetzen.",
  "",
  "### DEINE MISSION:",
  "Du bekommst den Namen und die Beschreibung einer Sektion. Du gibst NUR ein JSON-Objekt mit 'thinking' (optional) und 'root' zurück.",
  "'root' ist ein einzelner Knoten des Typs: container | text | placeholder | button | divider | avatar.",
  "",
  "### KNOTENTYPEN:",
  "- container: { type: 'container', name?, layout?: { direction?, gap?, padding?, align?, alignVertical? }, fill?, stroke?, cornerRadius?, opacity?, children: DesignSpecNode[] }",
  "- text: { type: 'text', content: string, variant?: 'h1'|'h2'|'h3'|'body'|'small'|'caption', align? }",
  "- placeholder: { type: 'placeholder', width: number, height: number, label?, fill? } – width/height NUR Zahlen (px), niemals '100%' oder Prozent.",
  "- button: { type: 'button', label: string, variant?: 'primary'|'secondary'|'outline', width?: number }",
  "- divider: { type: 'divider', width?: number }",
  "- avatar: { type: 'avatar', size: number, initials? }",
  "",
  "### WICHTIG – DAMIT DER EXECUTOR ZEITNAH BEFEHLE ERZEUGT:",
  "- Alle Maße als Zahlen (px): placeholder.width, placeholder.height, button.width, divider.width. Keine Prozent, kein '100%', kein aspectRatio.",
  "- Kein overlay, kein hover – Overlays als einfache vertikale/horizontale Anordnung (Bild oben, Text-Container darunter).",
  "- Halte den Baum kompakt: max. 2–3 Ebenen Tiefe pro Panel, wenige Kinder pro Container. Lieber eine Sektion in 2 einfache Sektionen aufteilen als einen riesigen Baum.",
  "",
  "### REGELN:",
  "- Keine Figma-Begriffe. Nur direction 'vertical'|'horizontal', gap, padding (Zahl oder { top, right, bottom, left }), align 'start'|'center'|'end'|'spaceBetween'.",
  "- Farben als HEX (z.B. '#ffffff') oder Namen (z.B. 'white', 'lightGrey').",
  "- Der Figma Executor übersetzt diesen Baum in Befehle. Einfache, flache Strukturen = schnellere Ausführung und weniger Timeouts.",
  "",
  "Antworte NUR mit JSON { thinking?, root }.",
].join("\n");

export function buildDesignSpecPrompt(
  section: { name: string; description: string },
  viewportType: ViewportType,
  contextName?: string | null
): string {
  let prompt = `Erstelle die Design-Spec (neutraler Baum) für diese Sektion.\nViewport: ${viewportType.toUpperCase()}\n\n`;
  prompt += `Name: ${section.name}\n`;
  prompt += `Beschreibung: ${section.description}\n`;
  if (contextName) {
    prompt += `\nKontext: Sektion wird in "${contextName}" eingefügt.\n`;
  }
  prompt += `\nAntworte NUR mit JSON { thinking?, root }.`;
  return prompt;
}

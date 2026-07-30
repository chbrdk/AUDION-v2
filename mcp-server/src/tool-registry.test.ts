import test from 'node:test';
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const toolFiles = ['tools.ts', 'tools-ux-journey.ts', 'tools-ux-studies.ts', 'tools-chat.ts'];

function toolNames(): string[] {
  const names: string[] = [];
  const re = /registerTool\(\s*['"](audion\.[^'"]+)['"]/g;
  for (const file of toolFiles) {
    const source = readFileSync(resolve(__dirname, file), 'utf8');
    let m: RegExpExecArray | null;
    while ((m = re.exec(source)) !== null) {
      names.push(m[1]);
    }
  }
  return names;
}

test('includes audience orchestration tools', () => {
  const names = toolNames();
  assert.ok(names.includes('audion.project_suggest_target_groups'));
  assert.ok(names.includes('audion.target_group_create'));
  assert.ok(names.includes('audion.target_group_personas_generate'));
  assert.ok(names.includes('audion.project_checkion_site_topics'));
});

test('includes ux journey and chat tools', () => {
  const names = toolNames();
  assert.ok(names.includes('audion.ux_journey_run_start'));
  assert.ok(names.includes('audion.ux_journey_run_get'));
  assert.ok(names.includes('audion.ux_study_list'));
  assert.ok(names.includes('audion.ux_wave_start'));
  assert.ok(names.includes('audion.ux_wave_evaluate'));
  assert.ok(names.includes('audion.chat_message'));
  assert.ok(names.includes('audion.chat_history_upsert'));
});

test('does not call deprecated ai-assist path', () => {
  const toolsSource = readFileSync(resolve(__dirname, 'tools.ts'), 'utf8');
  assert.equal(toolsSource.includes('/ai-assist/assist'), false);
  assert.ok(toolsSource.includes('/ai-assist${q}'));
});

test('has at least 75 registered tools', () => {
  assert.ok(toolNames().length >= 75);
});

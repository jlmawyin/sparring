import { readFileSync } from 'node:fs';
import type { Catalog, CriterionId, ScoreSnapshot } from '../src/shared/types.ts';

interface Scenario {
  id: string;
  version: string;
  titulo: string;
  brief_visible: string;
  roles: { usuario: string; agente_simulado: string };
  hechos: Record<string, unknown>;
  restricciones_autoridad: Record<string, unknown>;
  opening_line: string;
  objeciones: { id: string; text: string; trigger: string }[];
}

export interface Schema {
  type: 'object' | 'array' | 'string' | 'integer';
  additionalProperties?: boolean;
  properties?: Record<string, Schema>;
  required?: string[];
  items?: Schema;
  minItems?: number;
  maxItems?: number;
  minLength?: number;
  maxLength?: number;
  minimum?: number;
  maximum?: number;
  enum?: string[];
}

function read(relative: string): string {
  return readFileSync(new URL(relative, import.meta.url), 'utf8');
}

export const scenarios = JSON.parse(read('../spec/scenarios.json')) as Scenario[];
export const rubric = JSON.parse(read('../spec/rubric.json')) as {
  version: string;
  criteria: { id: CriterionId; label: string; weight: number; anchors: Record<string, string> }[];
};
export const toolDefinitions = JSON.parse(read('../spec/tools.json')) as {
  type: string; name: string; description: string; parameters: Schema;
}[];
const clientTemplate = read('../prompts/client-system.md');
const coachTemplate = read('../prompts/coach-system.md');

export const catalog: Catalog = {
  scenarios: scenarios.map(scenario => ({
    id: scenario.id, version: scenario.version, title: scenario.titulo,
    brief: scenario.brief_visible, role: scenario.roles.usuario,
    facts: scenario.hechos, authority: scenario.restricciones_autoridad,
  })),
  criteria: rubric.criteria.map(({ id, label, weight }) => ({ id, label, weight })),
};

export function sessionConfig(scenario: Scenario): Record<string, unknown> {
  // Verified against AssemblyAI events-reference: PCM16 mono 24 kHz is implicit.
  return {
    system_prompt: clientTemplate
      .replace('{{SCENARIO_JSON}}', () => JSON.stringify(scenario)),
    greeting: scenario.opening_line,
    input: { format: { encoding: 'audio/pcm' }, language_codes: ['es'], transcription_mode: 'max_accuracy' },
    output: { voice: 'lola', format: { encoding: 'audio/pcm' } },
    tools: toolDefinitions,
  };
}

export function coachPrompt(snapshot: ScoreSnapshot, scenario: Scenario): string {
  return coachTemplate
    .replace('{{SCORE_SNAPSHOT}}', () => JSON.stringify(snapshot))
    .replace('{{SCENARIO_JSON}}', () => JSON.stringify(scenario));
}

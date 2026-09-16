import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const read = (path) => readFileSync(resolve(root, path), 'utf8').replace(/^\uFEFF/, '');
const json = (path) => JSON.parse(read(path));
const scenarios = json('spec/scenarios.json');
const rubric = json('spec/rubric.json');
const tools = json('spec/tools.json');
const evaluation = json('spec/evaluation-cases.json');
const expectedIds = ['empathy', 'discovery', 'objection_handling', 'solution_integrity', 'closing'];
assert.deepEqual(rubric.criteria.map(c => c.id), expectedIds);
assert.deepEqual(rubric.criteria.map(c => c.weight), [20, 20, 25, 20, 15]);
assert.equal(rubric.criteria.reduce((sum, c) => sum + c.weight, 0), 100);
for (const c of rubric.criteria) {
  assert.deepEqual(Object.keys(c.anchors), ['0', '1', '2', '3', '4']);
  assert.ok(c.not_observable_condition.length > 0);
}
assert.deepEqual(scenarios.map(s => s.id), ['late_delivery', 'price_objection', 'cancellation']);
const scenarioIds = new Set(scenarios.map(s => s.id));
for (const s of scenarios) {
  assert.equal(s.datos_sinteticos, true);
  assert.ok(s.version && s.brief_visible && s.opening_line);
  assert.ok(s.objeciones.length >= 2);
  assert.equal(new Set(s.objeciones.map(o => o.id)).size, s.objeciones.length);
  assert.equal(s.limites_sesion.duracion_simulacion_segundos, 180);
  assert.equal(s.limites_sesion.duracion_feedback_total_segundos, 60);
  assert.equal(s.limites_sesion.duracion_finalizacion_max_segundos + s.limites_sesion.duracion_coaching_segundos, 60);
}
assert.deepEqual(tools.map(t => t.name), ['log_objection', 'score_rubric']);
for (const tool of tools) {
  assert.equal(tool.type, 'function');
  assert.equal(tool.parameters.additionalProperties, false);
  for (const key of tool.parameters.required) assert.ok(key in tool.parameters.properties);
}
const item = tools[1].parameters.properties.observations.items;
assert.deepEqual(item.properties.criterion_id.enum, expectedIds);
assert.equal(item.additionalProperties, false);
assert.equal(item.properties.level.minimum, 0);
assert.equal(item.properties.level.maximum, 4);
assert.ok(!('total' in item.properties));
assert.ok(!('weight' in item.properties));
assert.ok(evaluation.cases.length >= 9);
assert.equal(new Set(evaluation.cases.map(c => c.id)).size, evaluation.cases.length);
for (const c of evaluation.cases) {
  assert.equal(c.status, 'NOT_RUN', c.id + ': fixtures are expectations, not app results');
  assert.ok(scenarioIds.has(c.scenario_id), c.id);
  assert.equal(new Set(c.transcript.map(t => t.turn_id)).size, c.transcript.length, c.id);
  assert.equal(new Set(c.expected_observations.map(o => o.criterion_id)).size, c.expected_observations.length, c.id);
  let coverage = 0, weighted = 0;
  for (const observation of c.expected_observations) {
    const criterion = rubric.criteria.find(r => r.id === observation.criterion_id);
    assert.ok(criterion, c.id + ': criterion');
    assert.ok(Number.isInteger(observation.level) && observation.level >= 0 && observation.level <= 4);
    const turn = c.transcript.find(t => t.turn_id === observation.user_turn_id);
    assert.ok(turn && turn.role === 'USER', c.id + ': evidence must belong to USER');
    assert.ok(observation.quote && turn.text.includes(observation.quote), c.id + ': exact quote');
    coverage += criterion.weight;
    weighted += criterion.weight * observation.level / 4;
  }
  const total = coverage < 60 ? null : Math.round(100 * weighted / coverage);
  assert.equal(c.expected.coverage, coverage, c.id + ': coverage');
  assert.equal(c.expected.total, total, c.id + ': arithmetic');
}
const docs = ['README.md', 'AGENTS.md', 'docs/PLAN.md', 'docs/HACKATHON.md',
  'docs/SDD.md', 'docs/TEST-PLAN.md', 'docs/PROMPTS.md', 'docs/ORCHESTRATION.md',
  'docs/HANDOFF.md', 'docs/SUBMISSION.md', 'prompts/client-system.md', 'prompts/coach-system.md'];
let links = 0;
for (const doc of docs) {
  const content = read(doc);
  assert.ok(content.length > 100, doc);
  for (const match of content.matchAll(/\[[^\]]+\]\(([^)]+)\)/g)) {
    const target = match[1];
    if (/^(https?:|#)/.test(target)) continue;
    assert.ok(existsSync(resolve(root, dirname(doc), target.split('#')[0])), doc + ': missing ' + target);
    links++;
  }
}
assert.ok(read('prompts/client-system.md').includes('{{SCENARIO_JSON}}'));
assert.ok(read('prompts/client-system.md').includes('{{RUBRIC_JSON}}'));
assert.ok(read('prompts/coach-system.md').includes('{{SCORE_SNAPSHOT}}'));
console.log(JSON.stringify({
  status: 'PASS',
  scope: 'Specification consistency only; no application, API, audio or semantic model tests',
  scenarios: scenarios.length, criteria: rubric.criteria.length, tools: tools.length,
  fixtures: evaluation.cases.length, documents: docs.length, localLinks: links,
  checked: ['JSON parsing', 'IDs/weights/anchors', 'session time budget', 'tool envelope',
    'fixture evidence/roles', 'fixture expected arithmetic', 'document links', 'prompt placeholders'],
  productTests: 'NOT_RUN'
}, null, 2));

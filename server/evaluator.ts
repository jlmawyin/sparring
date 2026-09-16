import { createHash } from 'node:crypto';
import type { CriterionId, CriterionScore, EvaluateRequest, EvaluateResponse, ScoreSnapshot, Turn } from '../src/shared/types.ts';
import { rubric, toolDefinitions, type Schema } from './catalog.ts';
import { ApiError, boundedString, closedObject, integer, invalid, isRecord } from './errors.ts';

export interface EvaluationState {
  revision: number;
  transcript: Turn[];
  criteria: Map<CriterionId, CriterionScore>;
  calls: Map<string, { hash: string; response: EvaluateResponse }>;
  frozen: boolean;
}

export function newEvaluation(): EvaluationState {
  return { revision: 0, transcript: [], criteria: new Map(), calls: new Map(), frozen: false };
}

export function snapshot(state: EvaluationState): ScoreSnapshot {
  const criteria = rubric.criteria.map(({ id, label, weight }) =>
    structuredClone(state.criteria.get(id) ?? { id, label, weight, level: null, evidence: null }));
  const observed = criteria.filter(criterion => criterion.level !== null);
  const coverage = observed.reduce((sum, criterion) => sum + criterion.weight, 0);
  const total = coverage < 60 ? null : Math.round(
    100 * observed.reduce((sum, criterion) => sum + criterion.weight * criterion.level! / 4, 0) / coverage,
  );
  const priority = [...observed].sort((a, b) => a.level! - b.level!)[0];
  return {
    revision: state.revision, criteria, coverage, total, provisional: !state.frozen,
    limitations: [
      'Evaluación formativa: los niveles propuestos por el modelo pueden contener errores.',
      'Las citas se verifican contra la transcripción enviada por el navegador.',
      ...(coverage < 100 ? ['Falta evidencia para uno o más criterios; ausencia no equivale a cero.'] : []),
    ],
    next_action: priority
      ? `Practica «${priority.label}» revisando su evidencia y los límites del caso.`
      : 'Completa una respuesta al caso para obtener evidencia de práctica.',
  };
}

/** Only the deliberately small schema vocabulary used in spec/tools.json. */
function validateSchema(value: unknown, schema: Schema): void {
  if (schema.type === 'object') {
    if (!isRecord(value)) invalid();
    const properties = schema.properties ?? {};
    if ((schema.required ?? []).some(key => !Object.hasOwn(value, key)) ||
      (schema.additionalProperties === false && Object.keys(value).some(key => !Object.hasOwn(properties, key)))) invalid();
    for (const [key, child] of Object.entries(value)) {
      if (Object.hasOwn(properties, key)) validateSchema(child, properties[key]);
    }
  } else if (schema.type === 'array') {
    if (!Array.isArray(value) || value.length < (schema.minItems ?? 0) || value.length > (schema.maxItems ?? Infinity)) invalid();
    for (const item of value) validateSchema(item, schema.items!);
  } else if (schema.type === 'string') {
    if (typeof value !== 'string' || value.length < (schema.minLength ?? 0) || value.length > (schema.maxLength ?? Infinity) ||
      (schema.enum && !schema.enum.includes(value))) invalid();
  } else if (schema.type === 'integer') {
    if (!integer(value, schema.minimum ?? Number.MIN_SAFE_INTEGER, schema.maximum ?? Number.MAX_SAFE_INTEGER)) invalid();
  } else {
    // A future schema feature must be implemented explicitly, never silently ignored.
    throw new Error('Unsupported tool schema');
  }
}

export function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (isRecord(value)) return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;
  return JSON.stringify(value);
}

export function validateEvaluateEnvelope(value: unknown): asserts value is EvaluateRequest {
  closedObject(value, ['session_context', 'revision', 'tool_call_id', 'tool_name', 'arguments', 'transcript_final']);
  if (!boundedString(value.session_context, 128) || !integer(value.revision, 0, Number.MAX_SAFE_INTEGER) ||
    !boundedString(value.tool_call_id, 160) || !['score_rubric', 'log_objection'].includes(String(value.tool_name)) ||
    !isRecord(value.arguments) || !Array.isArray(value.transcript_final)) invalid();
}

function validateTranscript(value: Turn[], previous: Turn[]): void {
  if (value.length > 200) invalid();
  const ids = new Set<string>();
  for (const turn of value) {
    closedObject(turn, ['turn_id', 'role', 'text', 'received_at_ms'], ['interrupted']);
    if (!boundedString(turn.turn_id, 160) || ids.has(turn.turn_id) || !['USER', 'AGENT'].includes(turn.role) ||
      !boundedString(turn.text, 1000) || !integer(turn.received_at_ms, 0, Number.MAX_SAFE_INTEGER) ||
      (Object.hasOwn(turn, 'interrupted') && typeof turn.interrupted !== 'boolean')) invalid();
    ids.add(turn.turn_id);
  }
  if (value.length < previous.length || previous.some((turn, index) => canonical(turn) !== canonical(value[index]))) {
    throw new ApiError(409, 'transcript_conflict', 'La transcripción final aceptada no puede modificarse.');
  }
}

function exactTurn(transcript: Turn[], role: Turn['role'], quote: string, occurrence: number): Turn {
  // occurrence counts matching turns of the requested role, not repeated substrings in one turn.
  const match = transcript.filter(turn => turn.role === role && turn.text.includes(quote))[occurrence - 1];
  if (!match) throw new ApiError(422, 'evidence_not_found', 'La cita no coincide con un turno final del rol requerido.');
  return match;
}

interface Observation { criterion_id: CriterionId; level: number; quote: string; occurrence: number; rationale: string }

export function evaluate(state: EvaluationState, request: EvaluateRequest, objectionIds: string[], now: () => number): EvaluateResponse {
  const started = now();
  const hash = createHash('sha256').update(canonical({
    revision: request.revision, tool_name: request.tool_name,
    arguments: request.arguments, transcript_final: request.transcript_final,
  })).digest('hex');
  const replay = state.calls.get(request.tool_call_id);
  if (replay) {
    if (hash !== replay.hash) throw new ApiError(409, 'call_conflict', 'El identificador de la herramienta ya tiene otro contenido.');
    return structuredClone(replay.response);
  }
  if (state.frozen) throw new ApiError(409, 'session_frozen', 'La evaluación de esta práctica ya está cerrada.');
  if (request.revision !== state.revision) throw new ApiError(409, 'revision_conflict', 'La revisión de la evaluación no coincide.');
  if (state.calls.size >= 400) throw new ApiError(429, 'tool_limit', 'Se alcanzó el límite de herramientas de esta práctica.');
  validateTranscript(request.transcript_final, state.transcript);
  validateSchema(request.arguments, toolDefinitions.find(tool => tool.name === request.tool_name)!.parameters);
  // Build the complete candidate first. A rejected call cannot append turns or partially replace scores.
  const candidate: EvaluationState = { ...state, revision: state.revision + 1, criteria: new Map(state.criteria) };
  let result: Record<string, unknown>;
  if (request.tool_name === 'score_rubric') {
    const observations = request.arguments.observations as Observation[];
    const seen = new Set<CriterionId>();
    for (const observation of observations) {
      if (seen.has(observation.criterion_id)) invalid();
      seen.add(observation.criterion_id);
      const turn = exactTurn(request.transcript_final, 'USER', observation.quote, observation.occurrence);
      const criterion = rubric.criteria.find(item => item.id === observation.criterion_id)!;
      candidate.criteria.set(criterion.id, {
        id: criterion.id, label: criterion.label, weight: criterion.weight, level: observation.level,
        evidence: { quote: observation.quote, user_turn_id: turn.turn_id,
          rationale: observation.rationale, source_call_id: request.tool_call_id },
      });
    }
    result = { accepted: true, revision: candidate.revision, observed_criteria: [...seen] };
  } else {
    const { objection_id, quote, occurrence } = request.arguments as { objection_id: string; quote: string; occurrence: number };
    if (!objectionIds.includes(objection_id)) invalid();
    const turn = exactTurn(request.transcript_final, 'AGENT', quote, occurrence);
    result = { accepted: true, revision: candidate.revision, objection_id, quote, agent_turn_id: turn.turn_id };
  }
  const response: EvaluateResponse = { snapshot: snapshot(candidate), result, processing_ms: Math.max(0, now() - started) };
  state.criteria = candidate.criteria;
  state.revision = candidate.revision;
  state.transcript = structuredClone(request.transcript_final);
  state.calls.set(request.tool_call_id, { hash, response: structuredClone(response) });
  return response;
}

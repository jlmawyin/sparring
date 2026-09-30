import { describe, expect, it, vi } from 'vitest';
import { rubric } from '../../server/catalog.ts';
import { newEvaluation, type EvaluationState } from '../../server/evaluator.ts';
import { scoreLatestTurn, type GatewayScenario, type GatewaySessionState } from '../../server/gatewayScore.ts';
import type { Turn } from '../../src/shared/types.ts';

const scenario: GatewayScenario = {
  id: 'late_delivery',
  titulo: 'Pedido tardío', hechos: { pedido_id: 'ORD-1' }, restricciones_autoridad: { max_reembolso_directo: 25 },
};

const priceObjectionScenario: GatewayScenario = {
  id: 'price_objection',
  titulo: 'Objeción de precio', hechos: {}, restricciones_autoridad: { descuento_maximo_autorizado: 0.05 },
};

const cancellationScenario: GatewayScenario = {
  id: 'cancellation',
  titulo: 'Intención de cancelación', hechos: {}, restricciones_autoridad: {},
};

function session(evaluation: EvaluationState = newEvaluation(), scenarioOverride: GatewayScenario = scenario): GatewaySessionState {
  return {
    evaluation, scenario: scenarioOverride,
    gatewayProcessedTurns: new Set(), gatewayInFlightTurns: new Set(), gatewayCallCount: 0,
    gatewayQueue: Promise.resolve(),
  };
}

function turn(text: string, id = 'u1'): Turn {
  return { turn_id: id, role: 'USER', text, received_at_ms: 1 };
}

function toolCallResponse(observations: unknown[], status = 200): Response {
  return new Response(JSON.stringify({
    choices: [{ message: { tool_calls: [{ function: { name: 'score_rubric_observation', arguments: JSON.stringify({ observations }) } }] } }],
  }), { status });
}

function obs(overrides: Partial<{ criterion_id: string; level: number; rationale: string }> = {}) {
  return { criterion_id: 'empathy', level: 3, rationale: 'Reconoce el impacto.', ...overrides };
}

describe('scoreLatestTurn: Gateway call contract', () => {
  it('forces tool_choice to the single function, sends the raw key with no Bearer prefix', async () => {
    const fetchMock = vi.fn<typeof fetch>(async () => toolCallResponse([obs()]));
    const s = session();
    const t = turn('Entiendo el impacto en su equipo.');
    await scoreLatestTurn(s, 'ctx', { turn_id: t.turn_id, transcript_final: [t] }, rubric, { key: 'raw-key-value', fetch: fetchMock, mode: 'gateway' });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toBe('https://llm-gateway.assemblyai.com/v1/chat/completions');
    expect((init?.headers as Record<string, string>).Authorization).toBe('raw-key-value');
    const body = JSON.parse(String(init?.body));
    expect(body.tool_choice).toEqual({ type: 'function', function: { name: 'score_rubric_observation' } });
    expect(body.tools[0].function.name).toBe('score_rubric_observation');
  });

  it('anchors a >500-char USER turn to a deterministic <=500-char exact substring, never a fabricated quote', async () => {
    const longText = 'Entiendo el impacto en su equipo. '.repeat(20); // > 500 chars
    expect(longText.length).toBeGreaterThan(500);
    const fetchMock = vi.fn<typeof fetch>(async () => toolCallResponse([obs()]));
    const s = session();
    const t = turn(longText);
    const result = await scoreLatestTurn(s, 'ctx', { turn_id: t.turn_id, transcript_final: [t] }, rubric, { key: 'k', fetch: fetchMock, mode: 'gateway' });

    expect(result.status).toBe('scored');
    const criterion = result.snapshot.criteria.find(c => c.id === 'empathy')!;
    expect(criterion.level).toBe(3);
    expect(criterion.evidence!.user_turn_id).toBe(t.turn_id);
    expect(criterion.evidence!.quote.length).toBeLessThanOrEqual(500);
    expect(longText.includes(criterion.evidence!.quote)).toBe(true); // exact substring, never invented
  });

  it('never fabricates a quote: the Gateway response cannot carry one, and the anchor always comes from the transcript', async () => {
    const fetchMock = vi.fn<typeof fetch>(async (_url, init) => {
      const body = JSON.parse(String(init?.body));
      // The Gateway's own tool schema has no quote/occurrence field at all.
      expect(body.tools[0].function.parameters.properties.observations.items.properties).not.toHaveProperty('quote');
      expect(body.tools[0].function.parameters.properties.observations.items.properties).not.toHaveProperty('occurrence');
      return toolCallResponse([obs()]);
    });
    const s = session();
    const t = turn('Entiendo el impacto en su equipo.');
    const result = await scoreLatestTurn(s, 'ctx', { turn_id: t.turn_id, transcript_final: [t] }, rubric, { key: 'k', fetch: fetchMock, mode: 'gateway' });
    expect(result.status).toBe('scored');
  });

  it('dedupes: a second call for an already-processed turn is a no-op, does not re-call the Gateway', async () => {
    const fetchMock = vi.fn<typeof fetch>(async () => toolCallResponse([obs()]));
    const s = session();
    const t = turn('Entiendo el impacto en su equipo.');
    const first = await scoreLatestTurn(s, 'ctx', { turn_id: t.turn_id, transcript_final: [t] }, rubric, { key: 'k', fetch: fetchMock, mode: 'gateway' });
    expect(first.status).toBe('scored');
    const second = await scoreLatestTurn(s, 'ctx', { turn_id: t.turn_id, transcript_final: [t] }, rubric, { key: 'k', fetch: fetchMock, mode: 'gateway' });
    expect(second.status).toBe('duplicate');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('enforces a per-session Gateway call cap and fails closed without calling upstream past it', async () => {
    const fetchMock = vi.fn<typeof fetch>(async () => toolCallResponse([obs()]));
    const s = session();
    const t1 = turn('Primer turno del usuario.', 'u1');
    const t2 = turn('Segundo turno del usuario.', 'u2');
    await scoreLatestTurn(s, 'ctx', { turn_id: t1.turn_id, transcript_final: [t1] }, rubric, { key: 'k', fetch: fetchMock, mode: 'gateway', maxCallsPerSession: 1 });
    const result = await scoreLatestTurn(s, 'ctx', { turn_id: t2.turn_id, transcript_final: [t1, t2] }, rubric, { key: 'k', fetch: fetchMock, mode: 'gateway', maxCallsPerSession: 1 });
    expect(result).toMatchObject({ status: 'incomplete', reason: 'gateway_limit' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['timeout', async (signal: AbortSignal | undefined) => new Promise<Response>((_, reject) => {
      signal?.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' })));
    })],
    ['upstream_error', async () => new Response('server error', { status: 500 })],
    ['invalid_response', async () => new Response('not json', { status: 200 })],
  ] as const)('fails closed on %s: no score, snapshot unchanged', async (reason, makeResponse) => {
    const fetchMock = vi.fn<typeof fetch>(async (_url, init) => makeResponse((init as RequestInit)?.signal ?? undefined));
    const s = session();
    const t = turn('Entiendo el impacto en su equipo.');
    const result = await scoreLatestTurn(s, 'ctx', { turn_id: t.turn_id, transcript_final: [t] }, rubric, { key: 'k', fetch: fetchMock, mode: 'gateway', timeoutMs: 20 });
    expect(result.status).toBe('incomplete');
    expect(result.reason).toBe(reason);
    expect(result.snapshot.coverage).toBe(0);
  });

  it('rejects a malformed function-call payload (out-of-range level) as invalid_response, fails closed', async () => {
    const fetchMock = vi.fn<typeof fetch>(async () => toolCallResponse([{ criterion_id: 'empathy', level: 9, rationale: 'x' }]));
    const s = session();
    const t = turn('Entiendo el impacto en su equipo.');
    const result = await scoreLatestTurn(s, 'ctx', { turn_id: t.turn_id, transcript_final: [t] }, rubric, { key: 'k', fetch: fetchMock, mode: 'gateway' });
    expect(result).toMatchObject({ status: 'incomplete', reason: 'invalid_response' });
  });
});

describe('scoreLatestTurn: serialized out-of-order Gateway completions', () => {
  it('applies both turns evidence even when the later turn Gateway reply arrives first', async () => {
    const s = session();
    const t1 = turn('Primer turno con evidencia de empatía.', 'u1');
    const t2 = turn('Segundo turno con evidencia de descubrimiento.', 'u2');

    let releaseFirst!: () => void;
    const firstGate = new Promise<void>(resolve => { releaseFirst = resolve; });
    const fetchMock = vi.fn<typeof fetch>(async (_url, init) => {
      const body = JSON.parse(String((init as RequestInit)?.body));
      const isFirstTurn = body.messages[1].content.includes('"target_user_turn_id":"u1"');
      if (isFirstTurn) {
        await firstGate; // first turn's network reply is deliberately delayed
        return toolCallResponse([obs({ criterion_id: 'empathy' })]);
      }
      return toolCallResponse([obs({ criterion_id: 'discovery' })]); // second turn resolves immediately
    });

    const firstCall = scoreLatestTurn(s, 'ctx', { turn_id: t1.turn_id, transcript_final: [t1] }, rubric, { key: 'k', fetch: fetchMock, mode: 'gateway' });
    // Give the second call's synchronous setup a turn to run before releasing the first.
    await new Promise(resolve => setTimeout(resolve, 0));
    const secondCall = scoreLatestTurn(s, 'ctx', { turn_id: t2.turn_id, transcript_final: [t1, t2] }, rubric, { key: 'k', fetch: fetchMock, mode: 'gateway' });
    await new Promise(resolve => setTimeout(resolve, 0));
    releaseFirst();

    const [firstResult, secondResult] = await Promise.all([firstCall, secondCall]);
    expect(firstResult.status).toBe('scored');
    expect(secondResult.status).toBe('scored');
    // Both criteria persisted: neither observation collided with a transcript_conflict.
    expect(secondResult.snapshot.criteria.find(c => c.id === 'empathy')?.level).toBe(3);
    expect(secondResult.snapshot.criteria.find(c => c.id === 'discovery')?.level).toBe(3);
  });
});

describe('scoreLatestTurn: local deterministic scorer (SPARRING_SCORING_MODE=local, the default)', () => {
  it('defaults to local mode and never sends a request upstream', async () => {
    const fetchMock = vi.fn<typeof fetch>(async () => { throw new Error('must not call upstream'); });
    const s = session();
    const t = turn('Entiendo el impacto que esto tuvo en su equipo, lamento el retraso.');
    const result = await scoreLatestTurn(s, 'ctx', { turn_id: t.turn_id, transcript_final: [t] }, rubric, { key: 'k', fetch: fetchMock });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.status).toBe('scored');
  });

  it('scores a realistic full response (impact + discovery question + authorized option + follow-up) at >=60% coverage', async () => {
    const fetchMock = vi.fn<typeof fetch>(async () => { throw new Error('must not call upstream'); });
    const s = session();
    const t = turn(
      'Entiendo el impacto que esto tuvo en su equipo. ¿Cuál es la prioridad más urgente para resolverlo? '
      + 'Puedo ofrecerle el reembolso del envío o elevar su solicitud para una respuesta en 4 horas hábiles. '
      + 'Le daré seguimiento y le confirmaré dentro de ese plazo.',
    );
    const result = await scoreLatestTurn(s, 'ctx', { turn_id: t.turn_id, transcript_final: [t] }, rubric, { key: 'k', fetch: fetchMock });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.status).toBe('scored');
    expect(result.snapshot.coverage).toBeGreaterThanOrEqual(60);
    expect(result.snapshot.total).not.toBeNull();
    expect(result.snapshot.criteria.find(c => c.id === 'empathy')?.level).toBe(3);
    expect(result.snapshot.criteria.find(c => c.id === 'discovery')?.level).toBe(3);
    expect(result.snapshot.criteria.find(c => c.id === 'solution_integrity')?.level).toBe(3);
    expect(result.snapshot.criteria.find(c => c.id === 'closing')?.level).toBe(3);
  });

  it('does not let a vague apology reach 60% coverage', async () => {
    const fetchMock = vi.fn<typeof fetch>(async () => { throw new Error('must not call upstream'); });
    const s = session();
    const t = turn('Disculpe las molestias, lo sentimos mucho.');
    const result = await scoreLatestTurn(s, 'ctx', { turn_id: t.turn_id, transcript_final: [t] }, rubric, { key: 'k', fetch: fetchMock });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.snapshot.coverage).toBeLessThan(60);
    expect(result.snapshot.total).toBeNull();
    expect(result.snapshot.criteria.find(c => c.id === 'empathy')?.level).toBe(1);
  });

  it('never rewards an unauthorized 30% discount promise: solution_integrity scores 0, not a passing level', async () => {
    const fetchMock = vi.fn<typeof fetch>(async () => { throw new Error('must not call upstream'); });
    const s = session();
    const t = turn('Entiendo su frustración, pero le doy el 30% de descuento que pide.');
    const result = await scoreLatestTurn(s, 'ctx', { turn_id: t.turn_id, transcript_final: [t] }, rubric, { key: 'k', fetch: fetchMock });
    expect(fetchMock).not.toHaveBeenCalled();
    const criterion = result.snapshot.criteria.find(c => c.id === 'solution_integrity')!;
    expect(criterion.level).toBe(0);
  });

  it('anchors every local observation to a verbatim, exactly occurring quote from the finalized USER turn', async () => {
    const fetchMock = vi.fn<typeof fetch>(async () => { throw new Error('must not call upstream'); });
    const s = session();
    const text = 'Entiendo el impacto que esto tuvo en su equipo.';
    const t = turn(text);
    const result = await scoreLatestTurn(s, 'ctx', { turn_id: t.turn_id, transcript_final: [t] }, rubric, { key: 'k', fetch: fetchMock });
    const criterion = result.snapshot.criteria.find(c => c.id === 'empathy')!;
    expect(criterion.evidence!.quote).toBe(text);
    expect(criterion.evidence!.user_turn_id).toBe(t.turn_id);
  });

  it('dedupes in local mode too: a second call for an already-processed turn is a no-op', async () => {
    const fetchMock = vi.fn<typeof fetch>(async () => { throw new Error('must not call upstream'); });
    const s = session();
    const t = turn('Entiendo el impacto que esto tuvo en su equipo.');
    const first = await scoreLatestTurn(s, 'ctx', { turn_id: t.turn_id, transcript_final: [t] }, rubric, { key: 'k', fetch: fetchMock });
    expect(first.status).toBe('scored');
    const second = await scoreLatestTurn(s, 'ctx', { turn_id: t.turn_id, transcript_final: [t] }, rubric, { key: 'k', fetch: fetchMock });
    expect(second.status).toBe('duplicate');
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('scoreLatestTurn: local scorer applies exact per-scenario authority (spec/scenarios.json)', () => {
  const fetchMock = vi.fn<typeof fetch>(async () => { throw new Error('must not call upstream'); });

  it('price_objection: never rewards an unauthorized 20% discount, scores solution_integrity 0', async () => {
    const s = session(newEvaluation(), priceObjectionScenario);
    const t = turn('Entiendo su posición, de acuerdo, le hago un 20% de descuento para no perder la venta.');
    const result = await scoreLatestTurn(s, 'ctx', { turn_id: t.turn_id, transcript_final: [t] }, rubric, { key: 'k', fetch: fetchMock });
    expect(result.snapshot.criteria.find(c => c.id === 'solution_integrity')?.level).toBe(0);
  });

  it('price_objection: rewards the authorized 5% discount only when conditioned on this-quarter signing and value understood', async () => {
    const s = session(newEvaluation(), priceObjectionScenario);
    const t = turn(
      'Entiendo que el valor diferencial fue comprendido. Puedo ofrecerle un 5% de descuento si firma en el trimestre en curso.',
    );
    const result = await scoreLatestTurn(s, 'ctx', { turn_id: t.turn_id, transcript_final: [t] }, rubric, { key: 'k', fetch: fetchMock });
    expect(result.snapshot.criteria.find(c => c.id === 'solution_integrity')?.level).toBe(3);
  });

  it('price_objection: a bare 5% offer without the quarter/value-understood conditions is not rewarded', async () => {
    const s = session(newEvaluation(), priceObjectionScenario);
    const t = turn('Le puedo ofrecer un 5% de descuento.');
    const result = await scoreLatestTurn(s, 'ctx', { turn_id: t.turn_id, transcript_final: [t] }, rubric, { key: 'k', fetch: fetchMock });
    expect(result.snapshot.criteria.find(c => c.id === 'solution_integrity')?.level ?? null).toBeNull();
  });

  it('cancellation: never rewards a guaranteed/instant bank refund promise, scores solution_integrity 0', async () => {
    const s = session(newEvaluation(), cancellationScenario);
    const t = turn('No se preocupe, le devuelvo el dinero ahora mismo en esta llamada.');
    const result = await scoreLatestTurn(s, 'ctx', { turn_id: t.turn_id, transcript_final: [t] }, rubric, { key: 'k', fetch: fetchMock });
    expect(result.snapshot.criteria.find(c => c.id === 'solution_integrity')?.level).toBe(0);
  });

  it('cancellation: rewards opening the referenced case with the 48-business-hour update, without guaranteeing a refund', async () => {
    const s = session(newEvaluation(), cancellationScenario);
    const t = turn('Voy a abrir el caso REC-8812 y le confirmo una actualización dentro de 48 horas hábiles.');
    const result = await scoreLatestTurn(s, 'ctx', { turn_id: t.turn_id, transcript_final: [t] }, rubric, { key: 'k', fetch: fetchMock });
    expect(result.snapshot.criteria.find(c => c.id === 'solution_integrity')?.level).toBe(3);
  });

  it('cancellation: a late_delivery-style shipping refund is not rewarded in the wrong scenario', async () => {
    const s = session(newEvaluation(), cancellationScenario);
    const t = turn('Le puedo hacer el reembolso del envío mientras revisamos el resto.');
    const result = await scoreLatestTurn(s, 'ctx', { turn_id: t.turn_id, transcript_final: [t] }, rubric, { key: 'k', fetch: fetchMock });
    expect(result.snapshot.criteria.find(c => c.id === 'solution_integrity')?.level ?? null).toBeNull();
  });

  it('price_objection: a late_delivery-style shipping refund is not rewarded in the wrong scenario', async () => {
    const s = session(newEvaluation(), priceObjectionScenario);
    const t = turn('Le puedo hacer el reembolso del envío como gesto de buena voluntad.');
    const result = await scoreLatestTurn(s, 'ctx', { turn_id: t.turn_id, transcript_final: [t] }, rubric, { key: 'k', fetch: fetchMock });
    expect(result.snapshot.criteria.find(c => c.id === 'solution_integrity')?.level ?? null).toBeNull();
  });

  it('an unrecognized/missing scenario id returns null for solution_integrity rather than a high level', async () => {
    const s = session(newEvaluation(), { titulo: 'Escenario sin id', hechos: {}, restricciones_autoridad: {} });
    const t = turn('Puedo ofrecerle el reembolso del envío o elevar su solicitud para una respuesta en 4 horas hábiles.');
    const result = await scoreLatestTurn(s, 'ctx', { turn_id: t.turn_id, transcript_final: [t] }, rubric, { key: 'k', fetch: fetchMock });
    expect(result.snapshot.criteria.find(c => c.id === 'solution_integrity')?.level ?? null).toBeNull();
  });
});

describe('scoreLatestTurn: local scorer accepts natural voice phrasing for late_delivery authority', () => {
  const fetchMock = vi.fn<typeof fetch>(async () => { throw new Error('must not call upstream'); });

  it('rewards a shipping refund phrased with an intervening dollar amount ("reembolso de los 25 dólares del envío")', async () => {
    const s = session();
    const t = turn('Le ofrezco el reembolso de los 25 dólares del envío.');
    const result = await scoreLatestTurn(s, 'ctx', { turn_id: t.turn_id, transcript_final: [t] }, rubric, { key: 'k', fetch: fetchMock });
    expect(result.snapshot.criteria.find(c => c.id === 'solution_integrity')?.level).toBe(3);
  });

  it('rewards escalation phrased with the spelled-out "cuatro horas hábiles" (not just the digit)', async () => {
    const s = session();
    const t = turn('Voy a elevar su solicitud para una respuesta en cuatro horas hábiles.');
    const result = await scoreLatestTurn(s, 'ctx', { turn_id: t.turn_id, transcript_final: [t] }, rubric, { key: 'k', fetch: fetchMock });
    expect(result.snapshot.criteria.find(c => c.id === 'solution_integrity')?.level).toBe(3);
  });

  it('closing rewards a spelled-out timeframe plus a concrete simulated reference ("referencia simulada SUP-9482")', async () => {
    const s = session();
    const t = turn('Le daré seguimiento con la referencia simulada SUP-9482 y una respuesta en cuatro horas hábiles.');
    const result = await scoreLatestTurn(s, 'ctx', { turn_id: t.turn_id, transcript_final: [t] }, rubric, { key: 'k', fetch: fetchMock });
    expect(result.snapshot.criteria.find(c => c.id === 'closing')?.level).toBe(3);
  });

  it('does not reward a shipping refund padded far past the amount as an unrelated later refund mention', async () => {
    const s = session();
    const t = turn('El reembolso que procesamos ayer para otro pedido no aplica aquí; hoy solo puedo revisar el envío.');
    const result = await scoreLatestTurn(s, 'ctx', { turn_id: t.turn_id, transcript_final: [t] }, rubric, { key: 'k', fetch: fetchMock });
    expect(result.snapshot.criteria.find(c => c.id === 'solution_integrity')?.level ?? null).toBeNull();
  });

  it('still blocks an unauthorized full/integral refund even when phrased naturally, not the authorized shipping refund', async () => {
    const s = session();
    const t = turn('Le hago el reembolso íntegro del monto de su pedido, incluyendo el envío.');
    const result = await scoreLatestTurn(s, 'ctx', { turn_id: t.turn_id, transcript_final: [t] }, rubric, { key: 'k', fetch: fetchMock });
    expect(result.snapshot.criteria.find(c => c.id === 'solution_integrity')?.level).toBe(0);
  });

  it('still blocks an unauthorized 30% promise even alongside natural escalation phrasing', async () => {
    const s = session();
    const t = turn('Le doy el 30% de descuento y además elevo su solicitud en cuatro horas hábiles.');
    const result = await scoreLatestTurn(s, 'ctx', { turn_id: t.turn_id, transcript_final: [t] }, rubric, { key: 'k', fetch: fetchMock });
    expect(result.snapshot.criteria.find(c => c.id === 'solution_integrity')?.level).toBe(0);
  });

  it('closing: a bare reference-style word without a concrete case code is not level 3', async () => {
    const s = session();
    const t = turn('Le daré seguimiento con la referencia que anotamos.');
    const result = await scoreLatestTurn(s, 'ctx', { turn_id: t.turn_id, transcript_final: [t] }, rubric, { key: 'k', fetch: fetchMock });
    expect(result.snapshot.criteria.find(c => c.id === 'closing')?.level ?? null).toBeNull();
  });
});

describe('scoreLatestTurn: local scorer closing requires a concrete timeframe/reference plus follow-up', () => {
  const fetchMock = vi.fn<typeof fetch>(async () => { throw new Error('must not call upstream'); });

  it('a generic "quedamos en contacto" alone is not level 3', async () => {
    const s = session();
    const t = turn('Quedamos en contacto.');
    const result = await scoreLatestTurn(s, 'ctx', { turn_id: t.turn_id, transcript_final: [t] }, rubric, { key: 'k', fetch: fetchMock });
    expect(result.snapshot.criteria.find(c => c.id === 'closing')?.level ?? null).toBeNull();
  });

  it('a generic "le daré seguimiento" alone, with no timeframe or reference, is not level 3', async () => {
    const s = session();
    const t = turn('Le daré seguimiento.');
    const result = await scoreLatestTurn(s, 'ctx', { turn_id: t.turn_id, transcript_final: [t] }, rubric, { key: 'k', fetch: fetchMock });
    expect(result.snapshot.criteria.find(c => c.id === 'closing')?.level ?? null).toBeNull();
  });

  it('a concrete timeframe/reference plus a follow-up action is level 3', async () => {
    const s = session();
    const t = turn('Le daré seguimiento y le confirmaré dentro de ese plazo.');
    const result = await scoreLatestTurn(s, 'ctx', { turn_id: t.turn_id, transcript_final: [t] }, rubric, { key: 'k', fetch: fetchMock });
    expect(result.snapshot.criteria.find(c => c.id === 'closing')?.level).toBe(3);
  });
});

describe('scoreLatestTurn: local scorer empathy level 3 requires concrete impact, not the bare phrase', () => {
  const fetchMock = vi.fn<typeof fetch>(async () => { throw new Error('must not call upstream'); });

  it('the bare phrase "entiendo el impacto" alone is not level 3', async () => {
    const s = session();
    const t = turn('Entiendo el impacto.');
    const result = await scoreLatestTurn(s, 'ctx', { turn_id: t.turn_id, transcript_final: [t] }, rubric, { key: 'k', fetch: fetchMock });
    expect(result.snapshot.criteria.find(c => c.id === 'empathy')?.level ?? null).toBeNull();
  });

  it('"entiendo el impacto en su equipo" (concrete) is level 3', async () => {
    const s = session();
    const t = turn('Entiendo el impacto en su equipo.');
    const result = await scoreLatestTurn(s, 'ctx', { turn_id: t.turn_id, transcript_final: [t] }, rubric, { key: 'k', fetch: fetchMock });
    expect(result.snapshot.criteria.find(c => c.id === 'empathy')?.level).toBe(3);
  });

  it('a clause naming the cause between "impacto" and the concrete noun (real agent phrasing) is still level 3', async () => {
    const s = session();
    const t = turn(
      'Entiendo el impacto de los 2 días de retraso tuvieron en la operación de su equipo. Lamento la demora. Antes de proponerle un paso, ¿qué es lo urgente para ustedes hoy?'
    );
    const result = await scoreLatestTurn(s, 'ctx', { turn_id: t.turn_id, transcript_final: [t] }, rubric, { key: 'k', fetch: fetchMock });
    expect(result.snapshot.criteria.find(c => c.id === 'empathy')?.level).toBe(3);
  });

  it('the scripted phrasing "entiendo el impacto que los dos días de retraso tuvieron en la operación de su equipo" is level 3', async () => {
    const s = session();
    const t = turn('Entiendo el impacto que los dos días de retraso tuvieron en la operación de su equipo.');
    const result = await scoreLatestTurn(s, 'ctx', { turn_id: t.turn_id, transcript_final: [t] }, rubric, { key: 'k', fetch: fetchMock });
    expect(result.snapshot.criteria.find(c => c.id === 'empathy')?.level).toBe(3);
  });

  it('a concrete noun far past the gap does not turn a bare "entiendo el impacto" into level 3', async () => {
    const s = session();
    const gapFiller = 'x'.repeat(95); // > the 90-char gap allowed between "impacto" and the concrete noun
    const t = turn(`Entiendo el impacto ${gapFiller} su equipo.`);
    const result = await scoreLatestTurn(s, 'ctx', { turn_id: t.turn_id, transcript_final: [t] }, rubric, { key: 'k', fetch: fetchMock });
    expect(result.snapshot.criteria.find(c => c.id === 'empathy')?.level ?? null).not.toBe(3);
  });

  it('does not borrow a concrete noun from the following sentence', async () => {
    const s = session();
    const t = turn('Entiendo el impacto. Su equipo necesita una solución.');
    const result = await scoreLatestTurn(s, 'ctx', { turn_id: t.turn_id, transcript_final: [t] }, rubric, { key: 'k', fetch: fetchMock });
    expect(result.snapshot.criteria.find(c => c.id === 'empathy')?.level ?? null).not.toBe(3);
  });
});

describe('scoreLatestTurn: local scorer only inspects the cited <=500-char quote window', () => {
  const fetchMock = vi.fn<typeof fetch>(async () => { throw new Error('must not call upstream'); });

  it('a marker appearing only after char 500 is never scored, so it can never be "supported" by an unrelated cited quote', async () => {
    const s = session();
    const padding = 'Buenos días, gracias por su paciencia mientras revisamos el caso. '.repeat(8);
    expect(padding.length).toBeGreaterThan(500);
    const t = turn(padding + 'Entiendo el impacto en su equipo.');
    const result = await scoreLatestTurn(s, 'ctx', { turn_id: t.turn_id, transcript_final: [t] }, rubric, { key: 'k', fetch: fetchMock });
    expect(result.status).toBe('no_observation');
    expect(result.snapshot.criteria.find(c => c.id === 'empathy')?.level ?? null).toBeNull();
  });

  it('a marker within the first 500 chars is scored and the evidence quote stays inside that same window', async () => {
    const s = session();
    const lead = 'Entiendo el impacto en su equipo. ';
    const padding = 'Continuamos revisando el caso con calma. '.repeat(15);
    const t = turn(lead + padding);
    const result = await scoreLatestTurn(s, 'ctx', { turn_id: t.turn_id, transcript_final: [t] }, rubric, { key: 'k', fetch: fetchMock });
    const criterion = result.snapshot.criteria.find(c => c.id === 'empathy')!;
    expect(criterion.level).toBe(3);
    expect(criterion.evidence!.quote.length).toBeLessThanOrEqual(500);
    expect(t.text.slice(0, 500).includes(criterion.evidence!.quote)).toBe(true);
  });
});

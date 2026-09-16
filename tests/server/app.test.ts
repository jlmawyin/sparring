import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Server } from 'node:http';
import { readFileSync } from 'node:fs';
import type { AddressInfo } from 'node:net';
import { createApp, type AppOptions } from '../../server/app.ts';
import type { CriterionId, EvaluateRequest, StartResponse, Turn } from '../../src/shared/types.ts';

const KEY = 'test-secret-only-never-a-real-key';
const ORIGIN = 'http://127.0.0.1:5173';
const servers: Server[] = [];
const startBody = { scenario_id: 'late_delivery', scenario_version: '1.0.0', consent: true };
const criteria: CriterionId[] = ['empathy', 'discovery', 'objection_handling', 'solution_integrity', 'closing'];

afterEach(async () => {
  await Promise.all(servers.splice(0).map(server => new Promise<void>((resolve, reject) => {
    server.close(error => error ? reject(error) : resolve());
    server.closeAllConnections();
  })));
});

async function fixture(options: AppOptions = {}) {
  let timestamp = Date.UTC(2026, 8, 16, 12);
  const upstream = vi.fn<typeof fetch>(async () => new Response(JSON.stringify({ token: 'fake-ephemeral-token' }), { status: 200 }));
  const { env: extraEnv, fetch: customFetch, ...rest } = options;
  const server = createApp({
    env: { NODE_ENV: 'test', ASSEMBLYAI_API_KEY: KEY, SPARRING_VOICE_ENABLED: 'true', ...extraEnv },
    fetch: customFetch ?? upstream, now: () => timestamp, ...rest,
  });
  servers.push(server);
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  async function request(path: string, body?: unknown, headers: Record<string, string> = {}) {
    const response = await fetch(base + path, {
      method: body === undefined ? 'GET' : 'POST',
      headers: { Origin: ORIGIN, 'Content-Type': 'application/json', ...headers },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    return { status: response.status, headers: response.headers, body: await response.json() };
  }
  async function start(): Promise<StartResponse> {
    const response = await request('/api/session/start', startBody);
    expect(response.status).toBe(200);
    return response.body as StartResponse;
  }
  return { base, request, start, upstream, advance: (ms: number) => { timestamp += ms; } };
}

function turn(text = 'Entiendo el impacto en su equipo.', id = 'u1', role: Turn['role'] = 'USER'): Turn {
  return { turn_id: id, role, text, received_at_ms: 1 };
}

function score(context: string, options: Partial<EvaluateRequest> = {}): EvaluateRequest {
  return {
    session_context: context, revision: 0, tool_call_id: 'call1', tool_name: 'score_rubric',
    arguments: { observations: [{ criterion_id: 'empathy', level: 3, quote: 'Entiendo el impacto', occurrence: 1, rationale: 'Reconoce el impacto concreto.' }] },
    transcript_final: [turn()], ...options,
  };
}

function observation(criterion_id: CriterionId, level: number, quote = 'Entiendo el impacto') {
  return { criterion_id, level, quote, occurrence: 1, rationale: 'Observación formativa del ancla.' };
}

describe('local HTTP contract and token boundary', () => {
  it('exposes a complete brief and health booleans without secrets or hidden scenario script', async () => {
    const app = await fixture();
    const health = await app.request('/api/health');
    expect(health.body).toEqual({ status: 'ok', key_configured: true, voice_enabled: true, mode: 'local' });
    expect(health.headers.get('cache-control')).toBe('no-store');
    expect(health.headers.get('cross-origin-resource-policy')).toBe('same-origin');
    const catalog = await app.request('/api/catalog');
    expect(catalog.body.scenarios).toHaveLength(3);
    expect(catalog.body.criteria.map((item: { weight: number }) => item.weight)).toEqual([20, 20, 25, 20, 15]);
    const scenario = catalog.body.scenarios[0];
    expect(Object.keys(scenario).sort()).toEqual(['authority', 'brief', 'facts', 'id', 'role', 'title', 'version']);
    expect(scenario.facts.pedido_id).toBe('ORD-94821');
    expect(scenario.authority.max_reembolso_directo).toBe(25);
    expect(JSON.stringify([health.body, catalog.body])).not.toContain(KEY);
    expect(app.upstream).not.toHaveBeenCalled();
  });

  it('mints only a capped ephemeral token and returns documented inline PCM configuration', async () => {
    const app = await fixture();
    const started = await app.start();
    expect(started.session_context).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(started.max_seconds).toBe(240);
    expect(started.deadline).toBe(Date.UTC(2026, 8, 16, 12) + 240000);
    expect(started.token).toBe('fake-ephemeral-token');
    const [target, init] = app.upstream.mock.calls[0];
    const url = new URL(String(target));
    expect(url.origin + url.pathname).toBe('https://agents.assemblyai.com/v1/token');
    expect(url.searchParams.get('expires_in_seconds')).toBe('60');
    expect(url.searchParams.get('max_session_duration_seconds')).toBe('240');
    expect(init?.method).toBe('GET');
    expect(init?.headers).toMatchObject({ Authorization: `Bearer ${KEY}` });
    expect(init?.redirect).toBe('error');
    expect(started.session_config).toMatchObject({
      input: { format: { encoding: 'audio/pcm' }, language_codes: ['es'] },
      output: { voice: 'lola', format: { encoding: 'audio/pcm' } },
    });
    expect(started.session_config.agent_id).toBeUndefined();
    expect((started.session_config.tools as unknown[]).length).toBe(2);
    expect(started.session_config.system_prompt).not.toContain('{{');
    expect(JSON.stringify(started)).not.toContain(KEY);
  });

  it('rejects production startup', () => {
    expect(() => createApp({ env: { NODE_ENV: 'production' } })).toThrow('no admite producción');
  });

  it.each([
    { SPARRING_VOICE_ENABLED: 'false', ASSEMBLYAI_API_KEY: KEY },
    { SPARRING_VOICE_ENABLED: 'true', ASSEMBLYAI_API_KEY: '' },
  ])('fails closed when voice is disabled or unconfigured: %j', async env => {
    const app = await fixture({ env });
    expect((await app.request('/api/health')).body.voice_enabled).toBe(false);
    expect((await app.request('/api/session/start', startBody)).body.error).toBe('voice_disabled');
    expect(app.upstream).not.toHaveBeenCalled();
  });

  it('rejects foreign and missing origins, and allows only named development origins', async () => {
    const app = await fixture();
    expect((await app.request('/api/session/start', startBody, { Origin: 'https://attacker.example' })).status).toBe(403);
    const missing = await fetch(app.base + '/api/session/start', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(startBody) });
    expect(missing.status).toBe(403);
    expect((await app.request('/api/health', undefined, { Origin: 'null' })).status).toBe(403);
    expect(app.upstream).not.toHaveBeenCalled();
    const preflight = await fetch(app.base + '/api/evaluate', { method: 'OPTIONS', headers: { Origin: 'http://localhost:5173' } });
    expect(preflight.status).toBe(204);
    expect(preflight.headers.get('access-control-allow-origin')).toBe('http://localhost:5173');
    expect((await app.request('/api/session/start', startBody, { Origin: 'http://localhost:5173' })).status).toBe(200);
  });

  it.each([
    { ...startBody, consent: false }, { ...startBody, consent: 'true' },
    { ...startBody, scenario_version: '0.0.0' }, { ...startBody, scenario_id: 'unknown' },
    { ...startBody, max_seconds: 10000 }, { scenario_id: 'late_delivery', consent: true },
  ])('validates consent, pinned scenario version and closed start fields: %j', async input => {
    const app = await fixture();
    expect((await app.request('/api/session/start', input)).status).toBe(422);
    expect(app.upstream).not.toHaveBeenCalled();
  });

  it('reserves the global slot before awaiting upstream under four concurrent starts', async () => {
    let complete!: (response: Response) => void;
    let entered!: () => void;
    const began = new Promise<void>(resolve => { entered = resolve; });
    const upstream = vi.fn<typeof fetch>(() => { entered(); return new Promise(resolve => { complete = resolve; }); });
    const app = await fixture({ fetch: upstream });
    const pending = app.request('/api/session/start', startBody);
    await began;
    const rejected = await Promise.all(Array.from({ length: 3 }, () => app.request('/api/session/start', startBody)));
    expect(rejected.map(result => result.status)).toEqual([429, 429, 429]);
    expect(upstream).toHaveBeenCalledTimes(1);
    complete(new Response(JSON.stringify({ token: 'concurrent-fake' })));
    expect((await pending).status).toBe(200);
  });

  it('keeps full reservations after idempotent end and enforces the 30 minute daily ceiling', async () => {
    const app = await fixture();
    for (let index = 0; index < 7; index++) {
      const session = await app.start();
      const body = { session_context: session.session_context };
      expect((await app.request('/api/session/end', body)).body).toEqual({ ended: true });
      expect((await app.request('/api/session/end', body)).body).toEqual({ ended: true });
    }
    const eighth = await app.request('/api/session/start', startBody);
    expect(eighth.status).toBe(429);
    expect(eighth.body.error).toBe('daily_limit');
    expect(app.upstream).toHaveBeenCalledTimes(7);
    app.advance(86400000);
    await app.start();
    expect(app.upstream).toHaveBeenCalledTimes(8);
  });

  it('ending an older session twice cannot release the newer active slot', async () => {
    const app = await fixture();
    const first = await app.start();
    await app.request('/api/session/end', { session_context: first.session_context });
    await app.start();
    await app.request('/api/session/end', { session_context: first.session_context });
    expect((await app.request('/api/session/start', startBody)).body.error).toBe('session_active');
  });

  it('expires contexts, prunes the active slot and preserves the reserved budget', async () => {
    const app = await fixture();
    const session = await app.start();
    app.advance(240000);
    expect((await app.request('/api/evaluate', score(session.session_context))).body.error).toBe('session_expired');
    expect((await app.request('/api/session/finish', { session_context: session.session_context })).status).toBe(401);
    await app.start();
    expect(app.upstream).toHaveBeenCalledTimes(2);
  });

  it.each(['status', 'throw', 'bad_json', 'missing_token', 'key_as_token'])('sanitizes upstream %s failures and keeps the cost reservation', async failure => {
    const upstream = vi.fn<typeof fetch>(async () => {
      if (failure === 'throw') throw new Error(KEY);
      if (failure === 'status') return new Response(KEY, { status: 401 });
      if (failure === 'bad_json') return new Response(KEY);
      return new Response(JSON.stringify(failure === 'key_as_token' ? { token: KEY } : { error: KEY }));
    });
    const app = await fixture({ fetch: upstream });
    for (let index = 0; index < 7; index++) {
      const response = await app.request('/api/session/start', startBody);
      expect(response.status).toBe(503);
      expect(response.body.error).toBe('voice_unavailable');
      expect(JSON.stringify(response.body)).not.toContain(KEY);
    }
    expect((await app.request('/api/session/start', startBody)).body.error).toBe('daily_limit');
    expect(upstream).toHaveBeenCalledTimes(7);
  });

  it('applies SPARRING_MAX_SESSION_SECONDS to token, deadline, response and reservation', async () => {
    const app = await fixture({ env: { SPARRING_MAX_SESSION_SECONDS: '90' } });
    const started = await app.start();
    expect(started.max_seconds).toBe(90);
    expect(started.deadline).toBe(Date.UTC(2026, 8, 16, 12) + 90_000);
    const url = new URL(String(app.upstream.mock.calls[0][0]));
    expect(url.searchParams.get('max_session_duration_seconds')).toBe('90');
    app.advance(90_000);
    expect((await app.request('/api/evaluate', score(started.session_context))).body.error).toBe('session_expired');
    await app.start();
    expect(app.upstream).toHaveBeenCalledTimes(2);
  });

  it('applies SPARRING_DAILY_MINUTES_CAP to the same reservation used for the session cap', async () => {
    const app = await fixture({ env: { SPARRING_MAX_SESSION_SECONDS: '60', SPARRING_DAILY_MINUTES_CAP: '1' } });
    const first = await app.start();
    expect((await app.request('/api/session/end', { session_context: first.session_context })).body).toEqual({ ended: true });
    const second = await app.request('/api/session/start', startBody);
    expect(second.status).toBe(429);
    expect(second.body.error).toBe('daily_limit');
    expect(app.upstream).toHaveBeenCalledTimes(1);
  });

  it.each([
    { SPARRING_MAX_SESSION_SECONDS: '10', SPARRING_DAILY_MINUTES_CAP: '0', max_seconds: 60 },
    { SPARRING_MAX_SESSION_SECONDS: '999', SPARRING_DAILY_MINUTES_CAP: '100', max_seconds: 240 },
    { SPARRING_MAX_SESSION_SECONDS: 'nope', SPARRING_DAILY_MINUTES_CAP: 'x', max_seconds: 240 },
  ])('clamps or defaults quota env to documented bounds: %j', async ({ max_seconds, ...env }) => {
    const app = await fixture({ env });
    expect((await app.start()).max_seconds).toBe(max_seconds);
  });

  it('times out even an injected fetch that ignores AbortSignal', async () => {
    let signal: AbortSignal | undefined;
    const upstream = vi.fn<typeof fetch>(async (_url, init) => {
      signal = init?.signal ?? undefined;
      return await new Promise<Response>(() => {});
    });
    const app = await fixture({ fetch: upstream, tokenTimeoutMs: 5 });
    const response = await app.request('/api/session/start', startBody);
    expect(response.status).toBe(503);
    expect(signal?.aborted).toBe(true);
  });

  it('rejects malformed JSON, wrong content type and bodies above 64 KiB', async () => {
    const app = await fixture();
    const malformed = await fetch(app.base + '/api/session/start', { method: 'POST', headers: { Origin: ORIGIN, 'Content-Type': 'application/json' }, body: '{' });
    expect(malformed.status).toBe(400);
    expect((await app.request('/api/session/start', startBody, { 'Content-Type': 'text/plain' })).status).toBe(415);
    expect((await app.request('/api/evaluate', { padding: 'x'.repeat(65536) })).status).toBe(413);
    expect(app.upstream).not.toHaveBeenCalled();
  });
});

describe('deterministic evaluation and atomic transcript validation over HTTP', () => {
  it('matches the committed 3/2/1/4/2 arithmetic fixture: 59 with complete coverage', async () => {
    const cases = JSON.parse(readFileSync(new URL('../../spec/evaluation-cases.json', import.meta.url), 'utf8'));
    const reference = cases.cases.find((item: { id: string }) => item.id === 'arithmetic_reference');
    const app = await fixture();
    const session = await app.start();
    const response = await app.request('/api/evaluate', score(session.session_context, {
      transcript_final: reference.transcript.map((item: Turn) => ({ ...item, received_at_ms: 1 })),
      arguments: { observations: reference.expected_observations.map((item: { criterion_id: CriterionId; level: number; quote: string }) => observation(item.criterion_id, item.level, item.quote)) },
    }));
    expect(response.status).toBe(200);
    expect(response.body.snapshot).toMatchObject({ revision: 1, coverage: 100, total: 59, provisional: true });
    expect(response.body.snapshot.criteria.map((item: { level: number }) => item.level)).toEqual([3, 2, 1, 4, 2]);
    expect(response.body.snapshot.criteria[0].evidence).toMatchObject({ user_turn_id: 't1', source_call_id: 'call1' });
  });

  it('distinguishes zero from unobserved and computes total at exactly 60% coverage', async () => {
    const app = await fixture();
    const { session_context } = await app.start();
    const first = await app.request('/api/evaluate', score(session_context, { arguments: { observations: [observation('empathy', 0)] } }));
    expect(first.body.snapshot).toMatchObject({ coverage: 20, total: null });
    expect(first.body.snapshot.criteria[0].level).toBe(0);
    expect(first.body.snapshot.criteria[1].level).toBeNull();
    const second = await app.request('/api/evaluate', score(session_context, {
      revision: 1, tool_call_id: 'call2', arguments: { observations: [observation('discovery', 0), observation('solution_integrity', 0)] },
    }));
    expect(second.body.snapshot).toMatchObject({ revision: 2, coverage: 60, total: 0 });
    const third = await app.request('/api/evaluate', score(session_context, {
      revision: 2, tool_call_id: 'call3', arguments: { observations: [observation('empathy', 4)] },
    }));
    expect(third.body.snapshot).toMatchObject({ coverage: 60, total: 33 });
    expect(third.body.snapshot.criteria[0].evidence.source_call_id).toBe('call3');
  });

  it.each([
    { observations: [observation('empathy', 4)], total: 100 },
    { observations: [{ ...observation('empathy', 4), weight: 100 }] },
    { observations: [observation('empathy', 4), observation('empathy', 2)] },
    { observations: [observation('empathy', 4.5)] },
    { observations: [observation('empathy', 5)] },
    { observations: [observation('empathy', -1)] },
    { observations: [observation('unknown' as CriterionId, 3)] },
    { observations: [{ ...observation('empathy', 3), occurrence: 0 }] },
    { observations: [{ ...observation('empathy', 3), rationale: 'x'.repeat(241) }] },
    { observations: [{ ...observation('empathy', 3), quote: 'x'.repeat(501) }] },
    { observations: [] },
    { observations: Array.from({ length: 6 }, () => observation('empathy', 3)) },
  ])('rejects invalid tools atomically: %j', async args => {
    const app = await fixture();
    const { session_context } = await app.start();
    expect((await app.request('/api/evaluate', score(session_context, { arguments: args }))).status).toBe(422);
    const finish = await app.request('/api/session/finish', { session_context });
    expect(finish.body.snapshot).toMatchObject({ revision: 0, coverage: 0, total: null });
  });

  it.each(['entiendo el impacto', 'Entiendo  el impacto', 'Una cita inventada'])('requires exact case and spacing for evidence: %s', async quote => {
    const app = await fixture();
    const { session_context } = await app.start();
    const response = await app.request('/api/evaluate', score(session_context, { arguments: { observations: [observation('empathy', 3, quote)] } }));
    expect(response.status).toBe(422);
    expect(response.body.error).toBe('evidence_not_found');
  });

  it('resolves one-based occurrence across USER turns, excluding AGENT and repeated substrings', async () => {
    const app = await fixture();
    const { session_context } = await app.start();
    const transcript = [turn('Igual Igual', 'a1', 'AGENT'), turn('Igual Igual', 'u1'), turn('Igual', 'u2')];
    const args = { observations: [{ ...observation('empathy', 3, 'Igual'), occurrence: 2 }] };
    const accepted = await app.request('/api/evaluate', score(session_context, { transcript_final: transcript, arguments: args }));
    expect(accepted.body.snapshot.criteria[0].evidence.user_turn_id).toBe('u2');
    const rejected = await app.request('/api/evaluate', score(session_context, {
      revision: 1, tool_call_id: 'call2', transcript_final: transcript,
      arguments: { observations: [{ ...observation('empathy', 3, 'Igual'), occurrence: 3 }] },
    }));
    expect(rejected.status).toBe(422);
  });

  it('rejects AGENT evidence for score and validates AGENT objections against this scenario', async () => {
    const app = await fixture();
    const { session_context } = await app.start();
    const transcript = [turn('Entiendo el impacto', 'a1', 'AGENT'), turn('Texto del usuario', 'u1')];
    expect((await app.request('/api/evaluate', score(session_context, { transcript_final: transcript }))).status).toBe(422);
    const objection = score(session_context, {
      tool_name: 'log_objection', transcript_final: transcript,
      arguments: { objection_id: 'obj_price_1', quote: 'Entiendo el impacto', occurrence: 1 },
    });
    expect((await app.request('/api/evaluate', objection)).status).toBe(422);
    objection.arguments = { objection_id: 'obj_late_1', quote: 'Texto del usuario', occurrence: 1 };
    expect((await app.request('/api/evaluate', objection)).status).toBe(422);
    objection.arguments = { objection_id: 'obj_late_1', quote: 'Entiendo el impacto', occurrence: 1 };
    const accepted = await app.request('/api/evaluate', objection);
    expect(accepted.status).toBe(200);
    expect(accepted.body.result).toMatchObject({ accepted: true, objection_id: 'obj_late_1', agent_turn_id: 'a1' });
    expect(accepted.body.snapshot).toMatchObject({ revision: 1, coverage: 0, total: null });
  });

  it('returns the complete cached response for identical retries, including after newer calls and finish', async () => {
    const app = await fixture();
    const { session_context } = await app.start();
    const request = score(session_context);
    const first = await app.request('/api/evaluate', request);
    app.advance(10);
    const reordered = { ...request, arguments: { observations: [{ rationale: 'Reconoce el impacto concreto.', occurrence: 1, quote: 'Entiendo el impacto', level: 3, criterion_id: 'empathy' }] } };
    expect((await app.request('/api/evaluate', reordered)).body).toEqual(first.body);
    expect((await app.request('/api/evaluate', score(session_context, { revision: 1, tool_call_id: 'call2' }))).body.snapshot.revision).toBe(2);
    expect((await app.request('/api/evaluate', request)).body).toEqual(first.body);
    expect((await app.request('/api/session/finish', { session_context })).body.snapshot.revision).toBe(2);
    expect((await app.request('/api/evaluate', request)).body).toEqual(first.body);
  });

  it('conflicts on a reused call ID if arguments, transcript, revision or tool changes', async () => {
    const app = await fixture();
    const { session_context } = await app.start();
    const request = score(session_context);
    await app.request('/api/evaluate', request);
    const changes: Partial<EvaluateRequest>[] = [
      { revision: 1 }, { arguments: { observations: [observation('empathy', 4)] } },
      { transcript_final: [turn(), turn('Más texto', 'u2')] }, { tool_name: 'log_objection' },
    ];
    for (const change of changes) {
      const conflict = await app.request('/api/evaluate', { ...request, ...change });
      expect(conflict.status).toBe(409);
      expect(conflict.body.error).toBe('call_conflict');
    }
    expect((await app.request('/api/session/finish', { session_context })).body.snapshot.revision).toBe(1);
  });

  it('requires current expected revision and accepts each valid new call once', async () => {
    const app = await fixture();
    const { session_context } = await app.start();
    expect((await app.request('/api/evaluate', score(session_context, { revision: 1 }))).body.error).toBe('revision_conflict');
    expect((await app.request('/api/evaluate', score(session_context))).body.snapshot.revision).toBe(1);
    expect((await app.request('/api/evaluate', score(session_context, { tool_call_id: 'call2' }))).body.error).toBe('revision_conflict');
    expect((await app.request('/api/evaluate', score(session_context, { tool_call_id: 'call2', revision: 1 }))).body.snapshot.revision).toBe(2);
  });

  it('enforces immutable append-only transcripts including roles, order, metadata and text', async () => {
    const app = await fixture();
    const { session_context } = await app.start();
    const original = [turn(), turn('Segundo turno', 'u2')];
    await app.request('/api/evaluate', score(session_context, { transcript_final: original }));
    const mutations = [
      [], [turn()], [...original].reverse(),
      [{ ...turn(), text: 'Modificado' }, original[1]],
      [{ ...turn(), role: 'AGENT' }, original[1]],
      [{ ...turn(), received_at_ms: 2 }, original[1]],
      [{ ...turn(), interrupted: true }, original[1]],
    ];
    for (const transcript_final of mutations) {
      const response = await app.request('/api/evaluate', { ...score(session_context), revision: 1, tool_call_id: 'call2', transcript_final });
      expect(response.status).toBe(409);
      expect(response.body.error).toBe('transcript_conflict');
    }
    const accepted = await app.request('/api/evaluate', score(session_context, {
      revision: 1, tool_call_id: 'call2', transcript_final: [...original, turn('Tercer turno', 'u3')],
    }));
    expect(accepted.body.snapshot.revision).toBe(2);
  });

  it('does not append turns or commit earlier observations when a later observation fails', async () => {
    const app = await fixture();
    const { session_context } = await app.start();
    const invalid = score(session_context, { arguments: { observations: [observation('empathy', 4), observation('closing', 3, 'No existe')] } });
    expect((await app.request('/api/evaluate', invalid)).status).toBe(422);
    const text = 'Nueva transcripción permitida porque nada se confirmó.';
    const accepted = await app.request('/api/evaluate', score(session_context, {
      transcript_final: [turn(text)], arguments: { observations: [observation('closing', 2, text)] },
    }));
    expect(accepted.body.snapshot).toMatchObject({ revision: 1, coverage: 15, total: null });
    expect(accepted.body.snapshot.criteria[0].level).toBeNull();
  });

  it.each([
    [turn(), turn('Otro', 'u1')],
    [turn('x'.repeat(1001))],
    Array.from({ length: 201 }, (_, index) => turn('x', `u${index}`)),
    [{ ...turn(), role: 'SYSTEM' }],
    [{ ...turn(), received_at_ms: -1 }],
    [{ ...turn(), unknown: true }],
  ])('rejects invalid final transcript bounds and identities: %#', async (...turns) => {
    // Vitest expands each array case into arguments.
    const app = await fixture();
    const { session_context } = await app.start();
    const response = await app.request('/api/evaluate', { ...score(session_context), transcript_final: turns });
    expect(response.status).toBe(422);
  });

  it('freezes a validated snapshot and idempotent coach prompt, without a new voice token', async () => {
    const app = await fixture();
    const { session_context } = await app.start();
    await app.request('/api/evaluate', score(session_context));
    const finished = await app.request('/api/session/finish', { session_context });
    expect(finished.body.snapshot).toMatchObject({ revision: 1, coverage: 20, total: null, provisional: false });
    expect(finished.body.coach_prompt).toContain(JSON.stringify(finished.body.snapshot));
    expect(finished.body.coach_prompt).toContain('No recalifiques');
    expect(finished.body.coach_prompt).not.toContain('{{');
    expect(finished.body.coach_prompt).not.toContain(KEY);
    expect((await app.request('/api/session/finish', { session_context })).body).toEqual(finished.body);
    const rejected = await app.request('/api/evaluate', score(session_context, { revision: 1, tool_call_id: 'call2' }));
    expect(rejected.body.error).toBe('session_frozen');
    expect((await app.request('/api/session/start', startBody)).body.error).toBe('session_active');
    expect(app.upstream).toHaveBeenCalledTimes(1);
  });

  it('finishes zero turns honestly with null score and rejects unknown contexts', async () => {
    const app = await fixture();
    const { session_context } = await app.start();
    expect((await app.request('/api/session/finish', { session_context })).body.snapshot).toMatchObject({ revision: 0, coverage: 0, total: null, provisional: false });
    expect((await app.request('/api/evaluate', score('unknown-context'))).status).toBe(401);
    expect((await app.request('/api/session/finish', { session_context, score: 100 })).status).toBe(422);
  });
});

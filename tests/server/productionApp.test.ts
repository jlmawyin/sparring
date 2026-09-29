import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createProductionApp, type ProductionAppOptions } from '../../server/productionApp.ts';
import type { StartResponse } from '../../src/shared/types.ts';

const KEY = 'test-secret-only-never-a-real-key';
const servers: Server[] = [];
const dirs: string[] = [];
const startBody = { scenario_id: 'late_delivery', scenario_version: '1.0.0', consent: true };

afterEach(async () => {
  await Promise.all(servers.splice(0).map(server => new Promise<void>((resolve, reject) => {
    server.close(error => error ? reject(error) : resolve());
    server.closeAllConnections();
  })));
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

function tempDir(prefix: string): string {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  dirs.push(dir);
  return dir;
}

function makeStaticDir(): string {
  const dir = tempDir('sparring-static-');
  mkdirSync(join(dir, 'assets'), { recursive: true });
  writeFileSync(join(dir, 'index.html'), '<!doctype html><html><body>Sparring shell</body></html>');
  writeFileSync(join(dir, 'assets', 'app.js'), 'console.log("app");');
  writeFileSync(join(dir, 'pcm-capture.js'), '// worklet');
  return dir;
}

function makeQuotaFile(): string {
  return join(tempDir('sparring-quota-'), 'quota.json');
}

async function fixture(options: Partial<ProductionAppOptions & { env: NodeJS.ProcessEnv }> = {}) {
  let timestamp = Date.UTC(2026, 8, 16, 12);
  const upstream = vi.fn<typeof fetch>(async () => new Response(JSON.stringify({ token: 'fake-ephemeral-token' }), { status: 200 }));
  const { env: extraEnv, fetch: customFetch, staticDir, quotaFile, ...rest } = options;
  const server = createProductionApp({
    env: { ASSEMBLYAI_API_KEY: KEY, SPARRING_VOICE_ENABLED: 'true', ...extraEnv },
    fetch: customFetch ?? upstream,
    now: () => timestamp,
    staticDir: staticDir ?? makeStaticDir(),
    quotaFile: quotaFile ?? makeQuotaFile(),
    ...rest,
  });
  servers.push(server);
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  async function raw(path: string, init: RequestInit = {}) {
    return fetch(base + path, init);
  }
  async function request(path: string, body?: unknown, headers: Record<string, string> = {}) {
    const response = await fetch(base + path, {
      method: body === undefined ? 'GET' : 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    const text = await response.text();
    let json: unknown;
    try { json = JSON.parse(text); } catch { json = undefined; }
    return { status: response.status, headers: response.headers, body: json as any, text };
  }
  async function start(): Promise<StartResponse> {
    const response = await request('/api/session/start', startBody);
    expect(response.status).toBe(200);
    return response.body as StartResponse;
  }
  return { base, raw, request, start, upstream, advance: (ms: number) => { timestamp += ms; } };
}

describe('production adapter: single-origin static + API serving', () => {
  it('rejects a quota file placed under the public static directory', () => {
    const staticDir = makeStaticDir();
    expect(() => createProductionApp({ staticDir, quotaFile: join(staticDir, 'quota.json') }))
      .toThrow('fuera del directorio público');
  });

  it('serves the built shell, hashed assets with immutable caching, and plain root files', async () => {
    const app = await fixture();
    const index = await app.raw('/');
    expect(index.status).toBe(200);
    expect(index.headers.get('content-type')).toContain('text/html');
    expect(await index.text()).toContain('Sparring shell');
    const asset = await app.raw('/assets/app.js');
    expect(asset.status).toBe(200);
    expect(asset.headers.get('content-type')).toContain('text/javascript');
    expect(asset.headers.get('cache-control')).toBe('public, max-age=31536000, immutable');
    const worklet = await app.raw('/pcm-capture.js');
    expect(worklet.status).toBe(200);
    expect(worklet.headers.get('cache-control')).toBe('no-cache');
  });

  it('404s unknown paths and blocks path traversal outside the static root', async () => {
    const app = await fixture();
    expect((await app.raw('/nope.txt')).status).toBe(404);
    expect((await app.raw('/%2e%2e/%2e%2e/package.json')).status).toBe(404);
    expect((await app.raw('/assets/../../../package.json')).status).toBe(404);
  });

  it('serves static files and /api from the same origin and port', async () => {
    const app = await fixture();
    const health = await app.request('/api/health');
    expect(health.body).toEqual({ status: 'ok', key_configured: true, voice_enabled: true, mode: 'production' });
    const index = await app.raw('/');
    expect(new URL(index.url).origin).toBe(app.base);
  });

  it('never leaks the key through health, catalog, static or error responses', async () => {
    const app = await fixture();
    const health = await app.request('/api/health');
    const catalog = await app.request('/api/catalog');
    const started = await app.start();
    expect(JSON.stringify([health.body, catalog.body, started])).not.toContain(KEY);
    const missing = await app.raw('/definitely-not-here');
    expect(await missing.text()).not.toContain(KEY);
  });
});

describe('production adapter: session start behavior with a mocked provider', () => {
  it('mints only a capped ephemeral token and returns the documented contract', async () => {
    const app = await fixture();
    const started = await app.start();
    expect(started.session_context).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(started.max_seconds).toBe(240);
    expect(started.token).toBe('fake-ephemeral-token');
    const [, init] = app.upstream.mock.calls[0];
    expect(init?.headers).toMatchObject({ Authorization: `Bearer ${KEY}` });
    expect(app.upstream).toHaveBeenCalledTimes(1);
  });

  it('fails closed when voice is disabled or unconfigured, without minting a token', async () => {
    const disabled = await fixture({ env: { SPARRING_VOICE_ENABLED: 'false' } });
    expect((await disabled.request('/api/session/start', startBody)).body.error).toBe('voice_disabled');
    expect(disabled.upstream).not.toHaveBeenCalled();
    const unconfigured = await fixture({ env: { ASSEMBLYAI_API_KEY: '' } });
    expect((await unconfigured.request('/api/session/start', startBody)).body.error).toBe('voice_disabled');
    expect(unconfigured.upstream).not.toHaveBeenCalled();
  });

  it('never mints a token without explicit consent', async () => {
    const app = await fixture();
    expect((await app.request('/api/session/start', { ...startBody, consent: false })).status).toBe(422);
    expect((await app.request('/api/session/start', { ...startBody, consent: 'true' })).status).toBe(422);
    expect(app.upstream).not.toHaveBeenCalled();
  });

  it('sanitizes upstream failures and keeps the reservation charged', async () => {
    const upstream = vi.fn<typeof fetch>(async () => new Response('server said: ' + KEY, { status: 500 }));
    const app = await fixture({ fetch: upstream });
    const response = await app.request('/api/session/start', startBody);
    expect(response.status).toBe(503);
    expect(response.body.error).toBe('voice_unavailable');
    expect(response.text).not.toContain(KEY);
  });

  it('runs the evaluate and finish contract end to end through the production adapter', async () => {
    const app = await fixture();
    const { session_context } = await app.start();
    const evaluated = await app.request('/api/evaluate', {
      session_context, revision: 0, tool_call_id: 'call1', tool_name: 'score_rubric',
      arguments: { observations: [{ criterion_id: 'empathy', level: 3, quote: 'Entiendo el impacto', occurrence: 1, rationale: 'Reconoce el impacto concreto.' }] },
      transcript_final: [{ turn_id: 'u1', role: 'USER', text: 'Entiendo el impacto en su equipo.', received_at_ms: 1 }],
    });
    expect(evaluated.status).toBe(200);
    const finished = await app.request('/api/session/finish', { session_context });
    expect(finished.body.snapshot).toMatchObject({ revision: 1, provisional: false });
    const ended = await app.request('/api/session/end', { session_context });
    expect(ended.body).toEqual({ ended: true });
  });
});

describe('production adapter: durable quota persistence and concurrency', () => {
  it('survives a process restart: a new instance over the same quota file honors prior usage', async () => {
    const staticDir = makeStaticDir();
    const quotaFile = makeQuotaFile();
    const before = await fixture({ staticDir, quotaFile, env: { SPARRING_MAX_SESSION_SECONDS: '60', SPARRING_DAILY_MINUTES_CAP: '1' } });
    const first = await before.start();
    expect((await before.request('/api/session/end', { session_context: first.session_context })).body).toEqual({ ended: true });
    // "Restart": a brand-new server instance, sharing only the on-disk quota file.
    const after = await fixture({ staticDir, quotaFile, env: { SPARRING_MAX_SESSION_SECONDS: '60', SPARRING_DAILY_MINUTES_CAP: '1' } });
    const second = await after.request('/api/session/start', startBody);
    expect(second.status).toBe(429);
    expect(second.body.error).toBe('daily_limit');
    expect(after.upstream).not.toHaveBeenCalled();
  });

  it('races concurrent starts against the same quota file and grants exactly one session', async () => {
    const quotaFile = makeQuotaFile();
    const apps = await Promise.all(Array.from({ length: 4 }, () => fixture({ quotaFile })));
    const results = await Promise.all(apps.map(app => app.request('/api/session/start', startBody)));
    expect(results.filter(r => r.status === 200)).toHaveLength(1);
    expect(results.filter(r => r.status === 429 && r.body.error === 'session_active')).toHaveLength(3);
  });

  it('fails closed and denies the reservation when the quota ledger file is corrupt', async () => {
    const quotaFile = makeQuotaFile();
    writeFileSync(quotaFile, '{not valid json');
    const app = await fixture({ quotaFile });
    const response = await app.request('/api/session/start', startBody);
    expect(response.status).toBe(503);
    expect(response.body.error).toBe('quota_unavailable');
    expect(app.upstream).not.toHaveBeenCalled();
  });

  it('keeps full reservations after idempotent end and enforces the daily ceiling', async () => {
    const quotaFile = makeQuotaFile();
    const app = await fixture({ quotaFile, env: { SPARRING_MAX_SESSION_SECONDS: '60', SPARRING_DAILY_MINUTES_CAP: '2' } });
    for (let i = 0; i < 2; i++) {
      const session = await app.start();
      const body = { session_context: session.session_context };
      expect((await app.request('/api/session/end', body)).body).toEqual({ ended: true });
      expect((await app.request('/api/session/end', body)).body).toEqual({ ended: true });
    }
    const third = await app.request('/api/session/start', startBody);
    expect(third.status).toBe(429);
    expect(third.body.error).toBe('daily_limit');
    app.advance(86_400_000);
    await app.start();
  });

  it('clamps SPARRING_MAX_SESSION_SECONDS and SPARRING_DAILY_MINUTES_CAP to documented bounds', async () => {
    const app = await fixture({ env: { SPARRING_MAX_SESSION_SECONDS: '999', SPARRING_DAILY_MINUTES_CAP: '100' } });
    expect((await app.start()).max_seconds).toBe(240);
  });
});

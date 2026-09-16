import { randomBytes, randomUUID } from 'node:crypto';
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import type { Health, ScoreSnapshot, StartResponse } from '../src/shared/types.ts';
import { catalog, coachPrompt, scenarios, sessionConfig } from './catalog.ts';
import { ApiError, boundedString, closedObject, invalid, isRecord } from './errors.ts';
import { evaluate, newEvaluation, snapshot, validateEvaluateEnvelope, type EvaluationState } from './evaluator.ts';

const MAX_BODY_BYTES = 64 * 1024;
const DEFAULT_SESSION_SECONDS = 240;
const DEFAULT_DAILY_MINUTES = 30;
const TOKEN_TIMEOUT_MS = 8000;
const ALLOWED_ORIGINS = new Set(['http://127.0.0.1:5173', 'http://localhost:5173']);

/** Missing/invalid values fall back; out-of-range integers are clamped. */
function boundedEnvInt(raw: string | undefined, min: number, max: number, fallback: number): number {
  const trimmed = raw?.trim() ?? '';
  if (!trimmed) return fallback;
  const n = Number(trimmed);
  if (!Number.isSafeInteger(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

interface Session {
  id: string;
  deadline: number;
  scenario: typeof scenarios[number];
  evaluation: EvaluationState;
  ended: boolean;
  finish?: { snapshot: ScoreSnapshot; coach_prompt: string };
}

export interface AppOptions {
  /** Tests inject their entire environment; the app never reads .env files. */
  env?: NodeJS.ProcessEnv;
  fetch?: typeof globalThis.fetch;
  now?: () => number;
  /** Shorten a timeout only for deterministic failure tests. */
  tokenTimeoutMs?: number;
}

async function readBody(request: IncomingMessage): Promise<unknown> {
  if (!/^application\/json(?:\s*;|$)/i.test(request.headers['content-type'] ?? '')) {
    throw new ApiError(415, 'unsupported_media_type', 'Envía la solicitud en formato JSON.');
  }
  const declaredSize = request.headers['content-length'];
  if (declaredSize && Number(declaredSize) > MAX_BODY_BYTES) {
    request.resume();
    throw new ApiError(413, 'body_too_large', 'La solicitud supera el tamaño permitido.');
  }
  return await new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    let failed = false;
    request.on('data', (chunk: Buffer) => {
      if (failed) return;
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        failed = true;
        chunks.length = 0;
        reject(new ApiError(413, 'body_too_large', 'La solicitud supera el tamaño permitido.'));
      } else chunks.push(chunk);
    });
    request.on('end', () => {
      if (failed) return;
      try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown); }
      catch { reject(new ApiError(400, 'invalid_json', 'No se pudo leer la solicitud JSON.')); }
    });
    request.on('error', () => reject(new ApiError(400, 'invalid_body', 'No se pudo leer la solicitud.')));
    request.on('aborted', () => reject(new ApiError(400, 'invalid_body', 'La solicitud se interrumpió.')));
  });
}

function respond(response: ServerResponse, status: number, body: unknown): void {
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  response.end(JSON.stringify(body));
}

/**
 * LOCAL ADAPTER ONLY. All quotas, contexts and transcripts live in this one process.
 * Restarting loses them. This is not a distributed counter, signed credential or
 * production service. index.ts binds loopback; production startup is rejected here.
 */
export function createApp(options: AppOptions = {}): Server {
  const env = options.env ?? process.env;
  if (env.NODE_ENV === 'production') throw new Error('El adaptador local no admite producción.');
  const upstream = options.fetch ?? globalThis.fetch;
  const now = options.now ?? Date.now;
  const key = env.ASSEMBLYAI_API_KEY?.trim() ?? '';
  const enabled = env.SPARRING_VOICE_ENABLED === 'true';
  const sessionSeconds = boundedEnvInt(env.SPARRING_MAX_SESSION_SECONDS, 60, 240, DEFAULT_SESSION_SECONDS);
  const dailySeconds = boundedEnvInt(env.SPARRING_DAILY_MINUTES_CAP, 1, 30, DEFAULT_DAILY_MINUTES) * 60;
  const sessions = new Map<string, Session>();
  let active: string | null = null;
  let quotaDay = new Date(now()).toISOString().slice(0, 10);
  let reservedSeconds = 0;

  function cleanup(): void {
    const timestamp = now();
    for (const [context, session] of sessions) {
      if (timestamp >= session.deadline) {
        sessions.delete(context);
        if (active === context) active = null;
      }
    }
    const day = new Date(timestamp).toISOString().slice(0, 10);
    if (day !== quotaDay) { quotaDay = day; reservedSeconds = 0; }
  }

  function sessionFor(context: unknown): Session {
    if (!boundedString(context, 128)) invalid();
    const session = sessions.get(context);
    if (!session || now() >= session.deadline) {
      throw new ApiError(401, 'session_expired', 'La sesión venció o no es válida. Inicia una nueva práctica.');
    }
    return session;
  }

  async function token(): Promise<string> {
    const controller = new AbortController();
    let timeout: ReturnType<typeof setTimeout> | undefined;
    const deadline = new Promise<never>((_, reject) => {
      timeout = setTimeout(() => { controller.abort(); reject(new Error('upstream_timeout')); },
        Math.min(TOKEN_TIMEOUT_MS, Math.max(1, options.tokenTimeoutMs ?? TOKEN_TIMEOUT_MS)));
    });
    const operation = async () => {
      const url = new URL('https://agents.assemblyai.com/v1/token');
      url.searchParams.set('expires_in_seconds', '60');
      url.searchParams.set('max_session_duration_seconds', String(sessionSeconds));
      const response = await upstream(url, {
        method: 'GET', headers: { Authorization: `Bearer ${key}`, Accept: 'application/json' },
        signal: controller.signal, redirect: 'error',
      });
      if (!response.ok) throw new Error('upstream_rejected');
      const payload: unknown = await response.json();
      if (!isRecord(payload) || !boundedString(payload.token, 8192) || payload.token === key) throw new Error('upstream_invalid');
      return payload.token;
    };
    try { return await Promise.race([operation(), deadline]); }
    catch { throw new ApiError(503, 'voice_unavailable', 'No se pudo preparar la voz. Intenta de nuevo más tarde.'); }
    finally { if (timeout) clearTimeout(timeout); }
  }

  return createServer(async (request, response) => {
    response.setHeader('Cache-Control', 'no-store');
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
    response.setHeader('Referrer-Policy', 'no-referrer');
    response.setHeader('Vary', 'Origin');
    try {
      cleanup();
      const origin = request.headers.origin;
      if (origin && !ALLOWED_ORIGINS.has(origin)) throw new ApiError(403, 'origin_forbidden', 'El origen de la solicitud no está permitido.');
      if (origin) response.setHeader('Access-Control-Allow-Origin', origin);
      const path = new URL(request.url ?? '/', 'http://127.0.0.1').pathname;
      if (request.method === 'OPTIONS') {
        if (!origin) throw new ApiError(403, 'origin_forbidden', 'El origen de la solicitud no está permitido.');
        response.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        response.setHeader('Access-Control-Allow-Headers', 'Content-Type');
        response.writeHead(204); response.end(); return;
      }
      if (request.method === 'GET' && path === '/api/health') {
        const health: Health = { status: 'ok', key_configured: Boolean(key), voice_enabled: enabled && Boolean(key), mode: 'local' };
        respond(response, 200, health); return;
      }
      if (request.method === 'GET' && path === '/api/catalog') { respond(response, 200, catalog); return; }
      if (request.method !== 'POST') throw new ApiError(404, 'not_found', 'La operación solicitada no existe.');
      if (!origin) throw new ApiError(403, 'origin_forbidden', 'El origen de la solicitud no está permitido.');
      if (!['/api/session/start', '/api/evaluate', '/api/session/finish', '/api/session/end'].includes(path)) {
        throw new ApiError(404, 'not_found', 'La operación solicitada no existe.');
      }
      const body = await readBody(request);
      if (path === '/api/session/start') {
        closedObject(body, ['scenario_id', 'scenario_version', 'consent']);
        if (!boundedString(body.scenario_id, 80) || !boundedString(body.scenario_version, 40) || body.consent !== true) invalid();
        const scenario = scenarios.find(item => item.id === body.scenario_id && item.version === body.scenario_version);
        if (!scenario) invalid();
        if (!enabled || !key) throw new ApiError(503, 'voice_disabled', 'La voz aún no está habilitada en este servidor local.');
        // No await between checking and reserving: simultaneous starts cannot race the quota.
        cleanup();
        if (active) throw new ApiError(429, 'session_active', 'Ya hay una práctica activa en este servidor local.');
        if (reservedSeconds + sessionSeconds > dailySeconds) throw new ApiError(429, 'daily_limit', 'Se alcanzó el límite diario de voz de este servidor local.');
        reservedSeconds += sessionSeconds;
        const context = randomBytes(32).toString('base64url');
        const session: Session = { id: randomUUID(), deadline: now() + sessionSeconds * 1000, scenario, evaluation: newEvaluation(), ended: false };
        sessions.set(context, session);
        active = context;
        try {
          const ephemeral = await token();
          if (now() >= session.deadline || request.aborted || response.destroyed) throw new Error('start_abandoned');
          const result: StartResponse = {
            session_id: session.id, session_context: context, token: ephemeral,
            max_seconds: sessionSeconds, deadline: session.deadline, session_config: sessionConfig(scenario),
          };
          respond(response, 200, result);
        } catch (error) {
          sessions.delete(context);
          if (active === context) active = null;
          // Full reservation remains even on ambiguous upstream failure or abandoned response.
          if (error instanceof ApiError) throw error;
          throw new ApiError(503, 'voice_unavailable', 'No se pudo preparar la voz. Intenta de nuevo más tarde.');
        }
        return;
      }
      if (path === '/api/evaluate') {
        validateEvaluateEnvelope(body);
        const session = sessionFor(body.session_context);
        const result = evaluate(session.evaluation, body, session.scenario.objeciones.map(item => item.id), now);
        respond(response, 200, result); return;
      }
      closedObject(body, ['session_context']);
      const session = sessionFor(body.session_context);
      if (path === '/api/session/finish') {
        if (!session.finish) {
          session.evaluation.frozen = true;
          const score = snapshot(session.evaluation);
          session.finish = { snapshot: score, coach_prompt: coachPrompt(score, session.scenario) };
        }
        respond(response, 200, session.finish); return;
      }
      session.ended = true;
      session.evaluation.frozen = true;
      if (active === body.session_context) active = null;
      respond(response, 200, { ended: true });
    } catch (error) {
      const known = error instanceof ApiError ? error : new ApiError(500, 'internal_error', 'No se pudo completar la operación.');
      if (!response.headersSent && !response.destroyed) respond(response, known.status, { error: known.code, message: known.message });
    }
  });
}

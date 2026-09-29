import { randomBytes, randomUUID } from 'node:crypto';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import { dirname, extname, join, normalize, resolve as resolvePath, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Health, ScoreSnapshot, StartResponse } from '../src/shared/types.ts';
import { catalog, coachPrompt, scenarios, sessionConfig } from './catalog.ts';
import { ApiError, boundedString, closedObject, invalid } from './errors.ts';
import { evaluate, newEvaluation, snapshot, validateEvaluateEnvelope, type EvaluationState } from './evaluator.ts';
import { boundedEnvInt } from './env.ts';
import { readBody, respond } from './http.ts';
import { mintToken } from './token.ts';
import { createQuotaLedger, type QuotaLedger, type ReserveResult } from './quota.ts';

const DEFAULT_SESSION_SECONDS = 240;
const DEFAULT_DAILY_MINUTES = 30;
const TOKEN_TIMEOUT_MS = 8000;

const moduleDir = dirname(fileURLToPath(import.meta.url));
// Sibling layout: <repo-root>/server-dist/production.mjs next to <repo-root>/dist and <repo-root>/var.
const DEFAULT_STATIC_DIR = resolvePath(moduleDir, '..', 'dist');
const DEFAULT_QUOTA_FILE = resolvePath(moduleDir, '..', 'var', 'quota.json');

const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.webmanifest': 'application/manifest+json',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
};

interface Session {
  id: string;
  deadline: number;
  scenario: typeof scenarios[number];
  evaluation: EvaluationState;
  ended: boolean;
  finish?: { snapshot: ScoreSnapshot; coach_prompt: string };
}

export interface ProductionAppOptions {
  /** Reads real process env by default; the app never reads .env files itself. */
  env?: NodeJS.ProcessEnv;
  fetch?: typeof globalThis.fetch;
  now?: () => number;
  /** Shorten a timeout only for deterministic failure tests. */
  tokenTimeoutMs?: number;
  /** Directory containing the built frontend (vite build output). Defaults to ../dist next to this module. */
  staticDir?: string;
  /** Path to the durable quota ledger file. Defaults to ../var/quota.json next to this module. */
  quotaFile?: string;
  /** Injectable for tests; a crashed holder's lock is broken after this many ms. */
  quotaStaleLockMs?: number;
}

function resolveStaticFile(staticDir: string, pathname: string): string | null {
  let decoded: string;
  try { decoded = decodeURIComponent(pathname); } catch { return null; }
  const target = normalize(join(staticDir, decoded));
  if (target !== staticDir && !target.startsWith(staticDir + sep)) return null;
  return target;
}

function serveStatic(response: import('node:http').ServerResponse, filePath: string, cacheControl: string): void {
  const type = MIME_TYPES[extname(filePath).toLowerCase()] ?? 'application/octet-stream';
  response.writeHead(200, { 'Content-Type': type, 'Content-Length': statSync(filePath).size, 'Cache-Control': cacheControl });
  createReadStream(filePath).pipe(response);
}

/**
 * PRODUCTION ADAPTER. Serves the built static frontend and /api from one origin, for
 * cPanel/Passenger or an equivalent Node host. Session transcripts and evaluation state
 * live in this process only; the global voice quota is durable via a file-backed atomic
 * ledger (see quota.ts) so it survives restarts and races concurrent reservations safely.
 */
export function createProductionApp(options: ProductionAppOptions = {}): Server {
  const env = options.env ?? process.env;
  const upstream = options.fetch ?? globalThis.fetch;
  const now = options.now ?? Date.now;
  const key = env.ASSEMBLYAI_API_KEY?.trim() ?? '';
  const enabled = env.SPARRING_VOICE_ENABLED === 'true';
  const sessionSeconds = boundedEnvInt(env.SPARRING_MAX_SESSION_SECONDS, 60, 240, DEFAULT_SESSION_SECONDS);
  const dailySeconds = boundedEnvInt(env.SPARRING_DAILY_MINUTES_CAP, 1, 30, DEFAULT_DAILY_MINUTES) * 60;
  const staticDir = resolvePath(options.staticDir ?? env.SPARRING_STATIC_DIR ?? DEFAULT_STATIC_DIR);
  const quotaFile = resolvePath(options.quotaFile ?? env.SPARRING_QUOTA_FILE ?? DEFAULT_QUOTA_FILE);
  if (quotaFile === staticDir || quotaFile.startsWith(staticDir + sep)) {
    throw new Error('El archivo de cuota debe estar fuera del directorio público.');
  }
  const quota: QuotaLedger = createQuotaLedger(quotaFile, { staleLockMs: options.quotaStaleLockMs });
  const sessions = new Map<string, Session>();

  function cleanup(): void {
    const timestamp = now();
    for (const [context, session] of sessions) {
      if (timestamp >= session.deadline) sessions.delete(context);
    }
  }

  function sessionFor(context: unknown): Session {
    if (!boundedString(context, 128)) invalid();
    const session = sessions.get(context);
    if (!session || now() >= session.deadline) {
      throw new ApiError(401, 'session_expired', 'La sesión venció o no es válida. Inicia una nueva práctica.');
    }
    return session;
  }

  function token(): Promise<string> {
    return mintToken({
      key, sessionSeconds, upstream,
      timeoutMs: Math.min(TOKEN_TIMEOUT_MS, Math.max(1, options.tokenTimeoutMs ?? TOKEN_TIMEOUT_MS)),
    });
  }

  return createServer(async (request, response) => {
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
    response.setHeader('Referrer-Policy', 'no-referrer');
    try {
      const path = new URL(request.url ?? '/', 'http://127.0.0.1').pathname;

      if (!path.startsWith('/api/')) {
        if (request.method !== 'GET' && request.method !== 'HEAD') {
          throw new ApiError(405, 'method_not_allowed', 'Método no permitido.');
        }
        const filePath = resolveStaticFile(staticDir, path === '/' ? '/index.html' : path);
        if (filePath && existsSync(filePath) && statSync(filePath).isFile()) {
          const cacheControl = path.startsWith('/assets/') ? 'public, max-age=31536000, immutable' : 'no-cache';
          if (request.method === 'HEAD') {
            const type = MIME_TYPES[extname(filePath).toLowerCase()] ?? 'application/octet-stream';
            response.writeHead(200, { 'Content-Type': type, 'Content-Length': statSync(filePath).size, 'Cache-Control': cacheControl });
            response.end();
          } else {
            serveStatic(response, filePath, cacheControl);
          }
          return;
        }
        throw new ApiError(404, 'not_found', 'El recurso solicitado no existe.');
      }

      response.setHeader('Cache-Control', 'no-store');
      cleanup();
      if (request.method === 'GET' && path === '/api/health') {
        const health: Health = { status: 'ok', key_configured: Boolean(key), voice_enabled: enabled && Boolean(key), mode: 'production' };
        respond(response, 200, health); return;
      }
      if (request.method === 'GET' && path === '/api/catalog') { respond(response, 200, catalog); return; }
      if (request.method !== 'POST') throw new ApiError(404, 'not_found', 'La operación solicitada no existe.');
      if (!['/api/session/start', '/api/evaluate', '/api/session/finish', '/api/session/end'].includes(path)) {
        throw new ApiError(404, 'not_found', 'La operación solicitada no existe.');
      }
      const body = await readBody(request);
      if (path === '/api/session/start') {
        closedObject(body, ['scenario_id', 'scenario_version', 'consent']);
        if (!boundedString(body.scenario_id, 80) || !boundedString(body.scenario_version, 40) || body.consent !== true) invalid();
        const scenario = scenarios.find(item => item.id === body.scenario_id && item.version === body.scenario_version);
        if (!scenario) invalid();
        if (!enabled || !key) throw new ApiError(503, 'voice_disabled', 'La voz aún no está habilitada en este servidor.');
        const context = randomBytes(32).toString('base64url');
        let reservation: ReserveResult;
        try { reservation = await quota.reserve(sessionSeconds, dailySeconds, context, now()); }
        catch { throw new ApiError(503, 'quota_unavailable', 'No se pudo verificar la cuota de voz. Intenta de nuevo más tarde.'); }
        if (!reservation.ok) {
          if (reservation.reason === 'session_active') throw new ApiError(429, 'session_active', 'Ya hay una práctica activa en este servidor.');
          throw new ApiError(429, 'daily_limit', 'Se alcanzó el límite diario de voz de este servidor.');
        }
        const session: Session = { id: randomUUID(), deadline: now() + sessionSeconds * 1000, scenario, evaluation: newEvaluation(), ended: false };
        sessions.set(context, session);
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
          // Full reservation remains even on ambiguous upstream failure or abandoned response;
          // only the active-session lock is released so a later start can proceed.
          try { await quota.release(context, now()); } catch { /* fail closed: lock clears on its own deadline */ }
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
      try { await quota.release(body.session_context as string, now()); } catch { /* fail closed: lock clears on its own deadline */ }
      respond(response, 200, { ended: true });
    } catch (error) {
      const known = error instanceof ApiError ? error : new ApiError(500, 'internal_error', 'No se pudo completar la operación.');
      if (!response.headersSent && !response.destroyed) respond(response, known.status, { error: known.code, message: known.message });
    }
  });
}

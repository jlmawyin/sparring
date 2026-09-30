// Thin HTTP client for this app's own server contracts (not AssemblyAI).
// Contract shapes come from src/shared/types.ts.

import type {
  StartRequest,
  StartResponse,
  EvaluateRequest,
  EvaluateResponse,
  ScoreTurnRequest,
  ScoreTurnResponse,
} from '../shared/types';

export class ApiRequestError extends Error {
  constructor(readonly status: number, readonly code: string | undefined, message: string) {
    super(message);
  }
}

async function postJson<T>(url: string, body: unknown, signal?: AbortSignal): Promise<T> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
    signal,
  });
  if (!res.ok) {
    let message = `${url} failed with ${res.status}`;
    let code: string | undefined;
    try {
      const data = await res.json();
      if (data && typeof data.message === 'string') message = data.message;
      if (data && typeof data.error === 'string') code = data.error;
    } catch {
      // body wasn't JSON; keep default message.
    }
    throw new ApiRequestError(res.status, code, message);
  }
  return (await res.json()) as T;
}

export function startSession(req: StartRequest, signal?: AbortSignal): Promise<StartResponse> {
  return postJson<StartResponse>('/api/session/start', req, signal);
}

export function evaluate(req: EvaluateRequest, signal?: AbortSignal): Promise<EvaluateResponse> {
  return postJson<EvaluateResponse>('/api/evaluate', req, signal);
}

/** Asynchronous, best-effort: scores one finalized USER turn via the server's Gateway path. */
export function scoreTurn(req: ScoreTurnRequest, signal?: AbortSignal): Promise<ScoreTurnResponse> {
  return postJson<ScoreTurnResponse>('/api/session/score-turn', req, signal);
}

export interface FinishResponse {
  snapshot: import('../shared/types').ScoreSnapshot;
  coach_prompt: string;
}

export function finishSession(
  sessionContext: string,
  signal?: AbortSignal,
): Promise<FinishResponse> {
  return postJson<FinishResponse>(
    '/api/session/finish',
    { session_context: sessionContext },
    signal,
  );
}

/** Best-effort; caller should not block cleanup on this resolving. */
export function endSession(sessionContext: string): void {
  void postJson('/api/session/end', { session_context: sessionContext }).catch(() => {
    // best effort; server-side quota reconciliation does not depend on this.
  });
}

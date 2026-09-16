import type { EvaluateRequest, EvaluateResponse } from '../shared/types';

export class EvaluateIncompleteError extends Error {
  constructor() {
    super('evaluate_incomplete');
    this.name = 'EvaluateIncompleteError';
  }
}

export type EvaluateFn = (req: EvaluateRequest, signal?: AbortSignal) => Promise<EvaluateResponse>;

export type EvaluateAttempt =
  | { status: 'accepted'; response: EvaluateResponse }
  | { status: 'incomplete'; recovered?: EvaluateResponse };

async function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error('timeout')), ms);
  });
  try {
    return await Promise.race([p, timeout]);
  } finally {
    clearTimeout(timer!);
  }
}

function isRevisionConflict(error: unknown): boolean {
  return error instanceof Error && /revision_conflict|no coincide/i.test(error.message);
}

/**
 * First wait `timeoutMs` for evaluate(). On timeout, abort that attempt and
 * POST the identical envelope again: the server replays a cached accept, so a
 * late commit cannot leave the client on a stale revision. Non-timeout errors
 * propagate without a second POST. A second timeout is incomplete — never a
 * fabricated snapshot.
 */
export async function evaluateWithRecovery(
  req: EvaluateRequest,
  evaluate: EvaluateFn,
  timeoutMs: number,
): Promise<EvaluateResponse> {
  const controller = new AbortController();
  const inflight = evaluate(req, controller.signal);
  void inflight.catch(() => {
    /* Abandoned after timeout; abort may reject this promise later. */
  });
  try {
    return await withTimeout(inflight, timeoutMs);
  } catch (error) {
    controller.abort();
    if (!(error instanceof Error) || error.message !== 'timeout') throw error;
    try {
      return await withTimeout(evaluate(req), timeoutMs);
    } catch (retryError) {
      if (retryError instanceof Error && retryError.message === 'timeout') {
        throw new EvaluateIncompleteError();
      }
      throw retryError;
    }
  }
}

/**
 * If a new call hits revision_conflict, replay the previous envelope (idempotent)
 * to learn the server revision, then retry this call. A recovered snapshot is
 * returned even when this call stays incomplete so the UI can catch up without
 * inventing a tool success.
 */
export async function attemptEvaluate(
  req: EvaluateRequest,
  evaluate: EvaluateFn,
  timeoutMs: number,
  previous: EvaluateRequest | null,
): Promise<EvaluateAttempt> {
  try {
    return { status: 'accepted', response: await evaluateWithRecovery(req, evaluate, timeoutMs) };
  } catch (error) {
    if (!isRevisionConflict(error) || !previous || previous.tool_call_id === req.tool_call_id) {
      return { status: 'incomplete' };
    }
    try {
      const recovered = await evaluateWithRecovery(previous, evaluate, timeoutMs);
      try {
        const response = await evaluateWithRecovery(
          { ...req, revision: recovered.snapshot.revision },
          evaluate,
          timeoutMs,
        );
        return { status: 'accepted', response };
      } catch {
        return { status: 'incomplete', recovered };
      }
    } catch {
      return { status: 'incomplete' };
    }
  }
}

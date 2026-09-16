import { describe, expect, it, vi } from 'vitest';
import type { EvaluateRequest, EvaluateResponse, ScoreSnapshot } from '../../src/shared/types';
import {
  attemptEvaluate,
  EvaluateIncompleteError,
  evaluateWithRecovery,
  type EvaluateFn,
} from '../../src/voice/evaluateRecovery';

const req = (revision = 0, tool_call_id = 'call1'): EvaluateRequest => ({
  session_context: 'ctx',
  revision,
  tool_call_id,
  tool_name: 'score_rubric',
  arguments: { observations: [{ criterion_id: 'empathy', level: 3, quote: 'Entiendo', occurrence: 1, rationale: 'x' }] },
  transcript_final: [{ turn_id: 't1', role: 'USER', text: 'Entiendo', received_at_ms: 1 }],
});

function snapshot(revision: number): ScoreSnapshot {
  return {
    revision, criteria: [], coverage: 20, total: null, provisional: true,
    limitations: [], next_action: 'Practica.',
  };
}

function accepted(revision: number): EvaluateResponse {
  return { snapshot: snapshot(revision), result: { accepted: true, revision }, processing_ms: 4 };
}

function hang(signal?: AbortSignal): Promise<EvaluateResponse> {
  return new Promise((_, reject) => {
    const fail = () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' }));
    if (signal?.aborted) { fail(); return; }
    signal?.addEventListener('abort', fail, { once: true });
  });
}

describe('evaluateWithRecovery', () => {
  it('returns a fast accept without a second POST', async () => {
    const evaluate = vi.fn<EvaluateFn>(async () => accepted(1));
    await expect(evaluateWithRecovery(req(), evaluate, 40)).resolves.toMatchObject({ snapshot: { revision: 1 } });
    expect(evaluate).toHaveBeenCalledTimes(1);
  });

  it('recovers a late server accept by retrying the identical envelope after timeout', async () => {
    const evaluate = vi.fn<EvaluateFn>(async (body, signal) => {
      if (evaluate.mock.calls.length === 1) return hang(signal);
      expect(body).toEqual(req());
      return accepted(1);
    });
    const result = await evaluateWithRecovery(req(), evaluate, 20);
    expect(result.snapshot.revision).toBe(1);
    expect(result.result).toEqual({ accepted: true, revision: 1 });
    expect(evaluate).toHaveBeenCalledTimes(2);
  });

  it('declares incomplete when both attempts time out and never invents a snapshot', async () => {
    const evaluate = vi.fn<EvaluateFn>(async (_body, signal) => hang(signal));
    await expect(evaluateWithRecovery(req(), evaluate, 15)).rejects.toBeInstanceOf(EvaluateIncompleteError);
    expect(evaluate).toHaveBeenCalledTimes(2);
  });

  it('does not retry a fast non-timeout failure', async () => {
    const evaluate = vi.fn<EvaluateFn>(async () => {
      throw new Error('La revisión de la evaluación no coincide.');
    });
    await expect(evaluateWithRecovery(req(0, 'call2'), evaluate, 40)).rejects.toThrow(/no coincide/);
    expect(evaluate).toHaveBeenCalledTimes(1);
  });
});

describe('attemptEvaluate revision recovery', () => {
  it('replays the previous envelope after revision_conflict, then retries the new call', async () => {
    const previous = req(0, 'call1');
    const next = req(0, 'call2');
    const evaluate = vi.fn<EvaluateFn>(async body => {
      if (body.tool_call_id === 'call2' && body.revision === 0) {
        throw new Error('La revisión de la evaluación no coincide.');
      }
      if (body.tool_call_id === 'call1') return accepted(1);
      expect(body.revision).toBe(1);
      return accepted(2);
    });
    const attempt = await attemptEvaluate(next, evaluate, 40, previous);
    expect(attempt.status).toBe('accepted');
    if (attempt.status === 'accepted') {
      expect(attempt.response).toEqual(accepted(2));
      expect(attempt.sent.revision).toBe(1);
      expect(attempt.sent.tool_call_id).toBe('call2');
    }
    expect(evaluate.mock.calls.map(([body]) => [body.tool_call_id, body.revision])).toEqual([
      ['call2', 0],
      ['call1', 0],
      ['call2', 1],
    ]);
  });

  it('returns recovered snapshot without claiming this call succeeded', async () => {
    const previous = req(0, 'call1');
    const evaluate = vi.fn<EvaluateFn>(async body => {
      if (body.tool_call_id === 'call1') return accepted(1);
      throw new Error('La revisión de la evaluación no coincide.');
    });
    const attempt = await attemptEvaluate(req(0, 'call2'), evaluate, 40, previous);
    expect(attempt.status).toBe('incomplete');
    if (attempt.status === 'incomplete') {
      expect(attempt.recovered?.snapshot.revision).toBe(1);
      expect(attempt.sent.tool_call_id).toBe('call1');
    }
  });

  it('stays incomplete when there is no previous envelope to replay', async () => {
    const evaluate = vi.fn<EvaluateFn>(async () => {
      throw new Error('La revisión de la evaluación no coincide.');
    });
    const attempt = await attemptEvaluate(req(), evaluate, 40, null);
    expect(attempt).toMatchObject({ status: 'incomplete', sent: { tool_call_id: 'call1', revision: 0 } });
  });
});

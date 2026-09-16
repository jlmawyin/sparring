import { describe, expect, it } from 'vitest';
import { hashArgs, ToolResultGate } from '../../src/voice/toolGate';

describe('hashArgs', () => {
  it('is stable regardless of key order', () => {
    expect(hashArgs({ a: 1, b: 2 })).toBe(hashArgs({ b: 2, a: 1 }));
  });

  it('differs for different argument values', () => {
    expect(hashArgs({ a: 1 })).not.toBe(hashArgs({ a: 2 }));
  });

  it('is sensitive to nested object contents, e.g. score_rubric observations[]', () => {
    // A naive top-level-only key sort/filter would blank out nested keys
    // (observations[].criterion_id/level/quote/...) and collide every call.
    const a = { observations: [{ criterion_id: 'empathy', level: 3, quote: 'x', occurrence: 1 }] };
    const b = { observations: [{ criterion_id: 'empathy', level: 1, quote: 'x', occurrence: 1 }] };
    expect(hashArgs(a)).not.toBe(hashArgs(b));
  });

  it('is stable regardless of nested key order', () => {
    const a = { observations: [{ criterion_id: 'empathy', level: 3, quote: 'x', occurrence: 1 }] };
    const b = { observations: [{ occurrence: 1, quote: 'x', level: 3, criterion_id: 'empathy' }] };
    expect(hashArgs(a)).toBe(hashArgs(b));
  });
});

describe('ToolResultGate dedupe', () => {
  it('treats a fresh call_id as new', () => {
    const gate = new ToolResultGate();
    const outcome = gate.register('call1', hashArgs({ a: 1 }));
    expect(outcome.isNew).toBe(true);
    expect(outcome.conflict).toBe(false);
  });

  it('replays the cached result for an identical repeated call_id + args (idempotent)', () => {
    const gate = new ToolResultGate();
    gate.register('call1', hashArgs({ a: 1 }));
    gate.setResult('call1', JSON.stringify({ ok: true }), false);

    const again = gate.register('call1', hashArgs({ a: 1 }));
    expect(again.isNew).toBe(false);
    expect(again.conflict).toBe(false);
    expect(again.cached).toEqual({ payload: JSON.stringify({ ok: true }), isError: false });
  });

  it('flags a conflict when the same call_id arrives with different arguments', () => {
    const gate = new ToolResultGate();
    gate.register('call1', hashArgs({ a: 1 }));
    const conflict = gate.register('call1', hashArgs({ a: 2 }));
    expect(conflict.conflict).toBe(true);
  });

  it('does not resend an already-sent result as new/cached-replay twice', () => {
    const gate = new ToolResultGate();
    gate.onReplyStarted('reply-1');
    gate.register('call1', hashArgs({ a: 1 }));
    gate.setResult('call1', 'result', false);
    gate.onReplyDone('reply-1', 'completed');
    expect(gate.canSend('call1')).toBe(true);
    gate.markSent('call1');
    expect(gate.canSend('call1')).toBe(false);
    expect(gate.statusOf('call1')).toBe('sent');
  });
});

describe('ToolResultGate reply/turn gating', () => {
  it('never sends while the call\'s own reply is still open (not yet done) — per docs, only after reply.done', () => {
    const gate = new ToolResultGate();
    gate.onReplyStarted('reply-1');
    gate.register('call1', hashArgs({ a: 1 }));
    expect(gate.canSend('call1')).toBe(false); // no result yet

    gate.setResult('call1', 'result', false);
    // The HTTP eval finished fast, but reply-1 has not emitted reply.done yet:
    // sending now would violate "send tool.result when reply.done is the latest event".
    expect(gate.canSend('call1')).toBe(false);
    expect(gate.readyToSend()).toEqual([]);
  });

  it('becomes sendable exactly once its own reply.done(completed) arrives', () => {
    const gate = new ToolResultGate();
    gate.onReplyStarted('reply-1');
    gate.register('call1', hashArgs({ a: 1 }));
    gate.setResult('call1', 'result', false);
    gate.onReplyDone('reply-1', 'completed');
    expect(gate.canSend('call1')).toBe(true);
  });

  it('invalidates a pending (not-yet-sent) ready result when a newer reply starts (later reply invalidates)', () => {
    const gate = new ToolResultGate();
    gate.onReplyStarted('reply-1');
    gate.register('call1', hashArgs({ a: 1 }));
    gate.setResult('call1', 'result', false);
    gate.onReplyDone('reply-1', 'completed');
    expect(gate.canSend('call1')).toBe(true);

    // A new reply begins before we flushed the result -> stale, permanently.
    gate.onReplyStarted('reply-2');
    expect(gate.canSend('call1')).toBe(false);
    expect(gate.readyToSend()).toEqual([]);
  });

  it('invalidates a pending ready result when the user starts speaking again (later speech invalidates)', () => {
    const gate = new ToolResultGate();
    gate.onReplyStarted('reply-1');
    gate.register('call1', hashArgs({ a: 1 }));
    gate.setResult('call1', 'result', false);
    gate.onReplyDone('reply-1', 'completed');
    expect(gate.canSend('call1')).toBe(true);

    gate.onUserSpeechStarted();
    expect(gate.canSend('call1')).toBe(false);
    expect(gate.readyToSend()).toEqual([]);
  });

  it('cancels pending tool results when their reply is interrupted (never resend stale result)', () => {
    const gate = new ToolResultGate();
    gate.onReplyStarted('reply-1');
    gate.register('call1', hashArgs({ a: 1 }));
    gate.setResult('call1', 'result', false);

    gate.onReplyDone('reply-1', 'interrupted');

    expect(gate.canSend('call1')).toBe(false);
    expect(gate.statusOf('call1')).toBe('cancelled');
    expect(gate.readyToSend()).toEqual([]);
  });

  it('opens the gate for readyToSend once reply.done completed clears the open reply', () => {
    const gate = new ToolResultGate();
    gate.onReplyStarted('reply-1');
    gate.register('call1', hashArgs({ a: 1 }));
    gate.setResult('call1', 'result', false);

    gate.onReplyDone('reply-1', 'completed');

    expect(gate.readyToSend()).toEqual(['call1']);
  });

  it('a late HTTP completion for a cancelled call must never become sendable (late-completion cleanup)', () => {
    const gate = new ToolResultGate();
    gate.onReplyStarted('reply-1');
    gate.register('call1', hashArgs({ a: 1 }));
    gate.onReplyDone('reply-1', 'interrupted'); // cancelled before the HTTP eval returns

    // The evaluate() promise resolves after cancellation — controller still calls setResult.
    gate.setResult('call1', 'late result', false);

    expect(gate.canSend('call1')).toBe(false);
    expect(gate.statusOf('call1')).toBe('cancelled');
  });

  it('explicit cancel() prevents a not-yet-sent result from ever being sendable', () => {
    const gate = new ToolResultGate();
    gate.register('call1', hashArgs({ a: 1 }));
    gate.setResult('call1', 'result', false);
    gate.cancel('call1');
    expect(gate.canSend('call1')).toBe(false);
  });

  it('reset() clears all call state and the open reply pointer', () => {
    const gate = new ToolResultGate();
    gate.onReplyStarted('reply-1');
    gate.register('call1', hashArgs({ a: 1 }));
    gate.setResult('call1', 'result', false);
    gate.reset();
    expect(gate.statusOf('call1')).toBeUndefined();
    expect(gate.readyToSend()).toEqual([]);
  });
});

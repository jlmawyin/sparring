// Client integration test for the tool.call -> tool.result lifecycle,
// verified against AssemblyAI's Client-side tools docs (Voice Agent API,
// "tools/client-side-tools"): tool.result must be sent only while
// reply.done is the LATEST event. This covers the documented late-call
// ordering: a tool-call reply's reply.started/reply.done (reply_id
// `fc-<call_id>`, per the events reference) can complete before our own
// /api/evaluate HTTP round trip resolves, so the tool.call handler must
// flush the result as soon as it's ready ("flush_if_idle" in the docs'
// own example) rather than waiting on anything else — as long as no newer
// speech/reply has started in the meantime.
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ScenarioBrief, ScoreSnapshot, VoiceCallbacks } from '../../src/shared/types';
import { createVoiceController } from '../../src/voice/controller';

class FakeSocket {
  readyState = 0; // CONNECTING
  listeners: Record<string, Array<(ev: any) => void>> = {};
  send = vi.fn();
  close = vi.fn();
  addEventListener(type: string, listener: (ev: any) => void): void {
    (this.listeners[type] ??= []).push(listener);
  }
  removeEventListener(type: string, listener: (ev: any) => void): void {
    this.listeners[type] = (this.listeners[type] ?? []).filter((l) => l !== listener);
  }
  open(): void {
    this.readyState = 1;
    for (const l of this.listeners.open ?? []) l({});
  }
  message(payload: unknown): void {
    for (const l of this.listeners.message ?? []) l({ data: JSON.stringify(payload) });
  }
}

class FakeAudioWorkletNode {
  port = { onmessage: null as ((ev: MessageEvent) => void) | null, postMessage: () => {} };
  connect(): void {}
  disconnect(): void {}
}

function fakeAudioContext(): AudioContext {
  return {
    state: 'running',
    audioWorklet: { addModule: async () => {} },
    resume: async () => {},
    close: async () => {},
    createMediaStreamSource: () => ({ connect: () => {}, disconnect: () => {} }),
    createGain: () => ({ gain: { value: 0 }, connect: () => {} }),
    createBuffer: () => ({ getChannelData: () => new Float32Array() }),
    createBufferSource: () => ({ buffer: null, onended: null, connect: () => {}, start: () => {}, stop: () => {} }),
    currentTime: 0,
    sampleRate: 24000,
    destination: {},
  } as unknown as AudioContext;
}

function jsonResponse(body: unknown): Response {
  return { ok: true, status: 200, json: async () => body } as unknown as Response;
}

function sentMessages(socket: FakeSocket): Array<Record<string, unknown>> {
  return socket.send.mock.calls.map((call) => JSON.parse(String(call[0])));
}

const scenario: ScenarioBrief = {
  id: 'late_delivery', version: '1.0.0', title: 'Pedido tardío', brief: 'Brief.',
  role: 'Cliente', facts: {}, authority: {},
};

function makeHarness() {
  let socket: FakeSocket | undefined;
  const snapshot: ScoreSnapshot = {
    revision: 1,
    criteria: [{ id: 'empathy', label: 'Empatía', weight: 20, level: 3, evidence: null }],
    coverage: 20, total: null, provisional: true, limitations: [], next_action: 'Sigue practicando.',
  };

  const evaluateCalls: unknown[] = [];
  let resolveEvaluate: (() => void) | undefined;
  const evaluateGate = new Promise<void>((resolve) => { resolveEvaluate = resolve; });

  const fetchMock = vi.fn(async (url: unknown, init?: RequestInit) => {
    const path = String(url);
    if (path === '/api/session/start') {
      return jsonResponse({
        session_id: 'sess1', session_context: 'ctx-1', token: 'tok', max_seconds: 60,
        deadline: Date.now() + 60_000, session_config: {},
      });
    }
    if (path === '/api/evaluate') {
      evaluateCalls.push(JSON.parse(String(init?.body)));
      await evaluateGate; // held open until the test explicitly releases it
      return jsonResponse({ snapshot, result: { accepted: true }, processing_ms: 1 });
    }
    if (path === '/api/session/score-turn') {
      return jsonResponse({ status: 'scored', snapshot });
    }
    return jsonResponse({ ended: true });
  });
  vi.stubGlobal('fetch', fetchMock);
  vi.stubGlobal('AudioWorkletNode', FakeAudioWorkletNode as unknown as typeof AudioWorkletNode);

  const onSnapshot = vi.fn();
  const onError = vi.fn();
  const callbacks: VoiceCallbacks = {
    onState: () => {}, onTurn: () => {}, onPartial: () => {}, onSnapshot, onError,
  };

  const controller = createVoiceController(callbacks, {
    wsFactory: () => { socket = new FakeSocket(); return socket as any; },
    getUserMedia: async () => ({ getTracks: () => [] } as unknown as MediaStream),
    createAudioContext: () => fakeAudioContext(),
  });

  return { controller, callbacks, onSnapshot, onError, evaluateCalls, resolveEvaluate: () => resolveEvaluate!(), snapshot, getSocket: () => socket };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('voice controller tool.result delivery follows the documented reply.done ordering rule', () => {
  it('sends tool.result right after its own reply.done(completed), with no newer speech/reply in between, and the next agent reply still completes', async () => {
    const h = makeHarness();
    const startPromise = h.controller.start(scenario);
    await vi.waitFor(() => expect(h.getSocket()).toBeDefined());
    const socket = h.getSocket()!;
    socket.open();
    socket.message({ type: 'session.ready', session_id: 's1', expires_at: 0 });
    await startPromise;

    // Agent greeting.
    socket.message({ type: 'reply.started', reply_id: 'reply-greet' });
    socket.message({ type: 'reply.done', reply_id: 'reply-greet', status: 'completed' });

    // One finalized USER utterance.
    socket.message({ type: 'transcript.user', item_id: 'item1', text: 'No tengo presupuesto para esto.' });

    // The tool.call arrives after its silent reply already completed. This is
    // the ordering that the old gate stranded: register() saw no open reply.
    // Per the events reference, a tool-call reply uses `fc-<call_id>`.
    socket.message({ type: 'reply.started', reply_id: 'fc-call1' });
    socket.message({ type: 'reply.done', reply_id: 'fc-call1', status: 'completed' });
    socket.message({
      type: 'tool.call',
      call_id: 'call1',
      name: 'score_rubric',
      arguments: {
        observations: [
          { criterion_id: 'empathy', level: 3, quote: 'No tengo presupuesto', occurrence: 1, rationale: 'Reconoce la objeción de presupuesto.' },
        ],
      },
    });

    // Wait until the HTTP evaluation has genuinely started (in flight, awaiting the gate).
    await vi.waitFor(() => expect(h.evaluateCalls.length).toBe(1));

    // No newer speech/reply arrives before the result is ready: reply.done(fc-call1)
    // is still the latest turn event, so the result must flush when evaluation resolves.
    expect(sentMessages(socket).some((m) => m.type === 'tool.result')).toBe(false);
    h.resolveEvaluate();

    await vi.waitFor(() => {
      expect(sentMessages(socket).some((m) => m.type === 'tool.result' && m.call_id === 'call1')).toBe(true);
    });

    const toolResultMsg = sentMessages(socket).find((m) => m.type === 'tool.result');
    expect(toolResultMsg).toMatchObject({ call_id: 'call1', is_error: false });
    expect(h.onSnapshot).toHaveBeenCalledWith(h.snapshot);
    expect(h.onError).not.toHaveBeenCalled();

    // The next agent reply proceeds normally afterward.
    socket.message({ type: 'reply.started', reply_id: 'reply-next' });
    socket.message({ type: 'transcript.agent', text: 'Entiendo la objeción de presupuesto.', reply_id: 'reply-next', item_id: 'item2', interrupted: false });
    socket.message({ type: 'reply.done', reply_id: 'reply-next', status: 'completed' });
    expect(h.onError).not.toHaveBeenCalled();

    h.controller.stop();
  });

  it('does not send tool.result while a newer reply is open, and flushes once that reply reaches its own reply.done', async () => {
    const h = makeHarness();
    const startPromise = h.controller.start(scenario);
    await vi.waitFor(() => expect(h.getSocket()).toBeDefined());
    const socket = h.getSocket()!;
    socket.open();
    socket.message({ type: 'session.ready', session_id: 's1', expires_at: 0 });
    await startPromise;

    socket.message({ type: 'reply.started', reply_id: 'reply-greet' });
    socket.message({ type: 'reply.done', reply_id: 'reply-greet', status: 'completed' });
    socket.message({ type: 'transcript.user', item_id: 'item1', text: 'No tengo presupuesto para esto.' });

    socket.message({ type: 'reply.started', reply_id: 'fc-call1' });
    socket.message({
      type: 'tool.call',
      call_id: 'call1',
      name: 'score_rubric',
      arguments: {
        observations: [
          { criterion_id: 'empathy', level: 3, quote: 'No tengo presupuesto', occurrence: 1, rationale: 'Reconoce la objeción de presupuesto.' },
        ],
      },
    });
    socket.message({ type: 'reply.done', reply_id: 'fc-call1', status: 'completed' });

    await vi.waitFor(() => expect(h.evaluateCalls.length).toBe(1));

    // A brand-new reply opens (and the user speaks again) before /api/evaluate resolves: per the
    // docs, reply.done is no longer the latest event, so the result must NOT be sent yet.
    socket.message({ type: 'input.speech.started' });
    socket.message({ type: 'reply.started', reply_id: 'reply-next' });

    h.resolveEvaluate();
    await vi.waitFor(() => expect(h.evaluateCalls.length).toBe(1)); // evaluate settled
    // Give any microtasks a chance to run before asserting nothing was sent.
    await Promise.resolve();
    await Promise.resolve();
    expect(sentMessages(socket).some((m) => m.type === 'tool.result')).toBe(false);

    // Only once reply-next itself reaches reply.done does reply.done become the latest event again.
    socket.message({ type: 'transcript.agent', text: 'Entiendo la objeción de presupuesto.', reply_id: 'reply-next', item_id: 'item2', interrupted: false });
    socket.message({ type: 'reply.done', reply_id: 'reply-next', status: 'completed' });

    await vi.waitFor(() => {
      expect(sentMessages(socket).some((m) => m.type === 'tool.result' && m.call_id === 'call1')).toBe(true);
    });
    expect(h.onError).not.toHaveBeenCalled();

    h.controller.stop();
  });
});

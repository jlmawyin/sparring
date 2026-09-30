// Client integration test: a finalized USER turn must produce a visible
// snapshot via the server's application-triggered Gateway scoring path
// (POST /api/session/score-turn) even when the voice model emits ZERO
// tool.call events — this is the whole point of gatewayScore.ts existing
// as a separate path from the tool.call-driven /api/evaluate flow.
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

const scenario: ScenarioBrief = {
  id: 'late_delivery', version: '1.0.0', title: 'Pedido tardío', brief: 'Brief.',
  role: 'Cliente', facts: {}, authority: {},
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('voice controller Gateway score path (zero tool.call)', () => {
  it('shows a visible snapshot update from /api/session/score-turn with no tool.call, before finish()', async () => {
    let socket: FakeSocket | undefined;
    const scoreTurnBodies: unknown[] = [];
    const evaluateCalls: unknown[] = [];
    const snapshot: ScoreSnapshot = {
      revision: 1,
      criteria: [{ id: 'empathy', label: 'Empatía', weight: 20, level: 3, evidence: null }],
      coverage: 20, total: null, provisional: true, limitations: [], next_action: 'Sigue practicando.',
    };

    const fetchMock = vi.fn(async (url: unknown, init?: RequestInit) => {
      const path = String(url);
      if (path === '/api/session/start') {
        return jsonResponse({
          session_id: 'sess1', session_context: 'ctx-1', token: 'tok', max_seconds: 60,
          deadline: Date.now() + 60_000, session_config: {},
        });
      }
      if (path === '/api/session/score-turn') {
        scoreTurnBodies.push(JSON.parse(String(init?.body)));
        return jsonResponse({ status: 'scored', snapshot });
      }
      if (path === '/api/evaluate') {
        evaluateCalls.push(JSON.parse(String(init?.body)));
        return jsonResponse({ snapshot, result: { accepted: true }, processing_ms: 1 });
      }
      return jsonResponse({ ended: true });
    });
    vi.stubGlobal('fetch', fetchMock);
    vi.stubGlobal('AudioWorkletNode', FakeAudioWorkletNode as unknown as typeof AudioWorkletNode);

    const onSnapshot = vi.fn();
    const callbacks: VoiceCallbacks = {
      onState: () => {}, onTurn: () => {}, onPartial: () => {}, onSnapshot, onError: () => {},
    };

    const controller = createVoiceController(callbacks, {
      wsFactory: () => { socket = new FakeSocket(); return socket as any; },
      getUserMedia: async () => ({ getTracks: () => [] } as unknown as MediaStream),
      createAudioContext: () => fakeAudioContext(),
    });

    const startPromise = controller.start(scenario);
    await vi.waitFor(() => expect(socket).toBeDefined());
    socket!.open();
    socket!.message({ type: 'session.ready', session_id: 's1', expires_at: 0 });
    await startPromise;

    // A finalized USER turn arrives; the voice model never emits tool.call.
    socket!.message({ type: 'transcript.user', item_id: 'item1', text: 'Necesito ayuda con mi pedido.' });

    await vi.waitFor(() => expect(onSnapshot).toHaveBeenCalled());

    expect(scoreTurnBodies).toEqual([
      { session_context: 'ctx-1', turn_id: 'turn_1', transcript_final: [expect.objectContaining({ turn_id: 'turn_1', text: 'Necesito ayuda con mi pedido.' })] },
    ]);
    expect(onSnapshot).toHaveBeenCalledWith(snapshot);
    expect(evaluateCalls).toEqual([]); // zero tool.call, zero /api/evaluate

    controller.stop();
  });
});

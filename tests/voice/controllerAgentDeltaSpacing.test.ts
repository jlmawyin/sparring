// Discriminates the reported bug ("primera frase pegada sin espacios") from
// its two possible causes: (a) client-side concatenation of
// transcript.agent.delta, or (b) the provider's deltas themselves. Since
// AssemblyAI only documents `delta` as "the next word (or token)" (no
// spacing guarantee, unlike transcript.user.delta's documented "full
// transcript so far"), this test drives the controller with synthetic
// bare-word deltas — the worst case the docs allow — and asserts the live
// partial stays word-separated while the final transcript.agent (verbatim
// from the server) is never rewritten.
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ScenarioBrief, VoiceCallbacks } from '../../src/shared/types';
import { createVoiceController } from '../../src/voice/controller';

class FakeSocket {
  readyState = 0;
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

async function bootController(onPartial: VoiceCallbacks['onPartial'], onTurn: VoiceCallbacks['onTurn'] = () => {}) {
  let socket: FakeSocket | undefined;
  const fetchMock = vi.fn(async (url: unknown) => {
    const path = String(url);
    if (path === '/api/session/start') {
      return jsonResponse({
        session_id: 'sess1', session_context: 'ctx-1', token: 'tok', max_seconds: 60,
        deadline: Date.now() + 60_000, session_config: {},
      });
    }
    return jsonResponse({ ended: true });
  });
  vi.stubGlobal('fetch', fetchMock);
  vi.stubGlobal('AudioWorkletNode', FakeAudioWorkletNode as unknown as typeof AudioWorkletNode);

  const callbacks: VoiceCallbacks = {
    onState: () => {}, onTurn, onPartial, onSnapshot: () => {}, onError: () => {},
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
  return { socket: socket!, controller };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('transcript.agent.delta live-partial word separation', () => {
  it('keeps words separated when the provider sends bare-word deltas with no spaces', async () => {
    const partials: string[] = [];
    const { socket, controller } = await bootController((role, text) => {
      if (role === 'AGENT') partials.push(text);
    });

    socket.message({ type: 'reply.started', reply_id: 'r1', item_id: 'i1' });
    for (const word of ['El', 'pedido', 'llegó', 'tarde']) {
      socket.message({ type: 'transcript.agent.delta', reply_id: 'r1', item_id: 'i1', delta: word });
    }

    expect(partials.at(-1)).toBe('El pedido llegó tarde');
    controller.stop();
  });

  it('does not double-space when deltas already carry a correct leading space', async () => {
    const partials: string[] = [];
    const { socket, controller } = await bootController((role, text) => {
      if (role === 'AGENT') partials.push(text);
    });

    socket.message({ type: 'reply.started', reply_id: 'r1', item_id: 'i1' });
    for (const word of ['El', ' pedido', ' llegó', ' tarde']) {
      socket.message({ type: 'transcript.agent.delta', reply_id: 'r1', item_id: 'i1', delta: word });
    }

    expect(partials.at(-1)).toBe('El pedido llegó tarde');
    controller.stop();
  });

  it('does not insert a space before trailing punctuation', async () => {
    const partials: string[] = [];
    const { socket, controller } = await bootController((role, text) => {
      if (role === 'AGENT') partials.push(text);
    });

    socket.message({ type: 'reply.started', reply_id: 'r1', item_id: 'i1' });
    for (const word of ['Hola', ',', 'gracias', '.']) {
      socket.message({ type: 'transcript.agent.delta', reply_id: 'r1', item_id: 'i1', delta: word });
    }

    expect(partials.at(-1)).toBe('Hola, gracias.');
    controller.stop();
  });

  it('never rewrites the verbatim final transcript.agent text', async () => {
    const turns: string[] = [];
    const { socket, controller } = await bootController(() => {}, (turn) => turns.push(turn.text));

    socket.message({ type: 'reply.started', reply_id: 'r1', item_id: 'i1' });
    socket.message({ type: 'transcript.agent.delta', reply_id: 'r1', item_id: 'i1', delta: 'El' });
    socket.message({ type: 'transcript.agent.delta', reply_id: 'r1', item_id: 'i1', delta: 'pedido' });
    // Final text intentionally carries an irregular double space exactly as
    // the provider sent it, and must pass through untouched regardless of
    // how the live partial was joined — no invented/corrected spacing on
    // the quote that scoring evidence relies on.
    socket.message({
      type: 'transcript.agent', reply_id: 'r1', item_id: 'i1', interrupted: false,
      text: 'El  pedido llegó tarde.',
    });

    controller.stop();
    expect(turns).toEqual(['El  pedido llegó tarde.']);
  });
});

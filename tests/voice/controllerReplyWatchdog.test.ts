// Recovery watchdog for a finalized USER turn whose provider reply finishes
// completed with no transcript.agent and no tool.call — observed live
// (Edge production, ?voiceDebug=1, 2026-09-30 06:08 UTC): reply.started ->
// reply.done(completed) with nothing in between. Bounded fix: wait a short
// grace for a late tool.call (AAI's docs note tool.call may arrive around
// reply.done), then send exactly one reply.create for that turn; a second
// empty reply surfaces onError instead of retrying (no loop).
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

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const scenario: ScenarioBrief = {
  id: 'late_delivery', version: '1.0.0', title: 'Pedido tardío', brief: 'Brief.',
  role: 'Cliente', facts: {}, authority: {},
};

const snapshot: ScoreSnapshot = {
  revision: 1,
  criteria: [{ id: 'empathy', label: 'Empatía', weight: 20, level: 3, evidence: null }],
  coverage: 20, total: null, provisional: true, limitations: [], next_action: 'Sigue practicando.',
};

function makeHarness() {
  let socket: FakeSocket | undefined;
  const fetchMock = vi.fn(async (url: unknown) => {
    const path = String(url);
    if (path === '/api/session/start') {
      return jsonResponse({
        session_id: 'sess1', session_context: 'ctx-1', token: 'tok', max_seconds: 60,
        deadline: Date.now() + 60_000, session_config: {},
      });
    }
    if (path === '/api/session/score-turn') {
      return jsonResponse({ status: 'scored', snapshot });
    }
    return jsonResponse({ ended: true });
  });
  vi.stubGlobal('fetch', fetchMock);
  vi.stubGlobal('AudioWorkletNode', FakeAudioWorkletNode as unknown as typeof AudioWorkletNode);

  const onError = vi.fn();
  const callbacks: VoiceCallbacks = {
    onState: () => {}, onTurn: () => {}, onPartial: () => {}, onSnapshot: () => {}, onError,
  };

  const controller = createVoiceController(callbacks, {
    wsFactory: () => { socket = new FakeSocket(); return socket as any; },
    getUserMedia: async () => ({ getTracks: () => [] } as unknown as MediaStream),
    createAudioContext: () => fakeAudioContext(),
  });

  return { controller, onError, getSocket: () => socket };
}

async function beginRoleplayWithGreeting(): Promise<{ h: ReturnType<typeof makeHarness>; socket: FakeSocket }> {
  const h = makeHarness();
  const startPromise = h.controller.start(scenario);
  await vi.waitFor(() => expect(h.getSocket()).toBeDefined());
  const socket = h.getSocket()!;
  socket.open();
  socket.message({ type: 'session.ready', session_id: 's1', expires_at: 0 });
  await startPromise;

  // Greeting: completed with a real transcript.agent — must never arm the watchdog.
  socket.message({ type: 'reply.started', reply_id: 'reply-greet' });
  socket.message({ type: 'transcript.agent', text: 'Hola.', reply_id: 'reply-greet', item_id: 'greet1', interrupted: false });
  socket.message({ type: 'reply.done', reply_id: 'reply-greet', status: 'completed' });

  return { h, socket };
}

function sendUserTurnThenEmptyReply(socket: FakeSocket, replyId: string): void {
  socket.message({ type: 'input.speech.started' });
  socket.message({ type: 'transcript.user', item_id: 'item1', text: 'No tengo tiempo para rodeos.' });
  socket.message({ type: 'input.speech.stopped' });
  socket.message({ type: 'reply.started', reply_id: replyId });
  socket.message({ type: 'reply.done', reply_id: replyId, status: 'completed' });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('voice controller reply-watchdog recovery for empty completed replies', () => {
  it('sends exactly one reply.create after the grace period when a reply completes with no transcript.agent and no tool.call', async () => {
    const { h, socket } = await beginRoleplayWithGreeting();
    sendUserTurnThenEmptyReply(socket, 'reply-empty');

    // Nothing sent yet: still inside the grace window.
    await wait(200);
    expect(sentMessages(socket).some((m) => m.type === 'reply.create')).toBe(false);

    await wait(1200);
    const created = sentMessages(socket).filter((m) => m.type === 'reply.create');
    expect(created).toHaveLength(1);
    expect(typeof created[0].instructions).toBe('string');
    expect((created[0].instructions as string).length).toBeGreaterThan(0);
    expect(h.onError).not.toHaveBeenCalled();

    h.controller.stop();
  });

  it('a late tool.call within the grace period suppresses recovery', async () => {
    const { h, socket } = await beginRoleplayWithGreeting();
    sendUserTurnThenEmptyReply(socket, 'reply-latetool');

    await wait(200);
    socket.message({
      type: 'tool.call',
      call_id: 'call1',
      name: 'log_objection',
      arguments: { quote: 'No tengo tiempo', occurrence: 1 },
    });

    await wait(1200);
    expect(sentMessages(socket).some((m) => m.type === 'reply.create')).toBe(false);

    h.controller.stop();
  });

  it('a subsequent transcript.agent suppresses recovery', async () => {
    const { h, socket } = await beginRoleplayWithGreeting();
    sendUserTurnThenEmptyReply(socket, 'reply-latetranscript');

    await wait(200);
    socket.message({
      type: 'transcript.agent',
      text: '¿Antes de qué?',
      reply_id: 'reply-latetranscript',
      item_id: 'agent1',
      interrupted: false,
    });

    await wait(1200);
    expect(sentMessages(socket).some((m) => m.type === 'reply.create')).toBe(false);

    h.controller.stop();
  });

  it('does not duplicate a spoken reply while its final transcript is delayed', async () => {
    const { h, socket } = await beginRoleplayWithGreeting();
    socket.message({ type: 'input.speech.started' });
    socket.message({ type: 'transcript.user', item_id: 'item1', text: 'Necesito una solución.' });
    socket.message({ type: 'input.speech.stopped' });
    socket.message({ type: 'reply.started', reply_id: 'reply-spoken' });
    socket.message({ type: 'reply.audio', reply_id: 'reply-spoken', data: '' });
    socket.message({ type: 'reply.done', reply_id: 'reply-spoken', status: 'completed' });

    await wait(1200);
    expect(sentMessages(socket).some((m) => m.type === 'reply.create')).toBe(false);
    h.controller.stop();
  });

  it('does not recover on an interrupted reply', async () => {
    const { h, socket } = await beginRoleplayWithGreeting();
    socket.message({ type: 'input.speech.started' });
    socket.message({ type: 'transcript.user', item_id: 'item1', text: 'No tengo tiempo para rodeos.' });
    socket.message({ type: 'input.speech.stopped' });
    socket.message({ type: 'reply.started', reply_id: 'reply-interrupted' });
    socket.message({ type: 'reply.done', reply_id: 'reply-interrupted', status: 'interrupted' });

    await wait(1200);
    expect(sentMessages(socket).some((m) => m.type === 'reply.create')).toBe(false);
    expect(h.onError).not.toHaveBeenCalled();

    h.controller.stop();
  });

  it('stop() before the grace elapses prevents a stale recovery send', async () => {
    const { h, socket } = await beginRoleplayWithGreeting();
    sendUserTurnThenEmptyReply(socket, 'reply-stopped');

    await wait(200);
    h.controller.stop();
    const sendCallsAtStop = socket.send.mock.calls.length;

    await wait(1200);
    // No new reply.create was appended after stop() froze the socket traffic.
    expect(sentMessages(socket).slice(sendCallsAtStop).some((m) => m.type === 'reply.create')).toBe(false);
  });

  it('a second empty forced reply does not loop and surfaces onError instead', async () => {
    const { h, socket } = await beginRoleplayWithGreeting();
    sendUserTurnThenEmptyReply(socket, 'reply-empty1');

    await wait(1200);
    const firstBatch = sentMessages(socket).filter((m) => m.type === 'reply.create');
    expect(firstBatch).toHaveLength(1);
    expect(h.onError).not.toHaveBeenCalled();

    // The forced reply itself also comes back empty.
    socket.message({ type: 'reply.started', reply_id: 'reply-empty2' });
    socket.message({ type: 'reply.done', reply_id: 'reply-empty2', status: 'completed' });

    await wait(1200);
    const secondBatch = sentMessages(socket).filter((m) => m.type === 'reply.create');
    expect(secondBatch).toHaveLength(1); // no second reply.create: bounded, no loop
    expect(h.onError).toHaveBeenCalledTimes(1);

    h.controller.stop();
  });
});

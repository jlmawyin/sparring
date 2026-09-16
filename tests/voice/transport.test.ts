import { describe, expect, it, vi } from 'vitest';
import { VoiceTransport, type MinimalWebSocket } from '../../src/voice/transport';

class FakeSocket implements MinimalWebSocket {
  readyState = 0; // CONNECTING
  sent: string[] = [];
  listeners: Record<string, Array<(ev: any) => void>> = {};

  send(data: string): void {
    this.sent.push(data);
  }
  close(): void {
    this.readyState = 3;
  }
  addEventListener(type: string, listener: (ev: any) => void): void {
    (this.listeners[type] ??= []).push(listener);
  }
  removeEventListener(type: string, listener: (ev: any) => void): void {
    this.listeners[type] = (this.listeners[type] ?? []).filter((l) => l !== listener);
  }

  emit(type: string, ev: any): void {
    for (const l of this.listeners[type] ?? []) l(ev);
  }

  /** Real WebSocket becomes OPEN and fires 'open' together; mirror that. */
  open(): void {
    this.readyState = 1;
    this.emit('open', {});
  }

  message(payload: unknown): void {
    this.emit('message', { data: JSON.stringify(payload) });
  }

  sentMessages(): any[] {
    return this.sent.map((s) => JSON.parse(s));
  }
}

const noHandlers = { onEvent: () => {}, onClose: () => {}, onSocketError: () => {} };
const config = { system_prompt: 'hola' };

describe('VoiceTransport connect handshake', () => {
  it('sends the initial session.update as soon as the socket opens — BEFORE session.ready (no deadlock)', async () => {
    const socket = new FakeSocket();
    const transport = new VoiceTransport(() => socket);

    const connectPromise = transport.connect('tok', config, noHandlers);
    socket.open();

    expect(socket.sentMessages()).toEqual([{ type: 'session.update', session: config }]);

    socket.message({ type: 'session.ready', session_id: 's1', expires_at: 1 });
    await expect(connectPromise).resolves.toBeUndefined();
  });

  it('resolves once session.ready arrives and delivers it via onEvent', async () => {
    const socket = new FakeSocket();
    const transport = new VoiceTransport(() => socket);
    const events: string[] = [];

    const connectPromise = transport.connect('tok', config, {
      onEvent: (ev) => events.push(ev.type),
      onClose: () => {},
      onSocketError: () => {},
    });

    socket.open();
    socket.message({ type: 'session.ready', session_id: 's1', expires_at: 1 });
    await expect(connectPromise).resolves.toBeUndefined();
    expect(events).toEqual(['session.ready']);
  });

  it('rejects on handshake timeout and stops waiting once settled', async () => {
    vi.useFakeTimers();
    const socket = new FakeSocket();
    const transport = new VoiceTransport(() => socket);

    const connectPromise = transport.connect('tok', config, noHandlers, 10_000);
    const assertion = expect(connectPromise).rejects.toThrow('handshake timeout');
    vi.advanceTimersByTime(10_000);
    await assertion;
    vi.useRealTimers();
  });

  it('rejects on socket error before ready and still notifies onSocketError for later errors after settle', async () => {
    const socket = new FakeSocket();
    const transport = new VoiceTransport(() => socket);
    let laterErrors = 0;

    const connectPromise = transport.connect('tok', config, {
      onEvent: () => {},
      onClose: () => {},
      onSocketError: () => {
        laterErrors++;
      },
    });

    socket.emit('error', {});
    await expect(connectPromise).rejects.toThrow('socket error before ready');
    expect(laterErrors).toBe(1);
  });

  it('rejects if the socket closes before session.ready', async () => {
    const socket = new FakeSocket();
    const transport = new VoiceTransport(() => socket);

    const connectPromise = transport.connect('tok', config, noHandlers);
    socket.emit('close', { code: 1006, reason: 'abnormal' });
    await expect(connectPromise).rejects.toThrow('socket closed before ready');
  });

  it('ignores unparseable / unknown-shaped messages without crashing', async () => {
    const socket = new FakeSocket();
    const transport = new VoiceTransport(() => socket);
    const events: string[] = [];

    const connectPromise = transport.connect('tok', config, {
      onEvent: (ev) => events.push(ev.type),
      onClose: () => {},
      onSocketError: () => {},
    });

    socket.open();
    socket.emit('message', { data: 'not json{{{' });
    socket.emit('message', { data: JSON.stringify({ no_type_field: true }) });
    socket.message({ type: 'session.ready', session_id: 's1', expires_at: 1 });

    await expect(connectPromise).resolves.toBeUndefined();
    expect(events).toEqual(['session.ready']);
  });

  it('calls onClose for a close that happens after the handshake settled', async () => {
    const socket = new FakeSocket();
    const transport = new VoiceTransport(() => socket);
    let closedWith: [number, string] | null = null;

    const connectPromise = transport.connect('tok', config, {
      onEvent: () => {},
      onClose: (code, reason) => {
        closedWith = [code, reason];
      },
      onSocketError: () => {},
    });
    socket.open();
    socket.message({ type: 'session.ready', session_id: 's1', expires_at: 1 });
    await connectPromise;

    socket.emit('close', { code: 1000, reason: 'done' });
    expect(closedWith).toEqual([1000, 'done']);
  });
});

describe('VoiceTransport send gating', () => {
  it('does not send frames while the socket is not OPEN', () => {
    const socket = new FakeSocket();
    const transport = new VoiceTransport(() => socket);
    void transport.connect('tok', config, noHandlers);
    // socket never opened (readyState stays CONNECTING), so no session.update was sent either.
    transport.sendAudio('AAAA');
    expect(socket.sent).toHaveLength(0);
  });

  it('sends tool.result with call_id/result/is_error once OPEN', async () => {
    const socket = new FakeSocket();
    const transport = new VoiceTransport(() => socket);
    const connectPromise = transport.connect('tok', config, noHandlers);
    socket.open();
    socket.message({ type: 'session.ready', session_id: 's1', expires_at: 1 });
    await connectPromise;

    transport.sendToolResult('call1', '{"ok":true}', false);
    expect(JSON.parse(socket.sent[socket.sent.length - 1])).toEqual({
      type: 'tool.result',
      call_id: 'call1',
      result: '{"ok":true}',
      is_error: false,
    });
  });

  it('close() tears down the socket reference so further sends are no-ops', async () => {
    const socket = new FakeSocket();
    const transport = new VoiceTransport(() => socket);
    const connectPromise = transport.connect('tok', config, noHandlers);
    socket.open();
    socket.message({ type: 'session.ready', session_id: 's1', expires_at: 1 });
    await connectPromise;

    const sentBeforeClose = socket.sent.length; // the initial session.update sent on open
    transport.close();
    transport.sendAudio('AAAA');
    expect(socket.sent).toHaveLength(sentBeforeClose);
  });
});

describe('VoiceTransport.endAndClose graceful shutdown', () => {
  it('sends session.end immediately and closes the socket after the timeout', async () => {
    vi.useFakeTimers();
    const socket = new FakeSocket();
    const transport = new VoiceTransport(() => socket);
    const connectPromise = transport.connect('tok', config, noHandlers);
    socket.open();
    socket.message({ type: 'session.ready', session_id: 's1', expires_at: 1 });
    await connectPromise;

    transport.endAndClose(2000);
    expect(socket.sentMessages().at(-1)).toEqual({ type: 'session.end' });
    expect(socket.readyState).toBe(1); // not closed yet

    vi.advanceTimersByTime(2000);
    expect(socket.readyState).toBe(3); // closed

    vi.useRealTimers();
  });

  it('a stale endAndClose timer never closes a NEWER session started in the meantime (stop -> quick restart)', async () => {
    vi.useFakeTimers();
    const oldSocket = new FakeSocket();
    const newSocket = new FakeSocket();
    const sockets = [oldSocket, newSocket];
    const transport = new VoiceTransport(() => sockets.shift()!);

    // Old session: connect then gracefully end it (2s grace timer starts).
    const oldConnect = transport.connect('tok', config, noHandlers);
    oldSocket.open();
    oldSocket.message({ type: 'session.ready', session_id: 'old', expires_at: 1 });
    await oldConnect;
    transport.endAndClose(2000);

    // A new session starts on the SAME transport instance before the old
    // grace timer fires (e.g. stop() immediately followed by start()).
    const newConnect = transport.connect('tok', config, noHandlers);
    newSocket.open();
    newSocket.message({ type: 'session.ready', session_id: 'new', expires_at: 1 });
    await newConnect;

    vi.advanceTimersByTime(2000);

    expect(oldSocket.readyState).toBe(3); // old socket still gets physically closed
    expect(newSocket.readyState).toBe(1); // new session's socket is untouched

    // The new session must still be able to send.
    transport.sendToolResult('c1', 'r', false);
    expect(newSocket.sentMessages().at(-1)).toEqual({
      type: 'tool.result',
      call_id: 'c1',
      result: 'r',
      is_error: false,
    });

    vi.useRealTimers();
  });

  it('is a no-op when there is no active socket', () => {
    const transport = new VoiceTransport(() => new FakeSocket());
    expect(() => transport.endAndClose(2000)).not.toThrow();
  });
});

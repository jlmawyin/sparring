// Thin wrapper around the AssemblyAI Voice Agent WebSocket. Owns only wire
// framing and the connect/ready handshake; conversation/session logic lives
// in controller.ts. Event field names verified against AssemblyAI docs:
// events-reference, browser-integration, tools/client-side-tools,
// turn-detection-and-interruptions (all under assemblyai.com/docs/voice-agents/voice-agent-api).

export const VOICE_AGENT_WS_BASE = 'wss://agents.assemblyai.com/v1/ws';

export type ServerEvent =
  | { type: 'session.ready'; session_id: string; expires_at: number; resume_token?: string; config?: unknown }
  | { type: 'session.updated'; config?: unknown }
  | { type: 'session.ended'; session_duration_seconds?: number; audio_duration_seconds?: number | null; timestamp?: number }
  | { type: 'input.speech.started' }
  | { type: 'input.speech.stopped' }
  | { type: 'transcript.user.delta'; item_id: string; text: string }
  | { type: 'transcript.user'; item_id: string; text: string }
  | { type: 'reply.started'; reply_id: string; item_id?: string }
  | { type: 'reply.audio'; data: string }
  | { type: 'transcript.agent.delta'; reply_id: string; item_id: string; delta: string; start_ms?: number | null; end_ms?: number | null }
  | { type: 'transcript.agent'; text: string; reply_id: string; item_id: string; interrupted: boolean }
  | { type: 'reply.done'; reply_id: string; status: 'completed' | 'interrupted' }
  | { type: 'tool.call'; call_id: string; name: string; arguments: Record<string, unknown> }
  | { type: 'session.error'; code: string; message: string; timestamp?: string; param?: string };

export interface MinimalWebSocket {
  readyState: number;
  send(data: string): void;
  close(code?: number, reason?: string): void;
  addEventListener(type: 'open' | 'message' | 'close' | 'error', listener: (ev: any) => void): void;
  removeEventListener(type: 'open' | 'message' | 'close' | 'error', listener: (ev: any) => void): void;
}

export type WebSocketFactory = (url: string) => MinimalWebSocket;

export interface TransportHandlers {
  onEvent(event: ServerEvent): void;
  onClose(code: number, reason: string): void;
  onSocketError(): void;
}

export class VoiceTransport {
  private socket: MinimalWebSocket | null = null;

  constructor(private readonly wsFactory: WebSocketFactory) {}

  /**
   * Opens the socket, sends `initialConfig` as session.update the moment it
   * is OPEN (not after ready — AAI expects config before it emits
   * session.ready; waiting for ready first would deadlock), then resolves
   * once session.ready arrives. Rejects on error/timeout/close before ready.
   */
  connect(
    token: string,
    initialConfig: Record<string, unknown>,
    handlers: TransportHandlers,
    timeoutMs = 10000,
  ): Promise<void> {
    const url = `${VOICE_AGENT_WS_BASE}?token=${encodeURIComponent(token)}`;
    const socket = this.wsFactory(url);
    this.socket = socket;

    return new Promise((resolve, reject) => {
      let settled = false;
      const timer = setTimeout(() => {
        if (settled) return;
        settled = true;
        cleanup();
        reject(new Error('handshake timeout'));
      }, timeoutMs);

      const onOpen = () => {
        this.sendOn(socket, { type: 'session.update', session: initialConfig });
      };
      const onMessage = (ev: { data: string }) => {
        let parsed: ServerEvent;
        try {
          parsed = JSON.parse(ev.data);
        } catch {
          return; // ignore unparseable messages, do not crash.
        }
        if (!parsed || typeof (parsed as any).type !== 'string') return;
        if (!settled && parsed.type === 'session.ready') {
          settled = true;
          clearTimeout(timer);
          handlers.onEvent(parsed);
          resolve();
          return;
        }
        handlers.onEvent(parsed);
      };
      const onClose = (ev: { code: number; reason: string }) => {
        if (!settled) {
          settled = true;
          clearTimeout(timer);
          reject(new Error('socket closed before ready'));
        }
        handlers.onClose(ev.code, ev.reason ?? '');
      };
      const onError = () => {
        if (!settled) {
          settled = true;
          clearTimeout(timer);
          reject(new Error('socket error before ready'));
        }
        handlers.onSocketError();
      };

      function cleanup() {
        socket.removeEventListener('open', onOpen);
        socket.removeEventListener('message', onMessage);
        socket.removeEventListener('close', onClose);
        socket.removeEventListener('error', onError);
      }

      socket.addEventListener('open', onOpen);
      socket.addEventListener('message', onMessage);
      socket.addEventListener('close', onClose);
      socket.addEventListener('error', onError);
      // Some fakes/native sockets may already be OPEN by the time listeners attach.
      if (socket.readyState === 1) onOpen();
    });
  }

  sendSessionUpdate(session: Record<string, unknown>): void {
    this.send({ type: 'session.update', session });
  }

  sendAudio(base64: string): void {
    this.send({ type: 'input.audio', audio: base64 });
  }

  sendToolResult(callId: string, result: string, isError = false): void {
    this.send({ type: 'tool.result', call_id: callId, result, is_error: isError });
  }

  sendReplyCreate(instructions?: string): void {
    this.send({ type: 'reply.create', ...(instructions ? { instructions } : {}) });
  }

  sendSessionEnd(): void {
    this.send({ type: 'session.end' });
  }

  private send(payload: Record<string, unknown>): void {
    if (!this.socket) return;
    this.sendOn(this.socket, payload);
  }

  private sendOn(socket: MinimalWebSocket, payload: Record<string, unknown>): void {
    if (socket.readyState !== 1 /* OPEN */) return;
    socket.send(JSON.stringify(payload));
  }

  close(): void {
    this.socket?.close();
    this.socket = null;
  }

  /**
   * Graceful shutdown: send session.end on the CURRENT socket, then close
   * that same socket reference after `timeoutMs` regardless of whether a
   * newer connect() has since replaced `this.socket` — a stale timer must
   * never tear down a session that has already been superseded by a new
   * start().
   */
  endAndClose(timeoutMs: number): void {
    const socket = this.socket;
    if (!socket) return;
    this.sendOn(socket, { type: 'session.end' });
    setTimeout(() => {
      try {
        socket.close();
      } catch {
        /* already closed */
      }
      if (this.socket === socket) this.socket = null;
    }, timeoutMs);
  }
}

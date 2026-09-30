// Tracks in-flight tool.call -> tool.result lifecycle against the
// AssemblyAI reply/turn timeline so results are only sent while still
// valid. Per AssemblyAI's Client-side tools docs (Voice Agent API,
// "tools/client-side-tools", the ordering rule spelled out around the
// flush_if_idle example): send tool.result ONLY while reply.done is the
// LATEST event seen — never while a reply.started or input.speech.started
// has arrived more recently than the last reply.done. A call becomes
// eligible only after its OWN reply.done(completed); an interrupted reply
// discards it outright.
//
// Per AssemblyAI's events reference, a tool.call always arrives bound to a
// reply: either an ordinary spoken reply, or a silent tool-only reply whose
// reply_id follows the `fc-<call_id>` convention. reply.done ALWAYS carries
// reply_id + status, never a bare `{type:'reply.done'}`. Event ordering
// between a tool-call reply's reply.started/reply.done and the tool.call
// event itself is not guaranteed relative to our own processing, so a
// tool.call that arrives with no reply currently open is bound to the
// expected `fc-<call_id>` reply id and, per the docs' flush_if_idle
// pattern, is immediately closeable if that reply's reply.done already
// arrived — otherwise it waits for that reply's own future reply.done.

export type ToolGateStatus = 'pending' | 'ready' | 'sent' | 'cancelled';

interface CallRecord {
  callId: string;
  argsHash: string;
  replyId: string;
  status: ToolGateStatus;
  result?: { payload: string; isError: boolean };
  /** True once this call's OWN reply.done(completed) has arrived. */
  closed: boolean;
}

export interface RegisterOutcome {
  /** First time this call_id has been seen. */
  isNew: boolean;
  /** Same call_id + same argument hash as before: replay the cached result. */
  cached?: { payload: string; isError: boolean };
  /** Same call_id but different argument hash: caller must reject/error, never process. */
  conflict: boolean;
}

export class ToolResultGate {
  private readonly calls = new Map<string, CallRecord>();
  /** reply_id of the reply currently open (started, not yet done). */
  private openReplyId: string | null = null;
  /** Terminal status of every reply.done seen so far, keyed by reply_id. */
  private readonly finishedReplies = new Map<string, 'completed' | 'interrupted'>();
  /** True whenever the LATEST protocol event was reply.started or input.speech.started (never sendable while true). */
  private turnOpen = false;

  register(callId: string, argsHash: string): RegisterOutcome {
    const existing = this.calls.get(callId);
    if (!existing) {
      // Bind to whichever reply is currently open; if none is open (e.g. this
      // tool.call arrived before its own reply.started, or after its own
      // reply.done), fall back to the documented `fc-<call_id>` reply id.
      const replyId = this.openReplyId ?? `fc-${callId}`;
      const finished = this.finishedReplies.get(replyId);
      this.calls.set(callId, {
        callId,
        argsHash,
        replyId,
        status: finished === 'interrupted' ? 'cancelled' : 'pending',
        closed: finished === 'completed',
      });
      return { isNew: true, conflict: false };
    }
    if (existing.argsHash !== argsHash) {
      return { isNew: false, conflict: true };
    }
    if (existing.status === 'sent' || existing.status === 'ready') {
      return { isNew: false, conflict: false, cached: existing.result };
    }
    return { isNew: false, conflict: false };
  }

  onReplyStarted(replyId: string): void {
    this.openReplyId = replyId;
    this.turnOpen = true;
  }

  /**
   * input.speech.started: a new user turn is beginning. Per the docs'
   * ordering rule this makes the gate not-idle again — nothing may be sent
   * until the next reply.done becomes the latest event — but it must NOT
   * discard any pending call's eventual eligibility. Discarding a call is
   * only ever driven by that call's own reply.done(interrupted).
   */
  onUserSpeechStarted(): void {
    this.turnOpen = true;
  }

  /** Attach a completed HTTP evaluation (or validation error) result. */
  setResult(callId: string, payload: string, isError: boolean): void {
    const record = this.calls.get(callId);
    if (!record || record.status === 'cancelled') return;
    record.result = { payload, isError };
    record.status = 'ready';
  }

  /**
   * reply.done for `replyId`. status 'completed' marks calls tied to that
   * reply as closeable (sendable once ready and once the gate is idle
   * again); 'interrupted' cancels them outright so a stale result can never
   * be sent. Also records this reply.done as the latest event, opening the
   * gate for any other call already ready and closed.
   */
  onReplyDone(replyId: string, status: 'completed' | 'interrupted'): void {
    if (this.openReplyId === replyId) this.openReplyId = null;
    this.finishedReplies.set(replyId, status);
    this.turnOpen = false;
    for (const record of this.calls.values()) {
      if (record.replyId !== replyId) continue;
      if (status === 'interrupted') {
        if (record.status !== 'sent') record.status = 'cancelled';
      } else {
        record.closed = true;
      }
    }
  }

  /**
   * True only once: this call's OWN reply has completed (not merely
   * started), a result is attached, AND reply.done is still the latest
   * protocol event (no newer reply.started/input.speech.started since).
   */
  canSend(callId: string): boolean {
    if (this.turnOpen) return false;
    const record = this.calls.get(callId);
    if (!record || record.status !== 'ready') return false;
    return record.closed;
  }

  /** call_ids whose result is ready to send under the current gate state. */
  readyToSend(): string[] {
    if (this.turnOpen) return [];
    const ids: string[] = [];
    for (const [id, record] of this.calls) {
      if (record.status === 'ready' && record.closed) {
        ids.push(id);
      }
    }
    return ids;
  }

  getResult(callId: string): { payload: string; isError: boolean } | undefined {
    return this.calls.get(callId)?.result;
  }

  markSent(callId: string): void {
    const record = this.calls.get(callId);
    if (record) record.status = 'sent';
  }

  cancel(callId: string): void {
    const record = this.calls.get(callId);
    if (record && record.status !== 'sent') record.status = 'cancelled';
  }

  statusOf(callId: string): ToolGateStatus | undefined {
    return this.calls.get(callId)?.status;
  }

  reset(): void {
    this.calls.clear();
    this.openReplyId = null;
    this.finishedReplies.clear();
    this.turnOpen = false;
  }
}

/** Deep, key-order-independent canonical JSON (objects only; arrays keep order). */
function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(value as object).sort()) {
      out[key] = canonicalize((value as Record<string, unknown>)[key]);
    }
    return out;
  }
  return value;
}

/** Canonical fingerprint: keep the JSON itself to avoid hash collisions. */
export function hashArgs(args: unknown): string {
  return JSON.stringify(canonicalize(args)) ?? 'undefined';
}

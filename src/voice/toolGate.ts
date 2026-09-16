// Tracks in-flight tool.call -> tool.result lifecycle against the
// AssemblyAI reply/turn timeline so results are only sent while still
// valid: strictly after their OWN reply.done(completed) — never while that
// reply is still open — and never after a newer reply or user speech has
// started (which means the conversation moved on and the result is stale).
// Every outcome (success, unknown_tool, argument conflict, quote-not-found)
// flows through this same gate so nothing is ever sent out of turn.

export type ToolGateStatus = 'pending' | 'ready' | 'sent' | 'cancelled';

interface CallRecord {
  callId: string;
  argsHash: string;
  replyId: string | null;
  status: ToolGateStatus;
  result?: { payload: string; isError: boolean };
  /** Sequence value at which this call's OWN reply completed (undefined = not done yet). */
  closedAtSeq?: number;
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
  /** Monotonic counter bumped by any event that can invalidate a pending result. */
  private sequence = 0;

  register(callId: string, argsHash: string): RegisterOutcome {
    const existing = this.calls.get(callId);
    if (!existing) {
      this.calls.set(callId, {
        callId,
        argsHash,
        replyId: this.openReplyId,
        status: 'pending',
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
    this.sequence += 1;
    this.openReplyId = replyId;
  }

  /** input.speech.started: the user is talking again, invalidate anything not sent yet. */
  onUserSpeechStarted(): void {
    this.sequence += 1;
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
   * reply as closeable (sendable) as of the CURRENT sequence; 'interrupted'
   * cancels them outright so a stale result can never be sent.
   */
  onReplyDone(replyId: string, status: 'completed' | 'interrupted'): void {
    if (this.openReplyId === replyId) this.openReplyId = null;
    for (const record of this.calls.values()) {
      if (record.replyId !== replyId) continue;
      if (status === 'interrupted') {
        if (record.status !== 'sent') record.status = 'cancelled';
      } else {
        record.closedAtSeq = this.sequence;
      }
    }
  }

  /**
   * True only once this call's OWN reply has completed (not merely started)
   * and no newer reply/speech has begun since — a call is never sendable
   * while its reply is still open, and becomes permanently stale the
   * instant something newer starts.
   */
  canSend(callId: string): boolean {
    const record = this.calls.get(callId);
    if (!record || record.status !== 'ready') return false;
    if (record.closedAtSeq === undefined) return false; // reply not done yet
    return record.closedAtSeq === this.sequence;
  }

  /** call_ids whose result is ready to send under the current gate state. */
  readyToSend(): string[] {
    const ids: string[] = [];
    for (const [id, record] of this.calls) {
      if (record.status === 'ready' && record.closedAtSeq === this.sequence) {
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
    this.sequence = 0;
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

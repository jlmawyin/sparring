// Sparring browser voice adapter. Orchestrates: app HTTP contracts (api.ts),
// the AssemblyAI Voice Agent WebSocket (transport.ts), mic capture +
// resampling (resampler.ts, public/pcm-capture.js), agent playback
// (playback.ts), and the tool.call -> tool.result lifecycle (toolGate.ts).
//
// Protocol field names verified against AssemblyAI docs (WebFetch, this
// session): events-reference, browser-integration, tools/client-side-tools,
// turn-detection-and-interruptions — all under
// assemblyai.com/docs/voice-agents/voice-agent-api. No API key is ever read
// or held client-side; only the ephemeral token from /api/session/start.

import type {
  EvaluateRequest,
  ScenarioBrief,
  Turn,
  VoiceCallbacks,
  VoiceController,
  VoiceState,
} from '../shared/types';
import { endSession, evaluate, finishSession, startSession } from './api';
import { attemptEvaluate } from './evaluateRecovery';
import { floatToPCM16, pcm16ToBase64 } from './pcm';
import { PlaybackQueue, type PlaybackAudioContext } from './playback';
import { ContinuousResampler } from './resampler';
import { hashArgs, ToolResultGate, type RegisterOutcome } from './toolGate';
import type { ServerEvent, WebSocketFactory } from './transport';
import { VoiceTransport } from './transport';
// spec/tools.json is the shared contract read directly; not owned/modified here.
import toolsSpec from '../../spec/tools.json';

const ROLEPLAY_MAX_MS = 180_000;
const HANDSHAKE_TIMEOUT_MS = 10_000;
const FINISH_DRAIN_MS = 5_000;
const STOP_CLOSE_TIMEOUT_MS = 2_000;
const COACHING_BUDGET_MS = 40_000;
const TOOL_EVAL_TIMEOUT_MS = 3_000;
const QUOTE_WAIT_MS = 1_000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error('timeout')), ms);
  });
  try {
    return await Promise.race([p, timeout]);
  } finally {
    clearTimeout(timer!);
  }
}

function resolveTurnId(
  turns: Turn[],
  role: 'USER' | 'AGENT',
  quote: string,
  occurrence: number,
): string | null {
  // SDD: "cita textual exacta" resolved as containment within the turn,
  // not full-turn equality (a turn may include the quote plus more speech).
  const matches = turns.filter((t) => t.role === role && t.text.includes(quote));
  const turn = matches[occurrence - 1];
  return turn ? turn.turn_id : null;
}

interface QuoteCheck {
  role: 'USER' | 'AGENT';
  quote: string;
  occurrence: number;
}

/**
 * spec/tools.json shapes: log_objection has a single top-level
 * quote/occurrence anchored to an AGENT turn; score_rubric carries an
 * `observations[]` array, each anchored to a USER turn. There is no
 * top-level `arguments.quote` for score_rubric.
 */
function extractQuoteChecks(
  name: 'score_rubric' | 'log_objection',
  args: Record<string, unknown>,
): QuoteCheck[] {
  if (name === 'log_objection') {
    const quote = args?.quote;
    const occurrence = typeof args?.occurrence === 'number' ? args.occurrence : 1;
    if (typeof quote !== 'string' || quote.length === 0) return [];
    return [{ role: 'AGENT', quote, occurrence }];
  }
  const observations = Array.isArray(args?.observations) ? args.observations : [];
  const checks: QuoteCheck[] = [];
  for (const obs of observations) {
    if (!obs || typeof obs !== 'object') continue;
    const quote = (obs as Record<string, unknown>).quote;
    if (typeof quote !== 'string' || quote.length === 0) continue;
    const occurrenceRaw = (obs as Record<string, unknown>).occurrence;
    checks.push({
      role: 'USER',
      quote,
      occurrence: typeof occurrenceRaw === 'number' ? occurrenceRaw : 1,
    });
  }
  return checks;
}

export interface VoiceControllerDeps {
  wsFactory?: WebSocketFactory;
  getUserMedia?: (constraints: MediaStreamConstraints) => Promise<MediaStream>;
  createAudioContext?: (options?: AudioContextOptions) => AudioContext;
  now?: () => number;
}

function defaultWsFactory(url: string): ReturnType<WebSocketFactory> {
  return new WebSocket(url) as unknown as ReturnType<WebSocketFactory>;
}

export function createVoiceController(
  callbacks: VoiceCallbacks,
  deps: VoiceControllerDeps = {},
): VoiceController {
  const merged = {
    wsFactory: deps.wsFactory ?? defaultWsFactory,
    getUserMedia: deps.getUserMedia ?? ((c: MediaStreamConstraints) => navigator.mediaDevices.getUserMedia(c)),
    createAudioContext: deps.createAudioContext ?? ((o?: AudioContextOptions) => new AudioContext(o)),
    now: deps.now ?? (() => Date.now()),
  };

  let generation = 0;
  let state: VoiceState = 'idle';

  let sessionContext: string | null = null;
  let deadline = 0; // epoch ms, absolute cap from server max_seconds
  let revision = 0; // last ACCEPTED revision (server-confirmed), starts at 0
  let scoreFrozen = false;
  let lastEvaluateAttempt: EvaluateRequest | null = null;
  const transcriptFinal: Turn[] = [];
  let turnCounter = 0;
  const agentDeltaBuffers = new Map<string, string>();
  const pendingEvals = new Set<string>(); // call_ids with an in-flight /api/evaluate
  let queuedEvals = 0;
  const seenProviderItems = new Set<string>();
  let evalQueue: Promise<void> = Promise.resolve(); // serializes tool.call processing

  let onSessionUpdated: (() => void) | null = null;
  let onCoachReplyDone: (() => void) | null = null;

  const gate = new ToolResultGate();
  const transport = new VoiceTransport(merged.wsFactory);

  let mediaStream: MediaStream | null = null;
  let audioContext: AudioContext | null = null;
  let workletNode: AudioWorkletNode | null = null;
  let micSource: MediaStreamAudioSourceNode | null = null;
  let resampler: ContinuousResampler | null = null;
  let micEnabled = false;

  let playbackCtx: AudioContext | null = null;
  let playback: PlaybackQueue | null = null;

  let roleplayTimer: ReturnType<typeof setTimeout> | null = null;
  let globalDeadlineTimer: ReturnType<typeof setTimeout> | null = null;

  function setState(next: VoiceState): void {
    state = next;
    callbacks.onState(next);
  }

  function clearTimers(): void {
    if (roleplayTimer) clearTimeout(roleplayTimer);
    if (globalDeadlineTimer) clearTimeout(globalDeadlineTimer);
    roleplayTimer = null;
    globalDeadlineTimer = null;
  }

  function stopCaptureGraph(): void {
    micEnabled = false;
    try {
      workletNode?.port.postMessage('stop');
    } catch {
      /* ignore */
    }
    workletNode?.disconnect();
    micSource?.disconnect();
    mediaStream?.getTracks().forEach((t) => t.stop());
    workletNode = null;
    micSource = null;
    mediaStream = null;
    resampler = null;
    if (audioContext && audioContext.state !== 'closed') {
      void audioContext.close().catch(() => {});
    }
    audioContext = null;
  }

  function stopPlaybackGraph(): void {
    playback?.flush();
    playback = null;
    if (playbackCtx && playbackCtx.state !== 'closed') {
      void playbackCtx.close().catch(() => {});
    }
    playbackCtx = null;
  }

  /**
   * graceful=true: send session.end and wait up to STOP_CLOSE_TIMEOUT_MS
   * before closing (normal end-of-session paths, avoids consuming the
   * provider's reconnection-grace window). graceful=false: the socket is
   * already dead/never opened (error/handshake-failure paths) — close now.
   */
  function fullCleanup(opts: { graceful: boolean } = { graceful: false }): void {
    clearTimers();
    stopCaptureGraph();
    stopPlaybackGraph();
    if (opts.graceful) transport.endAndClose(STOP_CLOSE_TIMEOUT_MS);
    else transport.close();
    gate.reset();
    agentDeltaBuffers.clear();
    pendingEvals.clear();
    onSessionUpdated = null;
    onCoachReplyDone = null;
  }

  function releaseServerSession(): void {
    const ctx = sessionContext;
    sessionContext = null;
    if (ctx) endSession(ctx);
  }

  function nextAppTurnId(): string {
    turnCounter += 1;
    return `turn_${turnCounter}`;
  }

  function sendToolResult(callId: string): void {
    const result = gate.getResult(callId);
    if (!result) return;
    transport.sendToolResult(callId, result.payload, result.isError);
    gate.markSent(callId);
  }

  function flushReadyToolResults(): void {
    for (const callId of gate.readyToSend()) {
      sendToolResult(callId);
    }
  }

  /** True while new tool.call handling should be rejected outright. */
  function toolCallsClosed(): boolean {
    return state === 'coaching' || state === 'ending' || state === 'ended' || state === 'error';
  }

  async function handleToolCall(
    ev: Extract<ServerEvent, { type: 'tool.call' }>,
    myGeneration: number,
    outcome: RegisterOutcome,
  ): Promise<void> {
    if (myGeneration !== generation || toolCallsClosed()) return;
    if (outcome.conflict) {
      gate.setResult(ev.call_id, JSON.stringify({ error: 'call_id_argument_conflict' }), true);
      flushReadyToolResults();
      return;
    }
    if (outcome.cached) {
      flushReadyToolResults();
      return;
    }
    if (!outcome.isNew) return; // identical call already in flight

    if (ev.name !== 'score_rubric' && ev.name !== 'log_objection') {
      gate.setResult(ev.call_id, JSON.stringify({ error: 'unknown_tool' }), true);
      flushReadyToolResults();
      return;
    }
    if (!ev.arguments || typeof ev.arguments !== 'object') {
      gate.setResult(ev.call_id, JSON.stringify({ error: 'invalid_arguments' }), true);
      flushReadyToolResults();
      return;
    }

    const checks = extractQuoteChecks(ev.name, ev.arguments);
    const allResolved = () =>
      checks.length > 0 &&
      checks.every((c) => resolveTurnId(transcriptFinal, c.role, c.quote, c.occurrence) !== null);

    if (!allResolved()) {
      const waitDeadline = merged.now() + QUOTE_WAIT_MS;
      while (!allResolved() && merged.now() < waitDeadline) {
        await sleep(50);
        if (myGeneration !== generation) return;
      }
    }
    if (!allResolved()) {
      gate.setResult(ev.call_id, JSON.stringify({ error: 'quote_not_found' }), true);
      flushReadyToolResults();
      return;
    }

    if (!sessionContext) return;
    const req: EvaluateRequest = {
      session_context: sessionContext,
      revision, // current server-accepted revision; never pre-incremented client-side
      tool_call_id: ev.call_id,
      tool_name: ev.name,
      arguments: ev.arguments,
      transcript_final: transcriptFinal.slice(),
    };

    pendingEvals.add(ev.call_id);
    try {
      const attempt = await attemptEvaluate(req, evaluate, TOOL_EVAL_TIMEOUT_MS, lastEvaluateAttempt);
      // A stop()/start() during this await bumps generation and resets
      // lastEvaluateAttempt for the new session; never let this stale
      // envelope clobber it after the fact.
      if (myGeneration !== generation) return;
      lastEvaluateAttempt = attempt.sent;
      const snapshot = attempt.status === 'accepted' ? attempt.response.snapshot : attempt.recovered?.snapshot;
      if (snapshot && !scoreFrozen && snapshot.revision > revision) {
        revision = snapshot.revision;
        callbacks.onSnapshot(snapshot);
      }
      if (attempt.status === 'accepted') {
        gate.setResult(ev.call_id, JSON.stringify(attempt.response.result), false);
      } else {
        gate.setResult(ev.call_id, JSON.stringify({ error: 'evaluate_failed_or_timeout' }), true);
        callbacks.onError('No se pudo evaluar la herramienta a tiempo.');
      }
    } catch {
      if (myGeneration !== generation) return;
      lastEvaluateAttempt = req;
      gate.setResult(ev.call_id, JSON.stringify({ error: 'evaluate_failed_or_timeout' }), true);
      callbacks.onError('No se pudo evaluar la herramienta a tiempo.');
    } finally {
      // A call_id can be reused by a later generation; only this generation's
      // own entry may be cleared, or a late finisher could erase a new
      // in-flight eval and let finish()'s drain end early.
      if (myGeneration === generation) pendingEvals.delete(ev.call_id);
    }
    flushReadyToolResults();
  }

  /** Serialize tool.call processing so revision tracking stays correct. */
  function enqueueToolCall(ev: Extract<ServerEvent, { type: 'tool.call' }>, myGeneration: number): void {
    if (toolCallsClosed()) return;
    // Bind to the reply at arrival, before an earlier HTTP request delays this job.
    const outcome = gate.register(ev.call_id, hashArgs({name: ev.name, arguments: ev.arguments}));
    queuedEvals += 1;
    evalQueue = evalQueue.then(() => handleToolCall(ev, myGeneration, outcome)).catch(() => {
      if (myGeneration === generation) callbacks.onError('No se pudo procesar una observación.');
    }).finally(() => { if (myGeneration === generation) queuedEvals -= 1; });
  }

  function onServerEvent(ev: ServerEvent, myGeneration: number): void {
    if (myGeneration !== generation) return;
    callbacks.onEvent?.(ev.type);

    switch (ev.type) {
      case 'session.ready':
        // handled by the connect() promise for gating mic start; no-op here.
        break;
      case 'session.updated':
        if (state === 'coaching') onSessionUpdated?.();
        break;
      case 'input.speech.started':
        // A new user turn is beginning: any not-yet-sent tool result from
        // the prior turn is now stale (never audio-flushed here — the
        // documented barge-in signal is reply.done status "interrupted").
        gate.onUserSpeechStarted();
        break;
      case 'transcript.user.delta':
        callbacks.onPartial('USER', ev.text);
        break;
      case 'transcript.user': {
        if (typeof ev.text !== 'string' || !ev.text) break;
        if (ev.item_id && seenProviderItems.has(`USER:${ev.item_id}`)) break;
        if (ev.item_id) seenProviderItems.add(`USER:${ev.item_id}`);
        const turn: Turn = {
          turn_id: nextAppTurnId(),
          role: 'USER',
          text: ev.text,
          received_at_ms: merged.now(),
        };
        transcriptFinal.push(turn);
        callbacks.onTurn(turn);
        break;
      }
      case 'reply.started':
        gate.onReplyStarted(ev.reply_id);
        agentDeltaBuffers.set(ev.reply_id, '');
        break;
      case 'transcript.agent.delta': {
        const prev = agentDeltaBuffers.get(ev.reply_id) ?? '';
        const next = prev + ev.delta;
        agentDeltaBuffers.set(ev.reply_id, next);
        callbacks.onPartial('AGENT', next);
        break;
      }
      case 'transcript.agent': {
        if (typeof ev.text !== 'string' || !ev.text) break;
        if (ev.item_id && seenProviderItems.has(`AGENT:${ev.item_id}`)) break;
        if (ev.item_id) seenProviderItems.add(`AGENT:${ev.item_id}`);
        const turn: Turn = {
          turn_id: nextAppTurnId(),
          role: 'AGENT',
          text: ev.text,
          received_at_ms: merged.now(),
          interrupted: ev.interrupted,
        };
        transcriptFinal.push(turn);
        callbacks.onTurn(turn);
        agentDeltaBuffers.delete(ev.reply_id);
        break;
      }
      case 'reply.audio':
        if (state === 'roleplay' || state === 'coaching') {
          try { if (typeof ev.data === 'string') playback?.enqueueBase64(ev.data); }
          catch { callbacks.onError('Se descartó un fragmento de audio inválido.'); }
        }
        break;
      case 'reply.done':
        gate.onReplyDone(ev.reply_id, ev.status);
        if (ev.status === 'interrupted') {
          playback?.flush();
        } else {
          flushReadyToolResults();
        }
        if (state === 'coaching') onCoachReplyDone?.();
        break;
      case 'tool.call':
        enqueueToolCall(ev, myGeneration);
        break;
      case 'session.error':
        // Never forward the provider's raw message verbatim: it may carry
        // upstream details we don't want surfaced. Normalize to the code.
        callbacks.onError(`Error del proveedor de voz (${ev.code || 'desconocido'}).`);
        break;
      case 'session.ended':
        if (state !== 'ending' && state !== 'ended') {
          setState('error');
          callbacks.onError('La sesión de voz terminó de forma inesperada.');
          fullCleanup({ graceful: false });
          releaseServerSession();
          generation += 1;
          setState('ended');
        }
        break;
      default:
        break;
    }
  }

  function onSocketClosedUnexpectedly(): void {
    if (state === 'ending' || state === 'ended' || state === 'idle') return;
    setState('error');
    callbacks.onError('Se perdió la conexión de voz.');
    fullCleanup({ graceful: false });
    releaseServerSession();
    generation += 1;
    setState('ended');
  }

  async function setupCaptureGraph(myGeneration: number): Promise<void> {
    if (!mediaStream) throw new Error('no media stream');
    const ctx = merged.createAudioContext();
    audioContext = ctx;
    resampler = new ContinuousResampler(ctx.sampleRate, 24000);
    await ctx.audioWorklet.addModule('/pcm-capture.js');
    if (myGeneration !== generation) return;
    // Autoplay policies may leave a freshly created context suspended even
    // inside a user-gesture chain; resume explicitly or nothing processes.
    if (ctx.state === 'suspended') {
      await ctx.resume().catch(() => {});
    }
    if (myGeneration !== generation) return;

    micSource = ctx.createMediaStreamSource(mediaStream);
    workletNode = new AudioWorkletNode(ctx, 'pcm-capture');
    workletNode.port.onmessage = (ev: MessageEvent) => {
      if (myGeneration !== generation || !micEnabled) return;
      const data = ev.data as { type: string; samples: Float32Array };
      if (data?.type !== 'pcm-chunk' || !resampler) return;
      const resampled = resampler.process(data.samples);
      if (resampled.length === 0) return;
      const pcm16 = floatToPCM16(resampled);
      transport.sendAudio(pcm16ToBase64(pcm16));
    };
    micSource.connect(workletNode);
    // Some engines only pull nodes that are (transitively) connected to the
    // destination. Route through a silent gain so the worklet actually
    // processes without producing audible mic-loopback output.
    const silentSink = ctx.createGain();
    silentSink.gain.value = 0;
    workletNode.connect(silentSink);
    silentSink.connect(ctx.destination);
  }

  async function setupPlaybackGraph(myGeneration: number): Promise<void> {
    // No forced sampleRate: Safari/Firefox handle a forced non-default rate
    // poorly. Each scheduled AudioBuffer is created at 24000Hz explicitly
    // (see playback.ts); WebAudio resamples playback to the context's
    // native rate automatically.
    const ctx = merged.createAudioContext();
    playbackCtx = ctx;
    if (ctx.state === 'suspended') {
      await ctx.resume().catch(() => {});
    }
    if (myGeneration !== generation) return;
    playback = new PlaybackQueue(ctx as unknown as PlaybackAudioContext);
  }

  function armGlobalDeadline(myGeneration: number): void {
    const remaining = Math.max(0, deadline - merged.now());
    globalDeadlineTimer = setTimeout(() => {
      if (myGeneration !== generation) return;
      callbacks.onError('Se alcanzó el límite máximo de sesión.');
      void hardStop(myGeneration);
    }, remaining);
  }

  function armRoleplayTimer(myGeneration: number): void {
    roleplayTimer = setTimeout(() => {
      if (myGeneration !== generation || state !== 'roleplay') return;
      void finish();
    }, ROLEPLAY_MAX_MS);
  }

  /** Normal end-of-session teardown: graceful session.end, then cleanup. */
  async function hardStop(myGeneration: number): Promise<void> {
    if (myGeneration !== generation) return;
    generation += 1;
    setState('ending');
    const ctx = sessionContext;
    sessionContext = null;
    fullCleanup({ graceful: true });
    if (ctx) endSession(ctx);
    setState('ended');
  }

  async function start(scenario: ScenarioBrief): Promise<void> {
    if (state !== 'idle' && state !== 'ended' && state !== 'error') {
      throw new Error('voice controller already active');
    }
    generation += 1;
    const myGeneration = generation;
    transcriptFinal.length = 0;
    turnCounter = 0;
    revision = 0;
    scoreFrozen = false;
    lastEvaluateAttempt = null;
    evalQueue = Promise.resolve();
    queuedEvals = 0;
    seenProviderItems.clear();
    gate.reset();
    agentDeltaBuffers.clear();
    pendingEvals.clear();

    setState('preparing');
    let localStream: MediaStream;
    try {
      localStream = await merged.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: false, channelCount: 1 },
      });
    } catch {
      if (myGeneration !== generation) return;
      callbacks.onError('Permiso de micrófono denegado.');
      fullCleanup({ graceful: false });
      setState('error');
      return;
    }
    if (myGeneration !== generation) {
      // stop() (or a subsequent start()) already moved on; never let this
      // stale stream clobber whatever the current generation is using.
      localStream.getTracks().forEach((t) => t.stop());
      return;
    }
    mediaStream = localStream;

    let startRes;
    try {
      startRes = await startSession({
        scenario_id: scenario.id,
        scenario_version: scenario.version,
        consent: true,
      });
    } catch {
      if (myGeneration !== generation) return;
      callbacks.onError('No se pudo iniciar la sesión.');
      fullCleanup({ graceful: false });
      setState('error');
      return;
    }
    if (myGeneration !== generation) {
      // The HTTP call outlived a cancel: the server already reserved quota
      // for this session_context, release it instead of leaking the budget.
      endSession(startRes.session_context);
      return;
    }

    sessionContext = startRes.session_context;
    deadline = startRes.deadline;

    setState('connecting');
    const tools = toolsSpec as Array<Record<string, unknown>>;
    try {
      await setupCaptureGraph(myGeneration);
      if (myGeneration !== generation) return;
      await setupPlaybackGraph(myGeneration);
      if (myGeneration !== generation) return;
      await transport.connect(
        startRes.token,
        { ...(startRes.session_config ?? {}), tools },
        {
          onEvent: (ev) => onServerEvent(ev, myGeneration),
          onClose: () => { if (myGeneration === generation) onSocketClosedUnexpectedly(); },
          onSocketError: () => { if (myGeneration === generation) onSocketClosedUnexpectedly(); },
        },
        HANDSHAKE_TIMEOUT_MS,
      );
    } catch {
      if (myGeneration !== generation) return;
      callbacks.onError('No se pudo conectar con el servicio de voz.');
      fullCleanup({ graceful: false });
      releaseServerSession();
      setState('error');
      return;
    }
    if (myGeneration !== generation) return;

    micEnabled = true;
    setState('roleplay');
    armRoleplayTimer(myGeneration);
    armGlobalDeadline(myGeneration);
  }

  async function finish(): Promise<void> {
    if (state !== 'roleplay') return;
    const myGeneration = generation;
    setState('finalizing');
    if (roleplayTimer) clearTimeout(roleplayTimer);
    roleplayTimer = null;

    stopCaptureGraph();
    playback?.flush();

    const drainDeadline = merged.now() + FINISH_DRAIN_MS;
    while (merged.now() < drainDeadline) {
      flushReadyToolResults();
      if (queuedEvals === 0 && pendingEvals.size === 0 && gate.readyToSend().length === 0) break;
      await sleep(100);
      if (myGeneration !== generation) return;
    }
    flushReadyToolResults();

    if (!sessionContext) return;
    let finishRes;
    try {
      finishRes = await withTimeout(finishSession(sessionContext), FINISH_DRAIN_MS);
    } catch {
      if (myGeneration !== generation) return;
      callbacks.onError('No se pudo cerrar la evaluación; se conserva el último resultado visible.');
      await hardStop(myGeneration);
      return;
    }
    if (myGeneration !== generation) return;
    scoreFrozen = true; // authoritative snapshot: late/in-flight evals must never mutate it again
    callbacks.onSnapshot(finishRes.snapshot);

    setState('coaching');
    const coachingDeadline = merged.now() + Math.min(COACHING_BUDGET_MS, Math.max(0, deadline - merged.now()));

    try {
      const updated = new Promise<void>(resolve => { onSessionUpdated = resolve; });
      transport.sendSessionUpdate({
        system_prompt: finishRes.coach_prompt,
        tools: [],
      });
      // Wait for the server to ack the new system_prompt before requesting
      // a reply, or reply.create could race the old roleplay prompt.
      await withTimeout(
        updated,
        Math.max(0, coachingDeadline - merged.now()),
      );
      onSessionUpdated = null;
      if (myGeneration !== generation) return;

      const coachDone = new Promise<void>(resolve => { onCoachReplyDone = resolve; });
      transport.sendReplyCreate(finishRes.coach_prompt);
      await withTimeout(
        coachDone,
        Math.max(0, coachingDeadline - merged.now()),
      );
      onCoachReplyDone = null;
      if (myGeneration !== generation) return;

      // End on playback fully drained, not mid-buffer.
      await withTimeout(playback?.whenDrained() ?? Promise.resolve(), 5000).catch(() => {});
    } catch {
      if (myGeneration !== generation) return;
      callbacks.onError('El coaching por voz falló; se conserva el resultado visible.');
    }

    await hardStop(myGeneration);
  }

  function stop(): void {
    // No active/ever-started session: nothing to tear down, no state churn.
    if (state === 'idle') return;

    generation += 1; // invalidate any in-flight async work (late completions, timers) immediately
    micEnabled = false;
    stopPlaybackGraph();
    stopCaptureGraph();
    clearTimers();

    const ctx = sessionContext;
    sessionContext = null;
    setState('ending');
    // Graceful: send session.end and close the CURRENT socket within 2s;
    // safe even if a new start() begins immediately after (see
    // VoiceTransport.endAndClose — it captures this specific socket).
    transport.endAndClose(STOP_CLOSE_TIMEOUT_MS);
    if (ctx) endSession(ctx);
    gate.reset();
    onSessionUpdated = null;
    onCoachReplyDone = null;
    setState('ended');
  }

  return { start, finish, stop };
}

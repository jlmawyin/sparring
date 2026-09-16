// Schedules PCM16 24kHz agent audio for playback and tracks every scheduled
// source so a barge-in (or hard stop) can actually silence audio in flight,
// not just reset a clock.

import { pcm16ToFloat, base64ToPCM16 } from './pcm';

export const PLAYBACK_SAMPLE_RATE = 24000;

export interface PlaybackAudioContext {
  currentTime: number;
  sampleRate: number;
  destination: unknown;
  createBuffer(numChannels: number, length: number, sampleRate: number): PlaybackAudioBuffer;
  createBufferSource(): PlaybackSourceNode;
}

export interface PlaybackAudioBuffer {
  getChannelData(channel: number): Float32Array;
}

export interface PlaybackSourceNode {
  buffer: PlaybackAudioBuffer | null;
  onended: (() => void) | null;
  connect(destination: unknown): void;
  start(when?: number): void;
  stop(when?: number): void;
}

export class PlaybackQueue {
  private readonly ctx: PlaybackAudioContext;
  private nextStartTime = 0;
  private readonly active = new Set<PlaybackSourceNode>();
  private draining: (() => void) | null = null;

  constructor(ctx: PlaybackAudioContext) {
    this.ctx = ctx;
  }

  /** Decode and schedule one base64 PCM16 chunk right after the current tail. */
  enqueueBase64(data: string): void {
    const int16 = base64ToPCM16(data);
    const float32 = pcm16ToFloat(int16);
    this.enqueue(float32);
  }

  enqueue(samples: Float32Array): void {
    if (samples.length === 0) return;
    const buffer = this.ctx.createBuffer(1, samples.length, PLAYBACK_SAMPLE_RATE);
    buffer.getChannelData(0).set(samples);

    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(this.ctx.destination);

    const startAt = Math.max(this.nextStartTime, this.ctx.currentTime);
    source.onended = () => {
      this.active.delete(source);
      if (this.active.size === 0 && this.draining) {
        const cb = this.draining;
        this.draining = null;
        cb();
      }
    };
    this.active.add(source);
    source.start(startAt);
    this.nextStartTime = startAt + samples.length / PLAYBACK_SAMPLE_RATE;
  }

  /** Stop and discard every scheduled/active source immediately (barge-in, hard stop). */
  flush(): void {
    for (const source of this.active) {
      source.onended = null;
      try {
        source.stop();
      } catch {
        // already stopped/ended; ignore.
      }
    }
    this.active.clear();
    this.nextStartTime = this.ctx.currentTime;
    if (this.draining) {
      const cb = this.draining;
      this.draining = null;
      cb();
    }
  }

  get activeCount(): number {
    return this.active.size;
  }

  get isEmpty(): boolean {
    return this.active.size === 0;
  }

  /** Resolve once every currently-scheduled source has finished playing naturally. */
  whenDrained(): Promise<void> {
    if (this.isEmpty) return Promise.resolve();
    return new Promise((resolve) => {
      this.draining = resolve;
    });
  }
}

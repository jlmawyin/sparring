import { describe, expect, it, vi } from 'vitest';
import { PlaybackQueue, type PlaybackAudioContext, type PlaybackAudioBuffer, type PlaybackSourceNode } from '../../src/voice/playback';

// Fake Web Audio graph: no real audio hardware/decoding, just enough of the
// interface PlaybackQueue depends on (createBuffer/createBufferSource,
// start/stop/onended) to prove scheduling + cancellation behavior.
class FakeSource implements PlaybackSourceNode {
  buffer: PlaybackAudioBuffer | null = null;
  onended: (() => void) | null = null;
  started = false;
  stopped = false;
  connect = vi.fn();
  start = vi.fn((_when?: number) => {
    this.started = true;
  });
  stop = vi.fn((_when?: number) => {
    this.stopped = true;
  });
}

class FakeAudioContext implements PlaybackAudioContext {
  currentTime = 0;
  sampleRate = 24000;
  destination = {};
  sources: FakeSource[] = [];

  createBuffer(_channels: number, length: number, _sampleRate: number): PlaybackAudioBuffer {
    const data = new Float32Array(length);
    return { getChannelData: () => data };
  }

  createBufferSource(): PlaybackSourceNode {
    const s = new FakeSource();
    this.sources.push(s);
    return s;
  }
}

describe('PlaybackQueue', () => {
  it('schedules each enqueued chunk as a started source', () => {
    const ctx = new FakeAudioContext();
    const q = new PlaybackQueue(ctx);
    q.enqueue(new Float32Array(240)); // 10ms @ 24kHz
    q.enqueue(new Float32Array(240));
    expect(ctx.sources).toHaveLength(2);
    expect(ctx.sources[0].started).toBe(true);
    expect(ctx.sources[1].started).toBe(true);
    expect(q.activeCount).toBe(2);
  });

  it('flush() stops every scheduled/active source and clears the queue (barge-in)', () => {
    const ctx = new FakeAudioContext();
    const q = new PlaybackQueue(ctx);
    q.enqueue(new Float32Array(240));
    q.enqueue(new Float32Array(240));
    q.enqueue(new Float32Array(240));
    expect(q.activeCount).toBe(3);

    q.flush();

    expect(ctx.sources.every((s) => s.stopped)).toBe(true);
    expect(q.activeCount).toBe(0);
    expect(q.isEmpty).toBe(true);
  });

  it('flush() clears onended so a late natural end from a stopped source cannot resurrect it', () => {
    const ctx = new FakeAudioContext();
    const q = new PlaybackQueue(ctx);
    q.enqueue(new Float32Array(240));
    const source = ctx.sources[0];
    expect(source.onended).not.toBeNull();

    q.flush();
    expect(source.onended).toBeNull();

    // Simulate the browser firing a stale 'ended' after we already stopped it.
    expect(() => source.onended?.()).not.toThrow();
    expect(q.activeCount).toBe(0);
  });

  it('does not throw when stopping an already-ended source twice', () => {
    const ctx = new FakeAudioContext();
    const q = new PlaybackQueue(ctx);
    q.enqueue(new Float32Array(240));
    const source = ctx.sources[0];
    source.stop = vi.fn(() => {
      throw new Error('InvalidStateNode: already stopped');
    });
    expect(() => q.flush()).not.toThrow();
  });

  it('whenDrained() resolves once all active sources end naturally', async () => {
    const ctx = new FakeAudioContext();
    const q = new PlaybackQueue(ctx);
    q.enqueue(new Float32Array(240));
    q.enqueue(new Float32Array(240));

    const drained = q.whenDrained();
    let resolved = false;
    drained.then(() => {
      resolved = true;
    });

    ctx.sources[0].onended?.();
    await Promise.resolve();
    expect(resolved).toBe(false); // one source still active

    ctx.sources[1].onended?.();
    await drained;
    expect(resolved).toBe(true);
    expect(q.isEmpty).toBe(true);
  });

  it('whenDrained() resolves immediately when the queue is already empty', async () => {
    const ctx = new FakeAudioContext();
    const q = new PlaybackQueue(ctx);
    await expect(q.whenDrained()).resolves.toBeUndefined();
  });

  it('schedules chunks back-to-back on the playback timeline (no overlap gap tracking lost)', () => {
    const ctx = new FakeAudioContext();
    const q = new PlaybackQueue(ctx);
    q.enqueue(new Float32Array(24000)); // 1s
    q.enqueue(new Float32Array(24000)); // next 1s
    expect(ctx.sources[1].start).toHaveBeenCalledWith(1); // starts right after the first second
  });
});

import { describe, expect, it } from 'vitest';
import { ContinuousResampler } from '../../src/voice/resampler';

function sine(length: number, freq: number, sampleRate: number, startPhase = 0): Float32Array {
  const out = new Float32Array(length);
  for (let i = 0; i < length; i++) {
    out[i] = Math.sin(startPhase + (2 * Math.PI * freq * i) / sampleRate);
  }
  return out;
}

describe('ContinuousResampler', () => {
  it('produces ~24000/inputRate ratio of samples for 44.1kHz input', () => {
    const r = new ContinuousResampler(44100, 24000);
    const input = sine(44100, 440, 44100); // 1 second
    const out = r.process(input);
    // Expect close to 24000 samples (+/- a few due to fractional carry-over at the tail).
    expect(out.length).toBeGreaterThan(23900);
    expect(out.length).toBeLessThan(24100);
  });

  it('produces ~24000/inputRate ratio of samples for 48kHz input', () => {
    const r = new ContinuousResampler(48000, 24000);
    const input = sine(48000, 440, 48000);
    const out = r.process(input);
    expect(out.length).toBeGreaterThan(23900);
    expect(out.length).toBeLessThan(24100);
  });

  it('is a no-op passthrough when input rate equals output rate', () => {
    const r = new ContinuousResampler(24000, 24000);
    const input = sine(512, 200, 24000);
    const out = r.process(input);
    expect(out.length).toBe(input.length);
    expect(Array.from(out)).toEqual(Array.from(input));
  });

  it('keeps continuity across chunk boundaries (no discontinuity spike vs single-shot)', () => {
    const sampleRate = 44100;
    const full = sine(4410, 220, sampleRate); // 100ms in one shot

    const whole = new ContinuousResampler(sampleRate, 24000).process(full);

    const chunked = new ContinuousResampler(sampleRate, 24000);
    const chunkSize = 441; // 10 chunks
    const pieces: Float32Array[] = [];
    for (let i = 0; i < full.length; i += chunkSize) {
      pieces.push(chunked.process(full.slice(i, i + chunkSize)));
    }
    const stitched = pieces.reduce((acc, p) => {
      const merged = new Float32Array(acc.length + p.length);
      merged.set(acc, 0);
      merged.set(p, acc.length);
      return merged;
    }, new Float32Array(0));

    // Same total sample count (+/- 1 for rounding at very edges) and the
    // waveform must line up closely sample-for-sample — a broken carry
    // would show up as growing error or clicks (large deltas) at seams.
    expect(Math.abs(stitched.length - whole.length)).toBeLessThanOrEqual(2);
    const n = Math.min(stitched.length, whole.length);
    let maxDiff = 0;
    for (let i = 0; i < n; i++) {
      maxDiff = Math.max(maxDiff, Math.abs(stitched[i] - whole[i]));
    }
    expect(maxDiff).toBeLessThan(1e-6);
  });

  it('does not drop input state between arbitrarily small chunks (1-sample feeds)', () => {
    const r = new ContinuousResampler(48000, 24000);
    const input = sine(2000, 300, 48000);
    let total = 0;
    for (let i = 0; i < input.length; i++) {
      total += r.process(input.slice(i, i + 1)).length;
    }
    // Ratio is 2:1, so ~1000 output samples expected even when fed one at a time.
    expect(total).toBeGreaterThan(900);
    expect(total).toBeLessThan(1100);
  });

  it('rejects non-positive sample rates', () => {
    expect(() => new ContinuousResampler(0, 24000)).toThrow();
    expect(() => new ContinuousResampler(44100, -1)).toThrow();
  });
});

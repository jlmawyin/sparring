import { describe, expect, it } from 'vitest';
import { base64ToPCM16, floatToPCM16, pcm16ToBase64, pcm16ToFloat } from '../../src/voice/pcm';

describe('floatToPCM16 clipping', () => {
  it('maps 0 to 0', () => {
    expect(floatToPCM16(new Float32Array([0]))[0]).toBe(0);
  });

  it('maps 1.0 to 32767 (positive int16 max)', () => {
    expect(floatToPCM16(new Float32Array([1]))[0]).toBe(32767);
  });

  it('maps -1.0 to -32768 (negative int16 max)', () => {
    expect(floatToPCM16(new Float32Array([-1]))[0]).toBe(-32768);
  });

  it('clips out-of-range positive input instead of wrapping', () => {
    expect(floatToPCM16(new Float32Array([1.5]))[0]).toBe(32767);
  });

  it('clips out-of-range negative input instead of wrapping', () => {
    expect(floatToPCM16(new Float32Array([-2.3]))[0]).toBe(-32768);
  });
});

describe('base64 PCM16 little-endian wire framing', () => {
  it('round-trips arbitrary int16 samples through base64', () => {
    const original = new Int16Array([0, 1, -1, 32767, -32768, 12345, -12345]);
    const b64 = pcm16ToBase64(original);
    const decoded = base64ToPCM16(b64);
    expect(Array.from(decoded)).toEqual(Array.from(original));
  });

  it('encodes bytes in little-endian order (low byte first)', () => {
    // 0x0102 little-endian => bytes [0x02, 0x01]
    const value = 0x0102;
    const b64 = pcm16ToBase64(new Int16Array([value]));
    const binary = atob(b64);
    expect(binary.charCodeAt(0)).toBe(0x02);
    expect(binary.charCodeAt(1)).toBe(0x01);
  });

  it('round-trips float -> pcm16 -> base64 -> pcm16 -> float within quantization error', () => {
    const input = new Float32Array([0, 0.5, -0.5, 0.999, -0.999]);
    const pcm = floatToPCM16(input);
    const b64 = pcm16ToBase64(pcm);
    const decodedPcm = base64ToPCM16(b64);
    const decodedFloat = pcm16ToFloat(decodedPcm);
    for (let i = 0; i < input.length; i++) {
      expect(Math.abs(decodedFloat[i] - input[i])).toBeLessThan(0.001);
    }
  });
});

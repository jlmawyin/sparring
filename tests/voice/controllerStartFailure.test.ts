import { afterEach, describe, expect, it, vi } from 'vitest';
import { createVoiceController } from '../../src/voice/controller';
import type { ScenarioBrief, VoiceCallbacks } from '../../src/shared/types';

const scenario: ScenarioBrief = {
  id: 'late_delivery', version: '1.0.0', title: 'Pedido tardío', brief: 'Brief.',
  role: 'Cliente', facts: {}, authority: {},
};

afterEach(() => vi.unstubAllGlobals());

describe('session start rejection', () => {
  it.each([
    ['daily_limit', 'Se alcanzó el límite diario de minutos de práctica.'],
    ['session_active', 'Hay otra práctica activa.'],
    ['voice_unavailable', 'No se pudo preparar la voz.'],
  ])('explains %s and releases the microphone without opening a voice socket', async (code, expected) => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: false, status: 429,
      json: async () => ({ error: code, message: 'private upstream diagnostic' }),
    })));
    const stopTrack = vi.fn();
    const wsFactory = vi.fn();
    const onError = vi.fn();
    const callbacks: VoiceCallbacks = {
      onState: () => {}, onTurn: () => {}, onPartial: () => {}, onSnapshot: () => {}, onError,
    };
    const controller = createVoiceController(callbacks, {
      getUserMedia: async () => ({ getTracks: () => [{ stop: stopTrack }] } as unknown as MediaStream),
      wsFactory,
    });

    await controller.start(scenario);

    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError.mock.calls[0][0]).toContain(expected);
    expect(onError.mock.calls[0][0]).not.toContain('private upstream');
    expect(stopTrack).toHaveBeenCalledTimes(1);
    expect(wsFactory).not.toHaveBeenCalled();
  });
});

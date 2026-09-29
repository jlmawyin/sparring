import { ApiError, boundedString, isRecord } from './errors.ts';

export interface MintTokenOptions {
  key: string;
  sessionSeconds: number;
  upstream: typeof globalThis.fetch;
  timeoutMs: number;
}

/** Mints a capped ephemeral AssemblyAI token. Never returns or logs the server key. */
export async function mintToken(options: MintTokenOptions): Promise<string> {
  const { key, sessionSeconds, upstream, timeoutMs } = options;
  const controller = new AbortController();
  let timeout: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<never>((_, reject) => {
    timeout = setTimeout(() => { controller.abort(); reject(new Error('upstream_timeout')); }, Math.max(1, timeoutMs));
  });
  const operation = async () => {
    const url = new URL('https://agents.assemblyai.com/v1/token');
    url.searchParams.set('expires_in_seconds', '60');
    url.searchParams.set('max_session_duration_seconds', String(sessionSeconds));
    const response = await upstream(url, {
      method: 'GET', headers: { Authorization: `Bearer ${key}`, Accept: 'application/json' },
      signal: controller.signal, redirect: 'error',
    });
    if (!response.ok) throw new Error('upstream_rejected');
    const payload: unknown = await response.json();
    if (!isRecord(payload) || !boundedString(payload.token, 8192) || payload.token === key) throw new Error('upstream_invalid');
    return payload.token;
  };
  try { return await Promise.race([operation(), deadline]); }
  catch { throw new ApiError(503, 'voice_unavailable', 'No se pudo preparar la voz. Intenta de nuevo más tarde.'); }
  finally { if (timeout) clearTimeout(timeout); }
}

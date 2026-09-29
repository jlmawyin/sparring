import type { IncomingMessage, ServerResponse } from 'node:http';
import { ApiError } from './errors.ts';

export const MAX_BODY_BYTES = 64 * 1024;

export async function readBody(request: IncomingMessage): Promise<unknown> {
  if (!/^application\/json(?:\s*;|$)/i.test(request.headers['content-type'] ?? '')) {
    throw new ApiError(415, 'unsupported_media_type', 'Envía la solicitud en formato JSON.');
  }
  const declaredSize = request.headers['content-length'];
  if (declaredSize && Number(declaredSize) > MAX_BODY_BYTES) {
    request.resume();
    throw new ApiError(413, 'body_too_large', 'La solicitud supera el tamaño permitido.');
  }
  return await new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    let failed = false;
    request.on('data', (chunk: Buffer) => {
      if (failed) return;
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        failed = true;
        chunks.length = 0;
        reject(new ApiError(413, 'body_too_large', 'La solicitud supera el tamaño permitido.'));
      } else chunks.push(chunk);
    });
    request.on('end', () => {
      if (failed) return;
      try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown); }
      catch { reject(new ApiError(400, 'invalid_json', 'No se pudo leer la solicitud JSON.')); }
    });
    request.on('error', () => reject(new ApiError(400, 'invalid_body', 'No se pudo leer la solicitud.')));
    request.on('aborted', () => reject(new ApiError(400, 'invalid_body', 'La solicitud se interrumpió.')));
  });
}

export function respond(response: ServerResponse, status: number, body: unknown): void {
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  response.end(JSON.stringify(body));
}

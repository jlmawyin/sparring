import { closeSync, existsSync, mkdirSync, openSync, readFileSync, renameSync, statSync, unlinkSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

interface LedgerState {
  day: string;
  reservedSeconds: number;
  activeContext: string | null;
  activeDeadline: number | null;
}

export type ReserveResult = { ok: true } | { ok: false; reason: 'session_active' | 'daily_limit' };

export interface QuotaLedger {
  /** Atomic across concurrent requests and separate processes sharing the same file. */
  reserve(sessionSeconds: number, dailySeconds: number, context: string, now: number): Promise<ReserveResult>;
  /** Releases only the active-session lock; a granted reservation is never given back. */
  release(context: string, now: number): Promise<void>;
}

export interface QuotaLedgerOptions {
  /** A lock older than this is treated as abandoned by a crashed process. */
  staleLockMs?: number;
  lockAttempts?: number;
  lockRetryDelayMs?: number;
}

const DEFAULT_STALE_LOCK_MS = 5000;
const DEFAULT_LOCK_ATTEMPTS = 150;
const DEFAULT_LOCK_RETRY_DELAY_MS = 20;

function dayOf(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

function isValidLedger(value: unknown): value is LedgerState {
  if (typeof value !== 'object' || value === null) return false;
  const record = value as Record<string, unknown>;
  return typeof record.day === 'string' && typeof record.reservedSeconds === 'number' &&
    Number.isFinite(record.reservedSeconds) && record.reservedSeconds >= 0 &&
    (record.activeContext === null || typeof record.activeContext === 'string') &&
    (record.activeDeadline === null || typeof record.activeDeadline === 'number');
}

/** Missing file is normal bootstrap; a present-but-corrupt file must fail closed. */
function readLedger(file: string, now: number): LedgerState {
  if (!existsSync(file)) return { day: dayOf(now), reservedSeconds: 0, activeContext: null, activeDeadline: null };
  let parsed: unknown;
  try { parsed = JSON.parse(readFileSync(file, 'utf8')); }
  catch { throw new Error('quota_storage_error'); }
  if (!isValidLedger(parsed)) throw new Error('quota_storage_error');
  return parsed;
}

function writeLedger(file: string, state: LedgerState): void {
  mkdirSync(dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.${Date.now()}.${Math.random().toString(36).slice(2)}.tmp`;
  try {
    writeFileSync(tmp, JSON.stringify(state));
    renameSync(tmp, file);
  } catch {
    try { unlinkSync(tmp); } catch { /* best effort cleanup */ }
    throw new Error('quota_storage_error');
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function withLock<T>(lockFile: string, options: Required<QuotaLedgerOptions>, fn: () => T): Promise<T> {
  mkdirSync(dirname(lockFile), { recursive: true });
  for (let attempt = 0; attempt < options.lockAttempts; attempt++) {
    try {
      const fd = openSync(lockFile, 'wx');
      try {
        return fn();
      } finally {
        closeSync(fd);
        try { unlinkSync(lockFile); } catch { /* already released */ }
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw new Error('quota_storage_error');
      try {
        if (Date.now() - statSync(lockFile).mtimeMs > options.staleLockMs) {
          try { unlinkSync(lockFile); } catch { /* raced with holder releasing it */ }
          continue;
        }
      } catch { /* lock file vanished between openSync and statSync; retry immediately */ }
      await sleep(options.lockRetryDelayMs);
    }
  }
  throw new Error('quota_lock_timeout');
}

/** File-backed, atomic, conservative global quota. Survives process restarts. */
export function createQuotaLedger(file: string, options: QuotaLedgerOptions = {}): QuotaLedger {
  const lockFile = `${file}.lock`;
  const resolved: Required<QuotaLedgerOptions> = {
    staleLockMs: options.staleLockMs ?? DEFAULT_STALE_LOCK_MS,
    lockAttempts: options.lockAttempts ?? DEFAULT_LOCK_ATTEMPTS,
    lockRetryDelayMs: options.lockRetryDelayMs ?? DEFAULT_LOCK_RETRY_DELAY_MS,
  };
  return {
    reserve(sessionSeconds, dailySeconds, context, now) {
      return withLock(lockFile, resolved, () => {
        let state = readLedger(file, now);
        // Only the daily budget rolls over at midnight; the active-session lock is governed
        // solely by its own deadline, matching the local adapter's day-independent session lock.
        if (state.day !== dayOf(now)) state = { ...state, day: dayOf(now), reservedSeconds: 0 };
        const locked = state.activeContext !== null && state.activeDeadline !== null && now < state.activeDeadline;
        if (locked) return { ok: false, reason: 'session_active' } as const;
        if (state.reservedSeconds + sessionSeconds > dailySeconds) return { ok: false, reason: 'daily_limit' } as const;
        writeLedger(file, {
          day: state.day, reservedSeconds: state.reservedSeconds + sessionSeconds,
          activeContext: context, activeDeadline: now + sessionSeconds * 1000,
        });
        return { ok: true } as const;
      });
    },
    async release(context, now) {
      await withLock(lockFile, resolved, () => {
        const state = readLedger(file, now);
        if (state.activeContext === context) writeLedger(file, { ...state, activeContext: null, activeDeadline: null });
      });
    },
  };
}

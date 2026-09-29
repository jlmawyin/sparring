import { afterEach, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createQuotaLedger } from '../../server/quota.ts';

const dirs: string[] = [];

function quotaFile(): string {
  const dir = mkdtempSync(join(tmpdir(), 'sparring-quota-'));
  dirs.push(dir);
  return join(dir, 'quota.json');
}

afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe('file-backed atomic quota ledger', () => {
  it('grants a fresh reservation and blocks a second overlapping session', async () => {
    const ledger = createQuotaLedger(quotaFile());
    const now = Date.UTC(2026, 8, 16, 12);
    const first = await ledger.reserve(120, 1800, 'ctx-1', now);
    expect(first).toEqual({ ok: true });
    const second = await ledger.reserve(120, 1800, 'ctx-2', now);
    expect(second).toEqual({ ok: false, reason: 'session_active' });
  });

  it('enforces the daily cap across sequential reservations after release', async () => {
    const file = quotaFile();
    const ledger = createQuotaLedger(file);
    const now = Date.UTC(2026, 8, 16, 12);
    for (let i = 0; i < 7; i++) {
      const result = await ledger.reserve(240, 1800, `ctx-${i}`, now);
      expect(result).toEqual({ ok: true });
      await ledger.release(`ctx-${i}`, now);
    }
    const eighth = await ledger.reserve(240, 1800, 'ctx-8', now);
    expect(eighth).toEqual({ ok: false, reason: 'daily_limit' });
  });

  it('survives a process restart: a new ledger instance over the same file sees prior usage', async () => {
    const file = quotaFile();
    const now = Date.UTC(2026, 8, 16, 12);
    const before = createQuotaLedger(file);
    await before.reserve(1200, 1800, 'ctx-1', now);
    await before.release('ctx-1', now);
    // Simulate a restart: a brand-new ledger instance, no shared in-memory state.
    const after = createQuotaLedger(file);
    const blocked = await after.reserve(700, 1800, 'ctx-2', now);
    expect(blocked).toEqual({ ok: false, reason: 'daily_limit' });
    const fits = await after.reserve(600, 1800, 'ctx-3', now);
    expect(fits).toEqual({ ok: true });
  });

  it('resets the reserved budget on a new day once the prior session is released', async () => {
    const file = quotaFile();
    const ledger = createQuotaLedger(file);
    const day1 = Date.UTC(2026, 8, 16, 23, 59);
    await ledger.reserve(1799, 1800, 'ctx-1', day1);
    await ledger.release('ctx-1', day1);
    const day2 = Date.UTC(2026, 8, 17, 0, 1);
    const rolledOver = await ledger.reserve(1799, 1800, 'ctx-2', day2);
    expect(rolledOver).toEqual({ ok: true });
  });

  it('an active lock spanning midnight is not wiped by the daily budget rollover', async () => {
    const file = quotaFile();
    const ledger = createQuotaLedger(file);
    const day1 = Date.UTC(2026, 8, 16, 23, 59);
    await ledger.reserve(1200, 1800, 'ctx-1', day1); // deadline lands well after midnight
    const day2 = Date.UTC(2026, 8, 17, 0, 1); // new day, but before the deadline above
    const stillLocked = await ledger.reserve(60, 1800, 'ctx-2', day2);
    expect(stillLocked).toEqual({ ok: false, reason: 'session_active' });
  });

  it('races four concurrent reservations against the same file and grants exactly one', async () => {
    const file = quotaFile();
    const now = Date.UTC(2026, 8, 16, 12);
    const ledgers = Array.from({ length: 4 }, () => createQuotaLedger(file));
    const results = await Promise.all(ledgers.map((ledger, i) => ledger.reserve(240, 1800, `ctx-${i}`, now)));
    expect(results.filter(r => r.ok)).toHaveLength(1);
    expect(results.filter(r => !r.ok && r.reason === 'session_active')).toHaveLength(3);
  });

  it('fails closed and denies reservation when the ledger file is corrupt', async () => {
    const file = quotaFile();
    writeFileSync(file, '{not json');
    const ledger = createQuotaLedger(file);
    await expect(ledger.reserve(120, 1800, 'ctx-1', Date.UTC(2026, 8, 16, 12))).rejects.toThrow();
  });

  it('an older session ending twice cannot release a newer active slot', async () => {
    const file = quotaFile();
    const ledger = createQuotaLedger(file);
    const now = Date.UTC(2026, 8, 16, 12);
    await ledger.reserve(120, 1800, 'ctx-1', now);
    await ledger.release('ctx-1', now);
    await ledger.reserve(120, 1800, 'ctx-2', now);
    await ledger.release('ctx-1', now); // stale release, must be a no-op
    const blocked = await ledger.reserve(120, 1800, 'ctx-3', now);
    expect(blocked).toEqual({ ok: false, reason: 'session_active' });
  });

  it('an expired active lock is treated as free without an explicit release', async () => {
    const file = quotaFile();
    const ledger = createQuotaLedger(file);
    const start = Date.UTC(2026, 8, 16, 12);
    await ledger.reserve(60, 1800, 'ctx-1', start);
    const afterDeadline = start + 61_000;
    const next = await ledger.reserve(60, 1800, 'ctx-2', afterDeadline);
    expect(next).toEqual({ ok: true });
  });

  it('breaks a stale lock left by a crashed holder instead of deadlocking forever', async () => {
    const file = quotaFile();
    writeFileSync(`${file}.lock`, '');
    const oldTime = new Date(Date.now() - 60_000);
    utimesSync(`${file}.lock`, oldTime, oldTime);
    const ledger = createQuotaLedger(file, { staleLockMs: 50, lockAttempts: 20, lockRetryDelayMs: 5 });
    const result = await ledger.reserve(120, 1800, 'ctx-1', Date.UTC(2026, 8, 16, 12));
    expect(result).toEqual({ ok: true });
  });
});

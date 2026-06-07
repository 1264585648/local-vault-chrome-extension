import { afterEach, describe, expect, it, vi } from 'vitest';
import { clearCachedSession, restoreCachedSession, saveCachedSession } from './sessionCache';
import type { Credential } from './types';
import { resetVaultData } from './vaultReset';
import { VAULT_STORAGE_KEY } from './vaultStorage';

const credential: Credential = {
  id: 'test-record',
  website: 'example.com',
  username: 'user@example.com',
  password: 'test-password',
  twoFactorSecret: '',
  createdAt: '2026-06-07T00:00:00.000Z'
};

describe('vault reset', () => {
  afterEach(() => {
    clearCachedSession();
    vi.unstubAllGlobals();
  });

  it('clears saved vault data and the cached session', async () => {
    const values = new Map<string, string>([[VAULT_STORAGE_KEY, '{"version":1}']]);
    vi.stubGlobal('chrome', undefined);
    vi.stubGlobal('localStorage', {
      getItem: vi.fn((key: string) => values.get(key) ?? null),
      setItem: vi.fn((key: string, value: string) => values.set(key, value)),
      removeItem: vi.fn((key: string) => values.delete(key))
    });
    saveCachedSession({ credentials: [credential], masterPassword: 'test-master' }, 15, () => 1_000);

    await resetVaultData();

    expect(values.has(VAULT_STORAGE_KEY)).toBe(false);
    expect(restoreCachedSession(() => 2_000)).toBeNull();
  });
});

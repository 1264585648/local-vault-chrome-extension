import { afterEach, describe, expect, it, vi } from 'vitest';
import { clearVault, loadVault, saveVault, VAULT_STORAGE_KEY } from './vaultStorage';
import type { EncryptedVault } from './types';

const vault: EncryptedVault = {
  version: 1,
  kdf: 'PBKDF2-SHA256',
  iterations: 310000,
  salt: 'salt',
  iv: 'iv',
  data: 'data'
};

describe('vaultStorage localStorage fallback', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('saves and loads vault data when chrome.storage is unavailable', async () => {
    const values = new Map<string, string>();
    vi.stubGlobal('chrome', undefined);
    vi.stubGlobal('localStorage', {
      getItem: vi.fn((key: string) => values.get(key) ?? null),
      setItem: vi.fn((key: string, value: string) => values.set(key, value)),
      removeItem: vi.fn((key: string) => values.delete(key))
    });

    await saveVault(vault);

    expect(await loadVault()).toEqual(vault);
    expect(values.has(VAULT_STORAGE_KEY)).toBe(true);
  });

  it('clears vault data from local fallback storage', async () => {
    const values = new Map<string, string>([[VAULT_STORAGE_KEY, JSON.stringify(vault)]]);
    vi.stubGlobal('chrome', undefined);
    vi.stubGlobal('localStorage', {
      getItem: vi.fn((key: string) => values.get(key) ?? null),
      setItem: vi.fn((key: string, value: string) => values.set(key, value)),
      removeItem: vi.fn((key: string) => values.delete(key))
    });

    await clearVault();

    expect(await loadVault()).toBeNull();
  });
});

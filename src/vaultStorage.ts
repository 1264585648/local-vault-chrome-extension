import type { EncryptedVault } from './types';

export const VAULT_STORAGE_KEY = 'local_secure_vault';

let accessLevelConfigured = false;

function configureTrustedStorageAccess(storage: chrome.storage.StorageArea): void {
  if (accessLevelConfigured || typeof storage.setAccessLevel !== 'function') {
    return;
  }

  accessLevelConfigured = true;
  storage.setAccessLevel({ accessLevel: 'TRUSTED_CONTEXTS' }, () => {
    void chrome.runtime?.lastError;
  });
}

function getChromeStorage(): chrome.storage.StorageArea | null {
  if (
    typeof chrome === 'undefined' ||
    !chrome.storage ||
    !chrome.storage.local ||
    typeof chrome.storage.local.get !== 'function'
  ) {
    return null;
  }

  configureTrustedStorageAccess(chrome.storage.local);
  return chrome.storage.local;
}

function getLocalStorage(): Storage {
  if (typeof localStorage === 'undefined') {
    throw new Error('当前环境没有可用的本地存储');
  }

  return localStorage;
}

async function chromeGet<T>(storage: chrome.storage.StorageArea, key: string): Promise<T | null> {
  return new Promise((resolve, reject) => {
    storage.get(key, result => {
      const error = chrome.runtime?.lastError;
      if (error) {
        reject(new Error(error.message));
        return;
      }

      resolve((result[key] as T | undefined) ?? null);
    });
  });
}

async function chromeSet(storage: chrome.storage.StorageArea, key: string, value: unknown): Promise<void> {
  return new Promise((resolve, reject) => {
    storage.set({ [key]: value }, () => {
      const error = chrome.runtime?.lastError;
      if (error) {
        reject(new Error(error.message));
        return;
      }

      resolve();
    });
  });
}

async function chromeRemove(storage: chrome.storage.StorageArea, key: string): Promise<void> {
  return new Promise((resolve, reject) => {
    storage.remove(key, () => {
      const error = chrome.runtime?.lastError;
      if (error) {
        reject(new Error(error.message));
        return;
      }

      resolve();
    });
  });
}

export async function loadVault(): Promise<EncryptedVault | null> {
  const chromeStorage = getChromeStorage();
  if (chromeStorage) {
    return chromeGet<EncryptedVault>(chromeStorage, VAULT_STORAGE_KEY);
  }

  const raw = getLocalStorage().getItem(VAULT_STORAGE_KEY);
  return raw ? (JSON.parse(raw) as EncryptedVault) : null;
}

export async function saveVault(vault: EncryptedVault): Promise<void> {
  const chromeStorage = getChromeStorage();
  if (chromeStorage) {
    await chromeSet(chromeStorage, VAULT_STORAGE_KEY, vault);
    return;
  }

  getLocalStorage().setItem(VAULT_STORAGE_KEY, JSON.stringify(vault));
}

export async function clearVault(): Promise<void> {
  const chromeStorage = getChromeStorage();
  if (chromeStorage) {
    await chromeRemove(chromeStorage, VAULT_STORAGE_KEY);
    return;
  }

  getLocalStorage().removeItem(VAULT_STORAGE_KEY);
}

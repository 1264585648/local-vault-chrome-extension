import type { Credential, EncryptedVault } from './types';

const encoder = new TextEncoder();
const decoder = new TextDecoder();

export const DEFAULT_PBKDF2_ITERATIONS = 600_000;

function bytesToBase64(bytes: ArrayBuffer | Uint8Array): string {
  const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let binary = '';
  for (const byte of view) {
    binary += String.fromCharCode(byte);
  }

  if (typeof btoa === 'function') {
    return btoa(binary);
  }

  return Buffer.from(view).toString('base64');
}

function base64ToBytes(base64: string): Uint8Array {
  if (typeof atob === 'function') {
    const binary = atob(base64);
    return Uint8Array.from(binary, char => char.charCodeAt(0));
  }

  return Uint8Array.from(Buffer.from(base64, 'base64'));
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const buffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buffer).set(bytes);
  return buffer;
}

function getCrypto(): Crypto {
  if (!globalThis.crypto?.subtle) {
    throw new Error('当前环境不支持 Web Crypto API');
  }

  return globalThis.crypto;
}

async function deriveKey(password: string, salt: Uint8Array, iterations: number): Promise<CryptoKey> {
  const cryptoApi = getCrypto();
  const keyMaterial = await cryptoApi.subtle.importKey(
    'raw',
    encoder.encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );

  return cryptoApi.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: toArrayBuffer(salt),
      iterations,
      hash: 'SHA-256'
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

export async function encryptVault(
  credentials: Credential[],
  masterPassword: string,
  existingSalt?: string
): Promise<EncryptedVault> {
  const cryptoApi = getCrypto();
  const salt = existingSalt
    ? base64ToBytes(existingSalt)
    : cryptoApi.getRandomValues(new Uint8Array(16));
  const iv = cryptoApi.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(masterPassword, salt, DEFAULT_PBKDF2_ITERATIONS);
  const encrypted = await cryptoApi.subtle.encrypt(
    { name: 'AES-GCM', iv: toArrayBuffer(iv) },
    key,
    encoder.encode(JSON.stringify(credentials))
  );

  return {
    version: 1,
    kdf: 'PBKDF2-SHA256',
    iterations: DEFAULT_PBKDF2_ITERATIONS,
    salt: bytesToBase64(salt),
    iv: bytesToBase64(iv),
    data: bytesToBase64(encrypted)
  };
}

export async function decryptVault(
  encryptedVault: EncryptedVault,
  masterPassword: string
): Promise<Credential[]> {
  try {
    const cryptoApi = getCrypto();
    const salt = base64ToBytes(encryptedVault.salt);
    const iv = base64ToBytes(encryptedVault.iv);
    const encrypted = base64ToBytes(encryptedVault.data);
    const iterations = encryptedVault.iterations || DEFAULT_PBKDF2_ITERATIONS;
    const key = await deriveKey(masterPassword, salt, iterations);
    const decrypted = await cryptoApi.subtle.decrypt(
      { name: 'AES-GCM', iv: toArrayBuffer(iv) },
      key,
      toArrayBuffer(encrypted)
    );

    return JSON.parse(decoder.decode(decrypted)) as Credential[];
  } catch {
    throw new Error('主密码不正确或金库数据已损坏');
  }
}

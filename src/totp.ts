export interface TotpOptions {
  digits?: number;
  period?: number;
  timestamp?: number;
}

function normalizeBase32(secret: string): string {
  const normalized = secret.replace(/\s+/g, '').replace(/=+$/g, '').toUpperCase();
  if (!normalized) {
    throw new Error('TOTP 密钥不能为空');
  }
  if (!/^[A-Z2-7]+$/.test(normalized)) {
    throw new Error('TOTP 密钥必须是 Base32 字符');
  }

  return normalized;
}

function decodeBase32(secret: string): Uint8Array {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = '';

  for (const char of normalizeBase32(secret)) {
    bits += alphabet.indexOf(char).toString(2).padStart(5, '0');
  }

  const bytes: number[] = [];
  for (let cursor = 0; cursor + 8 <= bits.length; cursor += 8) {
    bytes.push(Number.parseInt(bits.slice(cursor, cursor + 8), 2));
  }

  return new Uint8Array(bytes);
}

function counterToBytes(counter: number): Uint8Array {
  const bytes = new Uint8Array(8);
  let value = counter;
  for (let index = 7; index >= 0; index -= 1) {
    bytes[index] = value & 0xff;
    value = Math.floor(value / 256);
  }

  return bytes;
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const buffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buffer).set(bytes);
  return buffer;
}

export async function generateTotp(secret: string, options: TotpOptions = {}): Promise<string> {
  if (!globalThis.crypto?.subtle) {
    throw new Error('当前环境不支持 Web Crypto API');
  }

  const digits = options.digits ?? 6;
  const period = options.period ?? 30;
  const timestamp = options.timestamp ?? Date.now();
  const counter = Math.floor(Math.floor(timestamp / 1000) / period);
  const keyBytes = decodeBase32(secret);
  const key = await globalThis.crypto.subtle.importKey(
    'raw',
    toArrayBuffer(keyBytes),
    { name: 'HMAC', hash: 'SHA-1' },
    false,
    ['sign']
  );
  const signature = await globalThis.crypto.subtle.sign('HMAC', key, toArrayBuffer(counterToBytes(counter)));
  const hmac = new Uint8Array(signature);
  const offset = hmac[hmac.length - 1] & 0x0f;
  const binary =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);

  return (binary % 10 ** digits).toString().padStart(digits, '0');
}

export function getTotpTimeLeft(timestamp = Date.now(), period = 30): number {
  return period - (Math.floor(timestamp / 1000) % period);
}

const PASSWORD_ALPHABET =
  'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()_+~`|}{[]:;?><,./-=';

export function generatePassword(length = 18): string {
  if (length < 8) {
    throw new Error('密码长度至少需要 8 位');
  }
  if (!globalThis.crypto?.getRandomValues) {
    throw new Error('当前环境不支持安全随机数生成');
  }

  const randomValues = globalThis.crypto.getRandomValues(new Uint32Array(length));
  return Array.from(randomValues, value => PASSWORD_ALPHABET[value % PASSWORD_ALPHABET.length]).join('');
}

export function isValidTotpSecret(secret: string): boolean {
  const normalized = secret.replace(/\s+/g, '').replace(/=+$/g, '').toUpperCase();
  return normalized.length > 0 && /^[A-Z2-7]+$/.test(normalized);
}

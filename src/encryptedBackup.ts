import type { Credential, EncryptedVault } from './types';
import { decryptVault, encryptVault } from './vaultCrypto';

export interface EncryptedBackupFile {
  kind: 'encrypted_backup';
  version: 1;
  exportedAt: string;
  vault: EncryptedVault;
}

const MIN_SAFE_ITERATIONS = 100_000;
const MAX_SAFE_ITERATIONS = 1_000_000;

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

function isValidVault(value: unknown): value is EncryptedVault {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const vault = value as Partial<EncryptedVault>;
  return (
    vault.version === 1 &&
    vault.kdf === 'PBKDF2-SHA256' &&
    Number.isInteger(vault.iterations) &&
    Number(vault.iterations) >= MIN_SAFE_ITERATIONS &&
    Number(vault.iterations) <= MAX_SAFE_ITERATIONS &&
    isNonEmptyString(vault.salt) &&
    isNonEmptyString(vault.iv) &&
    isNonEmptyString(vault.data)
  );
}

export async function createEncryptedBackup(
  credentials: Credential[],
  masterPassword: string,
  nowFactory = () => new Date().toISOString()
): Promise<EncryptedBackupFile> {
  return {
    kind: 'encrypted_backup',
    version: 1,
    exportedAt: nowFactory(),
    vault: await encryptVault(credentials, masterPassword)
  };
}

export function isEncryptedBackup(value: unknown): value is EncryptedBackupFile {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Partial<EncryptedBackupFile>;
  return (
    candidate.kind === 'encrypted_backup' &&
    candidate.version === 1 &&
    typeof candidate.exportedAt === 'string' &&
    isValidVault(candidate.vault)
  );
}

export async function decryptEncryptedBackup(
  backup: EncryptedBackupFile,
  masterPassword: string
): Promise<Credential[]> {
  try {
    return await decryptVault(backup.vault, masterPassword);
  } catch {
    throw new Error('备份密码与当前主密码不一致或文件损坏');
  }
}

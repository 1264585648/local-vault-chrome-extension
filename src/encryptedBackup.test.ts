import { describe, expect, it } from 'vitest';
import { createEncryptedBackup, decryptEncryptedBackup, isEncryptedBackup } from './encryptedBackup';
import type { Credential } from './types';

const credentials: Credential[] = [
  {
    id: 'github',
    title: '工作 GitHub',
    website: 'github.com',
    username: 'octo@example.com',
    password: 'correct horse battery staple',
    twoFactorSecret: 'JBSWY3DPEHPK3PXP',
    createdAt: '2026-06-07T10:00:00.000Z'
  }
];

describe('encrypted backup', () => {
  it('exports credentials without plaintext and decrypts with the same password', async () => {
    const backup = await createEncryptedBackup(
      credentials,
      'master-password',
      () => '2026-06-07T10:30:00.000Z'
    );
    const serialized = JSON.stringify(backup);

    expect(backup.kind).toBe('encrypted_backup');
    expect(backup.exportedAt).toBe('2026-06-07T10:30:00.000Z');
    expect(serialized).not.toContain('correct horse');
    expect(serialized).not.toContain('octo@example.com');
    await expect(decryptEncryptedBackup(backup, 'master-password')).resolves.toEqual(credentials);
  });

  it('rejects encrypted backups with the wrong password', async () => {
    const backup = await createEncryptedBackup(credentials, 'right-password');

    await expect(decryptEncryptedBackup(backup, 'wrong-password')).rejects.toThrow(
      '备份密码与当前主密码不一致或文件损坏'
    );
  });

  it('identifies encrypted backup files', async () => {
    const backup = await createEncryptedBackup(credentials, 'master-password');

    expect(isEncryptedBackup(backup)).toBe(true);
    expect(isEncryptedBackup({ credentials })).toBe(false);
    expect(isEncryptedBackup(null)).toBe(false);
  });

  it('rejects malformed encrypted backup schemas before decrypting', () => {
    expect(
      isEncryptedBackup({
        kind: 'encrypted_backup',
        version: 1,
        exportedAt: '2026-06-07T10:30:00.000Z',
        vault: {
          version: 1,
          kdf: 'PBKDF2-SHA256',
          iterations: 9_999_999,
          salt: 'salt',
          iv: 'iv',
          data: 'data'
        }
      })
    ).toBe(false);

    expect(
      isEncryptedBackup({
        kind: 'encrypted_backup',
        version: 1,
        exportedAt: '2026-06-07T10:30:00.000Z',
        vault: {
          version: 1,
          kdf: 'PBKDF2-SHA256',
          iterations: 600_000,
          salt: '',
          iv: 'iv',
          data: 'data'
        }
      })
    ).toBe(false);
  });
});

import { describe, expect, it } from 'vitest';
import { decryptVault, encryptVault } from './vaultCrypto';
import type { Credential } from './types';

describe('vault crypto', () => {
  it('decrypts credentials encrypted with the same master password', async () => {
    const credentials: Credential[] = [
      {
        id: 'github',
        title: '工作 GitHub',
        website: 'github.com',
        username: 'octo@example.com',
        password: 'correct horse battery staple',
        twoFactorSecret: '',
        createdAt: '2026-06-07T10:00:00.000Z'
      }
    ];

    const encrypted = await encryptVault(credentials, 'master-password');
    const decrypted = await decryptVault(encrypted, 'master-password');

    expect(decrypted).toEqual(credentials);
    expect(encrypted.data).not.toContain('correct horse');
    expect(encrypted.salt).toMatch(/^[A-Za-z0-9+/]+=*$/);
    expect(encrypted.iv).toMatch(/^[A-Za-z0-9+/]+=*$/);
  });

  it('rejects an incorrect master password', async () => {
    const encrypted = await encryptVault([], 'right-password');

    await expect(decryptVault(encrypted, 'wrong-password')).rejects.toThrow(
      '主密码不正确或密码库数据已损坏'
    );
  });

  it('can reuse an existing salt while writing a new vault payload', async () => {
    const first = await encryptVault([], 'master-password');
    const second = await encryptVault(
      [
        {
          id: 'mail',
          title: '工作邮箱',
          website: 'mail.example.com',
          username: 'me',
          password: 'secret',
          twoFactorSecret: '',
          createdAt: '2026-06-07T10:00:00.000Z'
        }
      ],
      'master-password',
      first.salt
    );

    expect(second.salt).toBe(first.salt);
    await expect(decryptVault(second, 'master-password')).resolves.toHaveLength(1);
  });

  it('adds a bounded title when decrypting legacy credentials without one', async () => {
    const encrypted = await encryptVault(
      [
        {
          id: 'legacy',
          website: 'legacy.example.com',
          username: 'legacy@example.com',
          password: 'secret',
          twoFactorSecret: '',
          createdAt: '2026-06-07T10:00:00.000Z'
        } as Credential
      ],
      'master-password'
    );

    const [credential] = await decryptVault(encrypted, 'master-password');

    expect(credential.title).toBe('legacy@example.com');
  });
});

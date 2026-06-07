import { describe, expect, it } from 'vitest';
import { parseCredentialImport, rekeyImportedCredentials } from './importExport';

describe('parseCredentialImport', () => {
  it('parses JSON arrays with common password-manager field aliases', () => {
    const imported = parseCredentialImport(
      'backup.json',
      JSON.stringify([
        {
          url: 'https://github.com',
          email: 'octo@example.com',
          pass: 'secret',
          totp: 'JBSWY3DPEHPK3PXP'
        }
      ]),
      () => 'fixed-id',
      () => '2026-06-07T10:00:00.000Z'
    );

    expect(imported).toEqual([
      {
        id: 'fixed-id',
        website: 'https://github.com',
        username: 'octo@example.com',
        password: 'secret',
        twoFactorSecret: 'JBSWY3DPEHPK3PXP',
        createdAt: '2026-06-07T10:00:00.000Z'
      }
    ]);
  });

  it('parses CSV exports with quoted commas', () => {
    const imported = parseCredentialImport(
      'backup.csv',
      'Website,Username,Password,2FA\n"mail.example.com","me@example.com","pa,ss",""\n',
      () => 'csv-id',
      () => '2026-06-07T10:00:00.000Z'
    );

    expect(imported[0].password).toBe('pa,ss');
    expect(imported[0].website).toBe('mail.example.com');
  });

  it('rejects unsupported file formats', () => {
    expect(() => parseCredentialImport('backup.txt', '')).toThrow('仅支持 JSON 或 CSV 文件');
  });
});

describe('rekeyImportedCredentials', () => {
  it('assigns fresh ids to imported credentials while preserving fields', () => {
    const imported = rekeyImportedCredentials(
      [
        {
          id: 'duplicate-id',
          website: 'github.com',
          username: 'octo@example.com',
          password: 'secret',
          twoFactorSecret: '',
          createdAt: '2026-06-07T10:00:00.000Z'
        }
      ],
      () => 'fresh-id',
      () => '2026-06-07T11:00:00.000Z'
    );

    expect(imported).toEqual([
      {
        id: 'fresh-id',
        website: 'github.com',
        username: 'octo@example.com',
        password: 'secret',
        twoFactorSecret: '',
        createdAt: '2026-06-07T11:00:00.000Z'
      }
    ]);
  });
});

import { describe, expect, it } from 'vitest';
import { generateTotp } from './totp';

describe('generateTotp', () => {
  it('matches the RFC 6238 SHA-1 test vector', async () => {
    const code = await generateTotp(
      'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ',
      { digits: 8, timestamp: 59_000 }
    );

    expect(code).toBe('94287082');
  });

  it('accepts lowercase and whitespace in Base32 secrets', async () => {
    const compact = await generateTotp('JBSWY3DPEHPK3PXP', { timestamp: 1_700_000_000_000 });
    const spaced = await generateTotp('jbsw y3dp ehpk 3pxp', { timestamp: 1_700_000_000_000 });

    expect(spaced).toBe(compact);
  });

  it('reports invalid Base32 secrets', async () => {
    await expect(generateTotp('abc123', { timestamp: 1_700_000_000_000 })).rejects.toThrow(
      'TOTP 密钥必须是 Base32 字符'
    );
  });
});

import { describe, expect, it } from 'vitest';
import { generatePassword, isValidTotpSecret } from './passwordTools';

describe('passwordTools', () => {
  it('generates a password with the requested length', () => {
    const password = generatePassword(24);

    expect(password).toHaveLength(24);
    expect(password).toMatch(/^[A-Za-z0-9!@#$%^&*()_+~`|}{[\]:;?><,./\-=]+$/);
  });

  it('validates Base32 TOTP secrets', () => {
    expect(isValidTotpSecret('jbsw y3dp ehpk 3pxp')).toBe(true);
    expect(isValidTotpSecret('abc123')).toBe(false);
  });
});

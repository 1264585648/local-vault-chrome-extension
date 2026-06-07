import { describe, expect, it } from 'vitest';
import {
  EMPTY_MASTER_PASSWORD_WARNING,
  MASTER_PASSWORD_RECOVERY_WARNING,
  shouldWarnAboutEmptyMasterPassword
} from './masterPasswordPolicy';

describe('master password policy', () => {
  it('warns when unlocking with an empty master password', () => {
    expect(shouldWarnAboutEmptyMasterPassword('')).toBe(true);
    expect(shouldWarnAboutEmptyMasterPassword('secret')).toBe(false);
  });

  it('keeps the first-run recovery warning explicit', () => {
    expect(MASTER_PASSWORD_RECOVERY_WARNING).toContain('请牢记你的主密码');
    expect(MASTER_PASSWORD_RECOVERY_WARNING).toContain('不会上传云端');
    expect(MASTER_PASSWORD_RECOVERY_WARNING).toContain('无法联系我们');
  });

  it('keeps the empty-master warning actionable', () => {
    expect(EMPTY_MASTER_PASSWORD_WARNING).toContain('空主密码');
    expect(EMPTY_MASTER_PASSWORD_WARNING).toContain('风险');
    expect(EMPTY_MASTER_PASSWORD_WARNING).toContain('及时设置主密码');
  });
});

import { afterEach, describe, expect, it } from 'vitest';
import {
  clearCachedSession,
  getCachedSessionStatus,
  restoreCachedSession,
  saveCachedSession
} from './sessionCache';
import { getSessionDurationLabel, SESSION_DURATION_OPTIONS } from './sessionPolicy';
import type { Credential } from './types';

const credentials: Credential[] = [
  {
    id: 'mail',
    title: '工作邮箱',
    website: 'mail.example.com',
    username: 'me@example.com',
    password: 'secret',
    twoFactorSecret: '',
    createdAt: '2026-06-07T10:00:00.000Z'
  }
];

describe('session policy', () => {
  it('offers common session duration options with 15 minutes as the recommended default', () => {
    expect(SESSION_DURATION_OPTIONS.map(option => option.minutes)).toEqual([0, 5, 15, 30, 60]);
    expect(SESSION_DURATION_OPTIONS.find(option => option.recommended)?.minutes).toBe(15);
    expect(getSessionDurationLabel(0)).toBe('本次弹窗');
    expect(getSessionDurationLabel(15)).toBe('15 分钟');
  });
});

describe('sessionCache', () => {
  afterEach(() => {
    clearCachedSession();
  });

  it('does not cache anything for this-popup-only sessions', () => {
    const status = saveCachedSession(
      { credentials, masterPassword: 'master-password' },
      0,
      () => 1_000
    );

    expect(status).toEqual({ active: false, expiresAt: null, durationMinutes: 0 });
    expect(restoreCachedSession(() => 1_001)).toBeNull();
  });

  it('restores an in-memory session before expiry', () => {
    const status = saveCachedSession(
      { credentials, masterPassword: 'master-password' },
      15,
      () => 1_000
    );

    expect(status).toEqual({ active: true, expiresAt: 901_000, durationMinutes: 15 });
    expect(getCachedSessionStatus(() => 900_999)).toEqual(status);
    expect(restoreCachedSession(() => 900_999)).toEqual({
      credentials,
      masterPassword: 'master-password'
    });
  });

  it('clears expired in-memory sessions', () => {
    saveCachedSession({ credentials, masterPassword: 'master-password' }, 5, () => 1_000);

    expect(restoreCachedSession(() => 301_000)).toBeNull();
    expect(getCachedSessionStatus(() => 301_000)).toEqual({
      active: false,
      expiresAt: null,
      durationMinutes: 0
    });
  });
});

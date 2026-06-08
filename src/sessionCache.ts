import type { SessionDurationMinutes } from './sessionPolicy';
import { normalizeCredentials, type Credential } from './types';

export interface SessionPayload {
  credentials: Credential[];
  masterPassword: string;
}

export interface SessionStatus {
  active: boolean;
  expiresAt: number | null;
  durationMinutes: SessionDurationMinutes;
}

interface CachedSession {
  payload: SessionPayload;
  expiresAt: number;
  durationMinutes: Exclude<SessionDurationMinutes, 0>;
}

let cachedSession: CachedSession | null = null;

const INACTIVE_STATUS: SessionStatus = {
  active: false,
  expiresAt: null,
  durationMinutes: 0
};

function clonePayload(payload: SessionPayload): SessionPayload {
  return {
    credentials: normalizeCredentials(payload.credentials),
    masterPassword: payload.masterPassword
  };
}

function expireIfNeeded(nowFactory: () => number): void {
  if (cachedSession && cachedSession.expiresAt <= nowFactory()) {
    cachedSession = null;
  }
}

export function saveCachedSession(
  payload: SessionPayload,
  durationMinutes: SessionDurationMinutes,
  nowFactory = () => Date.now()
): SessionStatus {
  if (durationMinutes === 0) {
    cachedSession = null;
    return INACTIVE_STATUS;
  }

  cachedSession = {
    payload: clonePayload(payload),
    expiresAt: nowFactory() + durationMinutes * 60 * 1000,
    durationMinutes
  };

  return getCachedSessionStatus(nowFactory);
}

export function restoreCachedSession(nowFactory = () => Date.now()): SessionPayload | null {
  expireIfNeeded(nowFactory);
  return cachedSession ? clonePayload(cachedSession.payload) : null;
}

export function getCachedSessionStatus(nowFactory = () => Date.now()): SessionStatus {
  expireIfNeeded(nowFactory);
  if (!cachedSession) {
    return INACTIVE_STATUS;
  }

  return {
    active: true,
    expiresAt: cachedSession.expiresAt,
    durationMinutes: cachedSession.durationMinutes
  };
}

export function clearCachedSession(): SessionStatus {
  cachedSession = null;
  return INACTIVE_STATUS;
}

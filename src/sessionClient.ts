import {
  clearCachedSession,
  getCachedSessionStatus,
  restoreCachedSession,
  saveCachedSession,
  type SessionPayload,
  type SessionStatus
} from './sessionCache';
import type { SessionDurationMinutes } from './sessionPolicy';

type SessionRequest =
  | { type: 'session:save'; payload: SessionPayload; durationMinutes: SessionDurationMinutes }
  | { type: 'session:restore' }
  | { type: 'session:status' }
  | { type: 'session:clear' };

type SessionResponse =
  | { ok: true; payload?: SessionPayload | null; status?: SessionStatus }
  | { ok: false; error: string };

function canUseRuntimeMessaging(): boolean {
  return (
    typeof chrome !== 'undefined' &&
    Boolean(chrome.runtime?.id) &&
    typeof chrome.runtime.sendMessage === 'function'
  );
}

async function sendSessionMessage(request: SessionRequest): Promise<SessionResponse> {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(request, response => {
      const error = chrome.runtime.lastError;
      if (error) {
        reject(new Error(error.message));
        return;
      }

      resolve(response as SessionResponse);
    });
  });
}

async function requestSession(request: SessionRequest): Promise<SessionResponse> {
  if (canUseRuntimeMessaging()) {
    return sendSessionMessage(request);
  }

  if (request.type === 'session:save') {
    return {
      ok: true,
      status: saveCachedSession(request.payload, request.durationMinutes)
    };
  }
  if (request.type === 'session:restore') {
    return {
      ok: true,
      payload: restoreCachedSession(),
      status: getCachedSessionStatus()
    };
  }
  if (request.type === 'session:status') {
    return {
      ok: true,
      status: getCachedSessionStatus()
    };
  }

  return {
    ok: true,
    status: clearCachedSession()
  };
}

function assertOk(response: SessionResponse): asserts response is Extract<SessionResponse, { ok: true }> {
  if (!response.ok) {
    throw new Error(response.error);
  }
}

export async function saveSession(
  payload: SessionPayload,
  durationMinutes: SessionDurationMinutes
): Promise<SessionStatus> {
  const response = await requestSession({ type: 'session:save', payload, durationMinutes });
  assertOk(response);
  return response.status ?? { active: false, expiresAt: null, durationMinutes: 0 };
}

export async function restoreSession(): Promise<{ payload: SessionPayload | null; status: SessionStatus }> {
  const response = await requestSession({ type: 'session:restore' });
  assertOk(response);
  return {
    payload: response.payload ?? null,
    status: response.status ?? { active: false, expiresAt: null, durationMinutes: 0 }
  };
}

export async function getSessionStatus(): Promise<SessionStatus> {
  const response = await requestSession({ type: 'session:status' });
  assertOk(response);
  return response.status ?? { active: false, expiresAt: null, durationMinutes: 0 };
}

export async function clearSession(): Promise<SessionStatus> {
  const response = await requestSession({ type: 'session:clear' });
  assertOk(response);
  return response.status ?? { active: false, expiresAt: null, durationMinutes: 0 };
}

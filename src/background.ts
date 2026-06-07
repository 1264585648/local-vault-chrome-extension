import {
  clearCachedSession,
  getCachedSessionStatus,
  restoreCachedSession,
  saveCachedSession,
  type SessionPayload
} from './sessionCache';
import type { SessionDurationMinutes } from './sessionPolicy';

type SessionRequest =
  | { type: 'session:save'; payload: SessionPayload; durationMinutes: SessionDurationMinutes }
  | { type: 'session:restore' }
  | { type: 'session:status' }
  | { type: 'session:clear' };

function isSessionRequest(message: unknown): message is SessionRequest {
  return Boolean(message) && typeof message === 'object' && typeof (message as { type?: unknown }).type === 'string';
}

chrome.runtime.onMessage.addListener((message: unknown, _sender, sendResponse) => {
  if (!isSessionRequest(message)) {
    return false;
  }

  try {
    if (message.type === 'session:save') {
      sendResponse({
        ok: true,
        status: saveCachedSession(message.payload, message.durationMinutes)
      });
      return false;
    }

    if (message.type === 'session:restore') {
      sendResponse({
        ok: true,
        payload: restoreCachedSession(),
        status: getCachedSessionStatus()
      });
      return false;
    }

    if (message.type === 'session:status') {
      sendResponse({
        ok: true,
        status: getCachedSessionStatus()
      });
      return false;
    }

    sendResponse({
      ok: true,
      status: clearCachedSession()
    });
  } catch (error) {
    sendResponse({
      ok: false,
      error: error instanceof Error ? error.message : '会话操作失败'
    });
  }

  return false;
});

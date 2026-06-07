export type SessionDurationMinutes = 0 | 5 | 15 | 30 | 60;

export interface SessionDurationOption {
  minutes: SessionDurationMinutes;
  label: string;
  recommended?: boolean;
}

export const SESSION_DURATION_OPTIONS: SessionDurationOption[] = [
  { minutes: 0, label: '本次弹窗' },
  { minutes: 5, label: '5 分钟' },
  { minutes: 15, label: '15 分钟', recommended: true },
  { minutes: 30, label: '30 分钟' },
  { minutes: 60, label: '60 分钟' }
];

export function getSessionDurationLabel(minutes: SessionDurationMinutes): string {
  return SESSION_DURATION_OPTIONS.find(option => option.minutes === minutes)?.label ?? `${minutes} 分钟`;
}

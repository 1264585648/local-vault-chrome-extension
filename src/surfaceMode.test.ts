import { describe, expect, it } from 'vitest';
import { getVaultSurfaceMode } from './surfaceMode';

describe('surface mode', () => {
  it('treats a top-level window as a standalone page', () => {
    const topLevel = {};

    expect(getVaultSurfaceMode({ self: topLevel, top: topLevel })).toBe('standalone');
  });

  it('treats an embedded window as a floating surface', () => {
    expect(getVaultSurfaceMode({ self: {}, top: {} })).toBe('floating');
  });
});

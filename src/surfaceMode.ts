export type VaultSurfaceMode = 'standalone' | 'floating';

interface WindowSurfaceContext {
  self: unknown;
  top: unknown;
}

export function getVaultSurfaceMode(context: WindowSurfaceContext = window): VaultSurfaceMode {
  return context.self === context.top ? 'standalone' : 'floating';
}

export function applyVaultSurfaceMode(context: Window = window, documentRoot = document.documentElement): void {
  documentRoot.dataset.vaultSurface = getVaultSurfaceMode(context);
}

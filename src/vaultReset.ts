import { clearSession } from './sessionClient';
import {
  clearVault,
  loadVaultResetMarker,
  saveVaultResetMarker,
  VAULT_RESET_MARKER_VERSION
} from './vaultStorage';

export async function resetVaultData(): Promise<void> {
  await clearVault();
  await clearSession();
  await saveVaultResetMarker(VAULT_RESET_MARKER_VERSION);
}

export async function resetVaultDataForFreshStart(): Promise<boolean> {
  if ((await loadVaultResetMarker()) === VAULT_RESET_MARKER_VERSION) {
    return false;
  }

  await resetVaultData();
  return true;
}

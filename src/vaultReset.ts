import { clearSession } from './sessionClient';
import { clearVault } from './vaultStorage';

export async function resetVaultData(): Promise<void> {
  await clearVault();
  await clearSession();
}

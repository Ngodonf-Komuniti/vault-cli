
import { encryptVault } from '../crypto/vaultCrypto.js'
import { vaultExists, writeVaultFile } from '../storage/vaultFile.js'
import { VaultError, ErrorCode } from '../utils/errors.js'
import { validateMasterPassword } from '../utils/validation.js'

export async function initVault({ vaultPath, masterPassword } = {}) {
  validateMasterPassword(masterPassword)

  if (await vaultExists(vaultPath)) {
    throw new VaultError(
      ErrorCode.VAULT_ALREADY_EXISTS,
      'Vault file already exists',
    )
  }

  const initialData = {
    version: 1,
    credentials: [],
  }

  const envelope = await encryptVault(initialData, masterPassword)

  await writeVaultFile(vaultPath, envelope)
}

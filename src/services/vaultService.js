import { randomInt, randomUUID } from 'node:crypto'
import { decryptVault, encryptVault } from '../crypto/vaultCrypto.js'
import { readVaultFile, vaultExists, writeVaultFile } from '../storage/vaultFile.js'
import { VaultError, ErrorCode } from '../utils/errors.js'
import {
  validateCredentialInput,
  validateGenerateOptions,
  validateMasterPassword,
  validateVaultData,
} from '../utils/validation.js'

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

export async function addCredential(
  { vaultPath, masterPassword },
  input,
) {
  const credentialInput = validateCredentialInput(input)
  const data = await loadVault({ vaultPath, masterPassword })
  const normalizedName = credentialInput.name.toLowerCase()

  if (
    data.credentials.some(
      (credential) =>
        credential.name.toLowerCase() === normalizedName,
    )
  ) {
    throw new VaultError(
      ErrorCode.CREDENTIAL_ALREADY_EXISTS,
      'A credential with this name already exists',
    )
  }

  const timestamp = new Date().toISOString()
  const credential = {
    id: randomUUID(),
    ...credentialInput,
    createdAt: timestamp,
    updatedAt: timestamp,
  }
  const updatedData = {
    ...data,
    credentials: [...data.credentials, credential],
  }

  await saveVault(vaultPath, masterPassword, updatedData)
  return structuredClone(credential)
}

export async function getCredential(
  { vaultPath, masterPassword },
  nameOrId,
) {
  if (typeof nameOrId !== 'string' || nameOrId.trim() === '') {
    throw new VaultError(
      ErrorCode.INVALID_INPUT,
      'Credential name or ID must not be empty',
      { details: { field: 'nameOrId' } },
    )
  }

  const data = await loadVault({ vaultPath, masterPassword })
  const trimmedNameOrId = nameOrId.trim()
  const credential =
    data.credentials.find((entry) => entry.id === trimmedNameOrId) ??
    data.credentials.find(
      (entry) =>
        entry.name.toLowerCase() === trimmedNameOrId.toLowerCase(),
    )

  if (!credential) {
    throw new VaultError(
      ErrorCode.CREDENTIAL_NOT_FOUND,
      'Credential was not found',
    )
  }

  return structuredClone(credential)
}

export async function listCredentials({ vaultPath, masterPassword }) {
  const data = await loadVault({ vaultPath, masterPassword })

  return data.credentials
    .map((credential) => ({
      id: credential.id,
      name: credential.name,
      username: credential.username,
      url: credential.url,
      createdAt: credential.createdAt,
      updatedAt: credential.updatedAt,
    }))
    .sort((left, right) =>
      left.name.localeCompare(right.name, undefined, {
        sensitivity: 'base',
      }),
    )
    .map((credential) => structuredClone(credential))
}

export function generatePassword(options = {}) {
  const { length, symbols } = validateGenerateOptions(options)
  const groups = [
    'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
    'abcdefghijklmnopqrstuvwxyz',
    '0123456789',
  ]
  if (symbols) {
    groups.push('!@#$%^&*()-_=+[]{}:,.?')
  }

  const characters = groups.map((group) => group[randomInt(group.length)])
  const characterSet = groups.join('')

  while (characters.length < length) {
    characters.push(characterSet[randomInt(characterSet.length)])
  }

  for (let index = characters.length - 1; index > 0; index -= 1) {
    const swapIndex = randomInt(index + 1)
    const character = characters[index]
    characters[index] = characters[swapIndex]
    characters[swapIndex] = character
  }

  return characters.join('')
}

async function loadVault({ vaultPath, masterPassword }) {
  validateMasterPassword(masterPassword)
  const envelope = await readVaultFile(vaultPath)
  const data = await decryptVault(envelope, masterPassword)
  return validateVaultData(data)
}

async function saveVault(vaultPath, masterPassword, data) {
  const envelope = await encryptVault(data, masterPassword)
  await writeVaultFile(vaultPath, envelope, { overwrite: true })
}

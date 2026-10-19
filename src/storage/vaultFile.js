import { constants } from 'node:fs'
import { access, mkdir, open, readFile, rename, unlink } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import { homedir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { VaultError, ErrorCode } from '../utils/errors.js'

export function resolveVaultPath(override) {
  const vaultPath =
    override ??
    process.env.VAULT_PATH ??
    join(homedir(), '.local', 'share', 'vault-cli', 'vault.json')

  return resolve(vaultPath)
}

export async function vaultExists(vaultPath) {
  try {
    await access(vaultPath, constants.F_OK)
    return true
  } catch (error) {
    if (error.code === 'ENOENT') {
      return false
    }

    throw new VaultError(
      ErrorCode.STORAGE_ERROR,
      'Failed to check vault file',
      { cause: error, details: { reason: error.code ?? 'UNKNOWN' } },
    )
  }
}

export async function readVaultFile(vaultPath) {
  let content

  try {
    content = await readFile(vaultPath, 'utf8')
  } catch (error) {
    if (error.code === 'ENOENT') {
      throw new VaultError(
        ErrorCode.VAULT_NOT_FOUND,
        'Vault file does not exist',
        { cause: error },
      )
    }

    throw new VaultError(
      ErrorCode.STORAGE_ERROR,
      'Failed to read vault file',
      { cause: error, details: { reason: error.code ?? 'UNKNOWN' } },
    )
  }

  let envelope

  try {
    envelope = JSON.parse(content)
  } catch {
    throw new VaultError(
      ErrorCode.VAULT_CORRUPTED,
      'Vault file contains invalid JSON',
    )
  }

  if (
    envelope === null ||
    typeof envelope !== 'object' ||
    Array.isArray(envelope)
  ) {
    throw new VaultError(
      ErrorCode.VAULT_CORRUPTED,
      'Vault file must contain an envelope object',
    )
  }

  return envelope
}

export async function writeVaultFile(
  vaultPath,
  envelope,
  { overwrite = false } = {},
) {
  let content

  try {
    content = `${JSON.stringify(envelope, null, 2)}\n`
  } catch {
    throw new VaultError(
      ErrorCode.STORAGE_ERROR,
      'Failed to serialize vault envelope',
    )
  }

  if (content === undefined || content === 'undefined\n') {
    throw new VaultError(
      ErrorCode.STORAGE_ERROR,
      'Failed to serialize vault envelope',
    )
  }

  const directory = dirname(vaultPath)
  const tempPath = join(directory, `.vault-${randomUUID()}.tmp`)

  let fileHandle
  let tempCreated = false

  try {
    await mkdir(directory, { recursive: true, mode: 0o700 })

    if (!overwrite && await vaultExists(vaultPath)) {
      throw new VaultError(
        ErrorCode.VAULT_ALREADY_EXISTS,
        'Vault file already exists',
      )
    }

    fileHandle = await open(tempPath, 'wx', 0o600)
    tempCreated = true

    await fileHandle.writeFile(content, 'utf8')
    await fileHandle.sync()
    await fileHandle.close()
    fileHandle = undefined

    await rename(tempPath, vaultPath)
    tempCreated = false
  } catch (error) {
    if (fileHandle) {
      await fileHandle.close().catch(() => {})
    }

    if (tempCreated) {
      await unlink(tempPath).catch(() => {})
    }

    if (error instanceof VaultError) {
      throw error
    }

    throw new VaultError(
      ErrorCode.STORAGE_ERROR,
      'Failed to write vault file',
      {
        cause: error,
        details: { reason: error.code ?? 'UNKNOWN' },
      },
    )
  }
}
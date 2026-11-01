
import { randomInt, randomUUID } from 'node:crypto';
import { encryptVault, decryptVault } from '../crypto/vaultCrypto.js'
import { vaultExists, writeVaultFile, readVaultFile } from '../storage/vaultFile.js'
import { VaultError, ErrorCode } from '../utils/errors.js'
import { validateCredentialInput, validateMasterPassword, validateVaultData, validateGenerateOptions } from '../utils/validation.js'

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

async function loadVault({ vaultPath, masterPassword }) {
  const envelope = await readVaultFile(vaultPath);
  const data = await decryptVault(envelope, masterPassword);
  const vaultData = validateVaultData(data);

  return vaultData;
}

async function saveVault({ vaultPath, masterPassword }, dataVault) {
  const envelope = await encryptVault(dataVault, masterPassword);
  await writeVaultFile(vaultPath, envelope, { overwrite: true });
}

export async function addCredential(ctx, input) {
  const cleanInput = validateCredentialInput(input);
  const vaultData = await loadVault(ctx);

  const nameExists = vaultData.credentials.some (
    (item) => item.name.trim().toLowerCase() === cleanInput.name.trim().toLowerCase(),
  );
  if (nameExists) {
    throw new VaultError(
      ErrorCode.CREDENTIAL_ALREADY_EXISTS,
      `Credential "${cleanInput.name}" already exists`,
      { details: { field: 'name' } },
    );
  }

  const now = new Date().toISOString();
  const newCredential = {
    id: randomUUID(),
    ...cleanInput,
    createdAt: now,
    updatedAt: now,
  };

  const newVaultData = {
    ...vaultData,
    credentials: [...vaultData.credentials, newCredential],
  };

  await saveVault(ctx, newVaultData);

  return structuredClone(newCredential);
}

export async function listCredentials(ctx) {
  const vaultData = await loadVault(ctx);

  const summaries = vaultData.credentials.map((item) => ({
    id: item.id,
    name: item.name, 
    username: item.username, 
    url: item.url,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  }));

  const sortSummaries = [...summaries].sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()));

  return sortSummaries;
}

const UPPERCASE = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const LOWERCASE = "abcdefghijklmnopqrstuvwxyz";
const NUMBERS = "1234567890";
const SYMBOLS = "!@#$%^&*()_+-={}[]|:;<>,.?/~";
export function generatePassword(options) {
  const generateOption = validateGenerateOptions(options);
  const pool = UPPERCASE + LOWERCASE + NUMBERS + ( generateOption.symbols ? SYMBOLS : "" );

  const chars = Array.from({ length: generateOption.length }, () => pool[randomInt(pool.length)]);
  return chars.join("");
}
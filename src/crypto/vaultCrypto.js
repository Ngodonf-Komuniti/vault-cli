import { randomBytes,pbkdf2 as pbkdf2Callback, createCipheriv, createDecipheriv} from 'node:crypto'
import { promisify } from 'node:util'
import { VaultError, ErrorCode } from '../utils/errors.js'
import { validateMasterPassword } from '../utils/validation.js'

const pbkdf2 = promisify(pbkdf2Callback)

export function isValidBase64(value) {
    if (
      typeof value !== 'string' ||
      value.length % 4 !== 0 ||
      !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value)
    ) {
      return false
    }

    return Buffer.from(value, 'base64').toString('base64') === value
  }



export async function deriveKey(password, salt ) {
    return pbkdf2(password, salt, 600000, 32, 'sha256' ) // 32 bytes = 256 bits
}

export async function encryptVault(data, masterPassword) {

    validateMasterPassword(masterPassword)

    let key

    try {
        const salt = randomBytes(16)
        key = await deriveKey(masterPassword, salt)
        const iv = randomBytes(12);

        const envelopeMetadata = {
            formatVersion: 1,
            kdf: {
                algorithm: 'PBKDF2-HMAC-SHA-256',
                params: {
                    iterations: 600000,
                    keyLength: 32,
                    digest: 'sha256',
                },
                salt: salt.toString('base64'),
            },
            cipher: {
                algorithm: 'AES-256-GCM',
                nonce: iv.toString('base64'),
            },
        }

        const aad = Buffer.from(JSON.stringify(envelopeMetadata), 'utf8')

        const cipher = createCipheriv('aes-256-gcm', key, iv)
        cipher.setAAD(aad)
        const plaintext = JSON.stringify(data)
        const encrypted = Buffer.concat([
            cipher.update(plaintext, 'utf8'),
            cipher.final(),
        ])

        const authTag = cipher.getAuthTag()

        return {
                ...envelopeMetadata,
                cipher: {
                    ...envelopeMetadata.cipher,
                    authTag: authTag.toString('base64'),
                },
                ciphertext: encrypted.toString('base64'),
            }
    }catch {
        throw new VaultError(
            ErrorCode.INTERNAL_ERROR,
            'failed to encrypt vault'
        )
    }finally {
        key?.fill(0)
    }

}

export async function decryptVault(envelope, masterPassword) {

    validateMasterPassword(masterPassword)

    if (!envelope || typeof envelope !== 'object' || Array.isArray(envelope)) {
        throw new VaultError(
            ErrorCode.VAULT_CORRUPTED,
            'Vault envelope is invalid'
        )
    }


    if (
        !envelope.kdf ||
        typeof envelope.kdf !== 'object' ||
        Array.isArray(envelope.kdf) ||
        !envelope.cipher ||
        typeof envelope.cipher !== 'object' ||
        Array.isArray(envelope.cipher) ||
        !envelope.kdf.params ||
        typeof envelope.kdf.params !== 'object' ||
        Array.isArray(envelope.kdf.params)
    ) {
        throw new VaultError(
        ErrorCode.VAULT_CORRUPTED,
        'Vault envelope is invalid'
        )
    }


    if (envelope.formatVersion !== 1 ) {
        throw new VaultError(
            ErrorCode.VAULT_UNSUPPORTED_VERSION,
            'vault format version is not supported',
        )
    }

    if (
        envelope.kdf?.algorithm !== 'PBKDF2-HMAC-SHA-256' ||
        envelope.cipher?.algorithm !== 'AES-256-GCM'
    ) {
        throw new VaultError(
            ErrorCode.VAULT_UNSUPPORTED_FORMAT,
            'vault encryption format is not supported'
        )
    }

    if  (
        envelope.kdf.params?.iterations !== 600000 ||
        envelope.kdf.params?.keyLength !== 32 ||
        envelope.kdf.params?.digest !== 'sha256'
    ) {
        throw new VaultError(
            ErrorCode.VAULT_UNSUPPORTED_FORMAT,
            'vault encryption parameters are not supported',
        )
    }

    if (
        typeof envelope.kdf.salt !== 'string' ||
        typeof envelope.cipher.nonce !== 'string' ||
        typeof envelope.cipher.authTag !== 'string' ||
        typeof envelope.ciphertext !== 'string'
    ) {
        throw new VaultError(
          ErrorCode.VAULT_CORRUPTED,
          'Vault envelope data is invalid',
        )
    }

    if (
        !isValidBase64(envelope.kdf.salt) ||
        !isValidBase64(envelope.cipher.nonce) ||
        !isValidBase64(envelope.cipher.authTag) ||
        !isValidBase64(envelope.ciphertext)
    ) {
        throw new VaultError(
        ErrorCode.VAULT_CORRUPTED,
        'Vault envelope data is invalid',
        )
    }

    const salt = Buffer.from(envelope.kdf.salt, 'base64')
    const iv = Buffer.from(envelope.cipher.nonce, 'base64')
    const authTag = Buffer.from(envelope.cipher.authTag, 'base64')
    const ciphertext = Buffer.from(envelope.ciphertext, 'base64')

    if (
        salt.length !== 16 ||
        iv.length !== 12 ||
        authTag.length !== 16 ||
        ciphertext.length === 0
    ) {
        throw new VaultError(
            ErrorCode.VAULT_CORRUPTED,
            'vault envelope data is invalid'
        )
    }

    let key
    key = await deriveKey(masterPassword, salt)

    const envelopeMetadata = {
        formatVersion: envelope.formatVersion,
        kdf: {
          algorithm: envelope.kdf.algorithm,
          params: {
            iterations: envelope.kdf.params.iterations,
            keyLength: envelope.kdf.params.keyLength,
            digest: envelope.kdf.params.digest,
          },
          salt: envelope.kdf.salt,
        },
        cipher: {
          algorithm: envelope.cipher.algorithm,
          nonce: envelope.cipher.nonce,
        },
      }

    const aad =  Buffer.from(
        JSON.stringify(envelopeMetadata),
        'utf8'
    )

    let plaintext

    try {
        const decipher = createDecipheriv('aes-256-gcm', key, iv)
        decipher.setAAD(aad)
        decipher.setAuthTag(authTag)

        const plaintextBuffer = Buffer.concat([
            decipher.update(ciphertext),
            decipher.final(),
        ])

        plaintext = plaintextBuffer.toString('utf8')
    } catch {
        throw new VaultError(
            ErrorCode.DECRYPTION_FAILED,
            'Failed to decrypt vault',
        )
    }

    try {
        return JSON.parse(plaintext)
    } catch {
        throw new VaultError(
            ErrorCode.VAULT_CORRUPTED,
            'decrypted vault data is invalid'
        )
    }finally {
        key?.fill(0)
    }

}
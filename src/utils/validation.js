import { VaultError, ErrorCode } from "./errors.js"

export function validateMasterPassword(password) {
    if (typeof password !== 'string' || password.trim() === '') {
      throw new VaultError(
        ErrorCode.INVALID_INPUT,
        'Master password must not be empty',
        { details: { field: 'password' } },
      )
    }
  }

export function validateGenerateOptions(options = {}) {
  if (
    typeof options !== 'object' ||
    options === null ||
    Array.isArray(options)
  ) {
    throw new VaultError(
      ErrorCode.INVALID_INPUT,
      'Generate options must be an object',
      { details: { field: 'options' } },
    )
  }

  const allowedFields = ['length', 'symbols']

  for (const key of Object.keys(options)) {
    if (!allowedFields.includes(key)) {
      throw new VaultError(
        ErrorCode.INVALID_INPUT,
        'Generate options contain an unknown field',
        { details: { field: key } },
      )
    }
  }

  const length = options.length === undefined ? 20 : options.length
  const symbols = options.symbols === undefined ? true : options.symbols

  if (!Number.isInteger(length) || length < 8 || length > 128) {
    throw new VaultError(
      ErrorCode.INVALID_INPUT,
      'Password length must be an integer between 8 and 128',
      { details: { field: 'length' } },
    )
  }

  if (typeof symbols !== 'boolean') {
    throw new VaultError(
      ErrorCode.INVALID_INPUT,
      'The symbols option must be a boolean',
      { details: { field: 'symbols' } },
    )
  }

  return { length, symbols }
}

export function validateCredentialInput(input) {

    if (typeof input !== 'object' || input === null || Array.isArray(input)) {
        throw new VaultError( ErrorCode.INVALID_INPUT, 'Credential input must be an object',
          { details: { field: 'input' } }
        );
    }

    const alloweFields = [ 'name', 'username', 'password', 'url', 'notes' ]
    for (const key of Object.keys(input)) {
        if (!alloweFields.includes(key)) {
            throw new VaultError( ErrorCode.INVALID_INPUT, 'Credential input contains an unknown or forbidden field',
                { details: { field: key } }
            )
        }
    }

    const name = input.name

    if (typeof name !== 'string' || name.trim() === '' || name.trim().length > 100 ) {
        throw new VaultError(ErrorCode.INVALID_INPUT, 'Credential name must be between 1 and 100 characters' ,
            { details: { field: 'name'}}
        )
    }

    const password = input.password

    if (typeof password !== 'string' || password.length === 0 || password.length > 1024 ) {
        throw new VaultError( ErrorCode.INVALID_INPUT, 'Credetial password must be between 1 and 1024 characters',
             { details: { field: 'password'}}
        )
    }

    const username = input.username === undefined ? '' : input.username

    if (typeof username !== 'string' || username.trim().length > 256 ) {
        throw new VaultError(ErrorCode.INVALID_INPUT, 'Credential username must not exceed 256 characters',
            { details: { field: 'username'}}
        )
    }

    const url = input.url === undefined ? '' : input.url

    if (typeof url !== 'string' || url.trim().length > 2048 ) {
        throw new VaultError(ErrorCode.INVALID_INPUT, 'Credential URL must not exceed 2048 characters',
            { details: { field: 'url'}}
        )
    }

    if (url.trim() !== '') {
        try { new URL(url.trim())
        } catch { throw new VaultError(ErrorCode.INVALID_INPUT, 'Credential URL must be a valid URL',
                { details: { field: 'url'}}
            )
        }
    }

    const notes = input.notes === undefined ? '' : input.notes

    if (typeof notes !== 'string' || notes.length > 10000 ) {
        throw new VaultError( ErrorCode.INVALID_INPUT, 'Credential notes must not exceed 10000 characters',
            { details: { field: 'notes' } }
        )
    }

    return {
        name: name.trim(),
        username: username.trim(),
        password,
        url: url.trim(),
        notes,
    }

}

export function validateCredentialUpdate(changes) {
    if (typeof changes !== 'object' || changes === null || Array.isArray(changes)
    ) { throw new VaultError( ErrorCode.INVALID_INPUT, 'Credential update must be an object' ,
            { details: { field: 'changes' } }
        )
    }

    const alloweFields = [ 'name', 'username', 'password', 'url', 'notes' ]

    for (const key of Object.keys(changes)) {
        if (!alloweFields.includes(key)) {
            throw new VaultError( ErrorCode.INVALID_INPUT, 'Credential update contains an unknown or forbidden field',
                { details: { field: key } }
            )
        }
    }

    if (Object.keys(changes).length === 0) {
        throw new VaultError( ErrorCode.INVALID_INPUT, 'Credential update must contain at least one field',
            { details: { field: 'changes' } }
        )
    }


    if (changes.name !== undefined ) {
        const name = changes.name

        if ( typeof name !== 'string' || name.trim() === '' || name.trim().length > 100 ) {
            throw new VaultError( ErrorCode.INVALID_INPUT, 'Credential name must be between 1 and 100 characters',
                { details: { field: 'name'}}
            )
        }
    }


    if (changes.username !== undefined ) {

        const username = changes.username
        if ( typeof username !== 'string' || username.trim().length > 256 ) {
            throw new VaultError( ErrorCode.INVALID_INPUT, 'Credential username must not exceed 256 characters',
                { details: { field: 'username' } }
            )
        }
    }

    if (changes.password !== undefined ) {
        const password = changes.password

        if ( typeof password !== 'string' || password.length === 0 || password.length > 1024 ) {
            throw new VaultError(ErrorCode.INVALID_INPUT, 'Credential password must be between 1 and 1024 characters',
                { details: { field: 'password' } }
            )
        }
    }

    if (changes.url !== undefined) {
        const url = changes.url

        if (typeof url !== 'string' || url.trim().length > 2048) {
            throw new VaultError(ErrorCode.INVALID_INPUT, 'Credential URL must not exceed 2048 characters',
                { details: { field: 'url' } }
            )
        }

        if (url.trim() !== ''){
            try {
                new URL(url.trim())
            } catch {
                throw new VaultError(ErrorCode.INVALID_INPUT, 'Credential URL must be a valid URL',
                    { details: { field: 'url' } }
                )
            }
        }
    }

    if (changes.notes !== undefined) {
        const notes = changes.notes

        if (typeof notes !== 'string' || notes.length > 10000) {
            throw new VaultError( ErrorCode.INVALID_INPUT, 'Credential notes must not exceed 10000 characters',
                { details: { field: 'notes' } }
            )
        }
    }

    const normalized = {}
    if (changes.name !== undefined) {
        normalized.name = changes.name.trim()
    }

    if (changes.username !== undefined) {
        normalized.username = changes.username.trim()
    }

    if (changes.password !== undefined) {
        normalized.password = changes.password
    }

    if (changes.url !== undefined) {
        normalized.url = changes.url.trim()
    }

    if (changes.notes !== undefined) {
        normalized.notes = changes.notes
    }

    return normalized

}

export function validateVaultData(data) {
  if (
    typeof data !== 'object' ||
    data === null ||
    Array.isArray(data)
  ) {
    throw new VaultError(
      ErrorCode.VAULT_CORRUPTED,
      'Vault data must be an object',
    )
  }

  if (
    !Number.isInteger(data.version) ||
    data.version < 1
  ) {
    throw new VaultError(
      ErrorCode.VAULT_CORRUPTED,
      'Vault version is invalid',
    )
  }

  if (data.version > 1) {
    throw new VaultError(
      ErrorCode.VAULT_UNSUPPORTED_VERSION,
      'Vault version is not supported by this application',
    )
  }

  if (!Array.isArray(data.credentials)) {
    throw new VaultError(
      ErrorCode.VAULT_CORRUPTED,
      'Vault credentials must be an array',
    )
  }

  const requiredFields = [
    'id',
    'name',
    'username',
    'password',
    'url',
    'notes',
    'createdAt',
    'updatedAt',
  ]

  for (const credential of data.credentials) {
    if (
      typeof credential !== 'object' ||
      credential === null ||
      Array.isArray(credential)
    ) {
      throw new VaultError(
        ErrorCode.VAULT_CORRUPTED,
        'Vault contains an invalid credential',
      )
    }

    const hasInvalidFields = requiredFields.some(
      (field) => typeof credential[field] !== 'string',
    )

    if (hasInvalidFields) {
      throw new VaultError(
        ErrorCode.VAULT_CORRUPTED,
        'Vault credential contains invalid fields',
      )
    }

    if (
      !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        credential.id,
      )
    ) {
      throw new VaultError(
        ErrorCode.VAULT_CORRUPTED,
        'Vault credential ID must be a UUID v4',
      )
    }

    if (
      credential.name.trim() === '' ||
      credential.name.trim().length > 100 ||
      credential.password.length < 1 ||
      credential.password.length > 1024 ||
      credential.username.trim().length > 256 ||
      credential.url.trim().length > 2048 ||
      credential.notes.length > 10000
    ) {
      throw new VaultError(
        ErrorCode.VAULT_CORRUPTED,
        'Vault credential violates field constraints',
      )
    }

    if (credential.url.trim() !== '') {
      try {
        new URL(credential.url.trim())
      } catch {
        throw new VaultError(
          ErrorCode.VAULT_CORRUPTED,
          'Vault credential URL is invalid',
        )
      }
    }

    const isIsoUtc = (value) =>
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value) &&
      !Number.isNaN(Date.parse(value)) &&
      new Date(value).toISOString() === value

    if (
      !isIsoUtc(credential.createdAt) ||
      !isIsoUtc(credential.updatedAt)
    ) {
      throw new VaultError(
        ErrorCode.VAULT_CORRUPTED,
        'Vault credential timestamps must be ISO 8601 UTC',
      )
    }
  }

  return data
}

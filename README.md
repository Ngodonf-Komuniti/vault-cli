# VaultCLI

VaultCLI is a local-first password manager for the command line, built with Node.js.

> **Warning:** VaultCLI is an early-stage project. It does **not** encrypt or store anything yet and is **not ready for storing real passwords**.

## Prerequisites

- Node.js 24 LTS (see `.nvmrc`; run `nvm use` if you use nvm)
- npm

## Installation and local development

```bash
npm install

# Links the package globally, so the `vault` command is available in your shell
npm run dev

vault --help
vault --version
vault status

# Or pass a command straight through
npm run dev -- status
```

`npm run dev` runs `npm link`, so the global npm folder must be writable without sudo.
If you get an `EACCES` error, point npm at a user-owned prefix once:

```bash
mkdir -p ~/.npm-global
npm config set prefix ~/.npm-global
echo 'export PATH="$HOME/.npm-global/bin:$PATH"' >> ~/.zshrc
source ~/.zshrc
```

Remove the link when you're done with `npm unlink -g vault-cli`.

## npm scripts

| Script          | Description                                   |
| --------------- | --------------------------------------------- |
| `npm run dev`   | Link the `vault` command globally (`npm link`) and run it |
| `npm run lint`  | Run ESLint                                    |

## Current CLI commands

| Command          | Description                                                        |
| ---------------- | ------------------------------------------------------------------ |
| `vault --help`    | Show usage information                                            |
| `vault --version` | Show the installed version                                        |
| `vault status`    | Temporary: confirms the CLI is running. It does not inspect a vault. |

## Roadmap

Planned features, none of which are implemented yet:

- `vault init`: create a new encrypted vault protected by a master password
- `vault add` / `vault get` / `vault list` / `vault delete`: manage stored credentials
- `vault generate`: generate strong passwords
- Encryption at rest using Node.js built-in crypto
- Local file-based storage with no cloud dependency

## Function Contracts & Data Model

> **Status: proposed, not implemented.** This section is the shared contract the team agrees on before building modules in parallel. None of the modules, functions, or commands below exist yet; the only implemented commands are listed under [Current CLI commands](#current-cli-commands). Anything marked **TBD — team agreement required** is intentionally undecided.

### Conventions

- ESM only. Shared module interfaces use **named exports** (no default exports).
- Functions that touch the file system or run key derivation are `async` and return `Promise<T>`.
- Validation and data-transformation functions are synchronous and pure.
- Internal data is passed as **plain JavaScript objects**. The only class is `VaultError`.
- No function mutates its arguments. Functions return new objects (see [Ownership and mutation rules](#ownership-and-mutation-rules)).
- Only the CLI layer reads stdin, writes stdout/stderr, formats terminal output, or calls `process.exit`. The service, crypto, storage, and validation modules never print or prompt.
- Types are written in TypeScript-style notation for readability. The code is plain JavaScript; whether to add JSDoc types is **TBD**.

### Module map

| Module         | Proposed file(s)                     | Responsibility                                   | May import                                   |
| -------------- | ------------------------------------ | ------------------------------------------------ | -------------------------------------------- |
| CLI layer      | `src/cli.js`, `src/commands/*.js`    | Parse args, prompt, display output, exit codes   | Vault Service, Validation, Errors            |
| Vault Service  | `src/services/vaultService.js`       | Credential operations and business rules         | Crypto, Storage, Validation, Errors          |
| Crypto         | `src/crypto/vaultCrypto.js`          | Encrypt and decrypt vault data                   | `node:crypto`, Errors                        |
| Storage        | `src/storage/vaultFile.js`           | Read and write the encrypted vault file          | `node:fs`, `node:path`, `node:os`, Errors    |
| Validation     | `src/utils/validation.js`            | Input and data validation rules                  | Errors                                       |
| Errors         | `src/utils/errors.js`                | `VaultError` class and `ErrorCode` constants     | (nothing)                                    |

Dependencies only point downward: **CLI → Vault Service → Crypto / Storage / Validation**. Crypto, Storage, and Validation never import each other or the service. Validation and Errors live in `src/utils/` so the existing directory structure doesn't change.

### Shared types

```js
// Plaintext, in memory only. Never written to disk unencrypted.
VaultData         = { version: number, credentials: Credential[] }
Credential        = { id, name, username, password, url, notes, createdAt, updatedAt } // all strings

CredentialInput   = { name: string, password: string, username?: string, url?: string, notes?: string }
CredentialUpdate  = Partial<Pick<Credential, 'name' | 'username' | 'password' | 'url' | 'notes'>> // at least one field
CredentialSummary = Omit<Credential, 'password' | 'notes'> // safe to display in lists

VaultContext      = { vaultPath: string, masterPassword: string }
GenerateOptions   = { length?: number, symbols?: boolean }
EncryptedEnvelope = { /* see "Encrypted on-disk format" */ }
```

`notes` is left out of `CredentialSummary` because people often keep recovery codes or other secrets in notes.

### Function contracts

**Unlock errors** below means the errors any operation on an existing vault can raise: `VAULT_NOT_FOUND`, `VAULT_CORRUPTED`, `VAULT_UNSUPPORTED_FORMAT`, `VAULT_UNSUPPORTED_VERSION`, `DECRYPTION_FAILED`, `STORAGE_ERROR`.

#### Errors (`src/utils/errors.js`)

```js
export class VaultError extends Error {
  constructor(code, message, { details, cause } = {}) // sync
}
export const ErrorCode = Object.freeze({ VAULT_NOT_FOUND: 'VAULT_NOT_FOUND', /* ... */ });
```

Every module imports `VaultError` and `ErrorCode` from here instead of defining its own error types.

#### Crypto module (`src/crypto/vaultCrypto.js`)

| Function | Async | Returns | Errors |
| --- | --- | --- | --- |
| `encryptVault(data: VaultData, masterPassword: string)` | yes | `Promise<EncryptedEnvelope>` | `INTERNAL_ERROR` |
| `decryptVault(envelope: EncryptedEnvelope, masterPassword: string)` | yes | `Promise<unknown>` (parsed plaintext, not yet schema-validated) | `DECRYPTION_FAILED`, `VAULT_UNSUPPORTED_FORMAT`, `VAULT_CORRUPTED` |

- Owns JSON serialization of the plaintext and the encrypted representation. It never touches the file system.
- Must use a new random nonce on every `encryptVault` call.
- Must wrap `JSON.parse` failures on decrypted data in a `VaultError` **without** copying the original error message, because it can contain fragments of plaintext.

#### Storage module (`src/storage/vaultFile.js`)

| Function | Async | Returns | Errors |
| --- | --- | --- | --- |
| `resolveVaultPath(override?: string)` | no | `string` (absolute path) | (none) |
| `vaultExists(vaultPath: string)` | yes | `Promise<boolean>` | `STORAGE_ERROR` |
| `readVaultFile(vaultPath: string)` | yes | `Promise<EncryptedEnvelope>` | `VAULT_NOT_FOUND`, `VAULT_CORRUPTED`, `STORAGE_ERROR` |
| `writeVaultFile(vaultPath: string, envelope: EncryptedEnvelope, options?: { overwrite?: boolean })` | yes | `Promise<void>` | `VAULT_ALREADY_EXISTS`, `STORAGE_ERROR` |

- `resolveVaultPath` checks, in order: `override` (from a CLI flag), then the `VAULT_PATH` environment variable, then the default location. The default location and the flag name are **TBD — team agreement required**.
- `readVaultFile` only checks that the file parses as an envelope object. Checking the cryptographic fields is Crypto's job.
- `writeVaultFile` defaults to `overwrite: false` and writes atomically (temp file in the same directory, then rename), so a failed write never leaves a half-written vault. File mode `0o600` and directory mode `0o700` on POSIX; Windows behavior is **TBD**.
- Storage never interprets crypto fields and never sees plaintext.

#### Validation module (`src/utils/validation.js`)

All functions are synchronous and pure (no I/O, no vault state). On failure they throw `VaultError` with `INVALID_INPUT` and `details.field` naming the offending field.

| Function | Returns | Errors |
| --- | --- | --- |
| `validateCredentialInput(input: unknown)` | `CredentialInput` (new, normalized object; optional fields default to `""`) | `INVALID_INPUT` |
| `validateCredentialUpdate(changes: unknown)` | `CredentialUpdate` (new, normalized object) | `INVALID_INPUT` |
| `validateMasterPassword(password: unknown)` | `void` | `INVALID_INPUT` |
| `validateGenerateOptions(options: unknown)` | `Required<GenerateOptions>` (defaults applied) | `INVALID_INPUT` |
| `validateVaultData(data: unknown)` | `VaultData` | `VAULT_CORRUPTED`, `VAULT_UNSUPPORTED_VERSION` |

Rules that need vault state, such as name uniqueness or whether a credential exists, belong to the Vault Service, not Validation.

#### Vault Service (`src/services/vaultService.js`)

| Function | Async | Returns | Errors | Changes persisted data? |
| --- | --- | --- | --- | --- |
| `initVault(ctx: VaultContext)` | yes | `Promise<void>` | `VAULT_ALREADY_EXISTS`, `INVALID_INPUT`, `STORAGE_ERROR` | Creates an empty vault |
| `addCredential(ctx: VaultContext, input: CredentialInput)` | yes | `Promise<Credential>` | Unlock errors, `INVALID_INPUT`, `CREDENTIAL_ALREADY_EXISTS` | Creates a credential |
| `getCredential(ctx: VaultContext, nameOrId: string)` | yes | `Promise<Credential>` | Unlock errors, `CREDENTIAL_NOT_FOUND` | No |
| `listCredentials(ctx: VaultContext)` | yes | `Promise<CredentialSummary[]>` sorted by name, case-insensitive | Unlock errors | No |
| `updateCredential(ctx: VaultContext, nameOrId: string, changes: CredentialUpdate)` | yes | `Promise<Credential>` | Unlock errors, `INVALID_INPUT`, `CREDENTIAL_NOT_FOUND`, `CREDENTIAL_ALREADY_EXISTS` | Updates a credential |
| `deleteCredential(ctx: VaultContext, nameOrId: string)` | yes | `Promise<CredentialSummary>` (the removed entry) | Unlock errors, `CREDENTIAL_NOT_FOUND` | Deletes a credential |
| `generatePassword(options?: GenerateOptions)` | **no** | `string` | `INVALID_INPUT` | No (never touches the vault) |

- `updateCredential` is part of the service contract, but no CLI command calls it yet. Whether to add a `vault edit` command is **TBD**.
- `nameOrId` first matches `id` exactly, then matches `name` case-insensitively after trimming.
- `generatePassword` uses the `node:crypto` CSPRNG (`randomInt`), never `Math.random`. Defaults: `length: 20`, `symbols: true`. The character set always includes upper case, lower case, and digits. The exact symbol set is **TBD**.
- Internal flow (not exported):

  ```text
  load: readVaultFile → decryptVault → migrate (if older version) → validateVaultData
  save: encryptVault → writeVaultFile({ overwrite: true })
  ```

  Every mutating operation is: load → build a new `VaultData` → save → return a copy. If saving fails, nothing is persisted.
- There is no file locking. If two `vault` processes write at once, the last write wins. Locking is **TBD**.

#### CLI layer (`src/cli.js`, `src/commands/*.js`)

| Function | Async | Returns | Notes |
| --- | --- | --- | --- |
| `register<Name>Command(program: Command)` e.g. `registerAddCommand` | no | `void` | One file per command in `src/commands/`, named export |
| Command action handlers | yes | `Promise<void>` | Collect input, call the service, format output |
| `promptSecret(message: string, options?: { confirm?: boolean })` | yes | `Promise<string>` | Hidden input via `node:readline`. File location **TBD** |

- The master password is always read with a hidden interactive prompt. It is **never** accepted as a command-line argument or environment variable, because those leak into shell history and process lists. Non-interactive use (scripts, CI) is **TBD**.
- The CLI may call Validation for early feedback, but the service always validates again and is the source of truth.
- `src/cli.js` has the single top-level error handler (see [Error contract](#error-contract)).

### Error contract

Application errors are thrown as `VaultError` instances. They are never returned as values.

```js
{
  code: "VAULT_NOT_FOUND",            // required, stable UPPER_SNAKE_CASE identifier
  message: "Vault file does not exist.", // required, human-readable, safe to print
  details: { path: "/home/me/..." },  // optional, non-sensitive context
  cause: originalError                // optional, the low-level error; never printed
}
```

| Property  | Type     | Required | Purpose |
| --------- | -------- | -------- | ------- |
| `code`    | `string` | yes      | Machine-readable. Code and tests branch on this, never on `message`. |
| `message` | `string` | yes      | Plain sentence safe to show users. It contains no CLI-specific hints; the CLI adds those. |
| `details` | `object` | no       | Non-sensitive context, e.g. `{ field: 'name' }` or `{ reason: 'EACCES' }`. |
| `cause`   | `unknown`| no       | The original error, for debugging. It must never contain secrets. |

#### Error codes

| Code | Scenario | Thrown by |
| --- | --- | --- |
| `VAULT_NOT_FOUND` | The vault file doesn't exist | Storage |
| `VAULT_ALREADY_EXISTS` | `init` when a vault already exists | Storage |
| `VAULT_CORRUPTED` | The file or decrypted data can't be parsed or has the wrong shape | Storage, Crypto, Validation |
| `VAULT_UNSUPPORTED_FORMAT` | The envelope `formatVersion` is unknown | Crypto |
| `VAULT_UNSUPPORTED_VERSION` | The plaintext `version` is newer than this build supports | Validation |
| `DECRYPTION_FAILED` | Wrong master password **or** tampered data. With authenticated encryption these can't be told apart, and the message must not guess. | Crypto |
| `INVALID_INPUT` | Input breaks a validation rule (`details.field` says which) | Validation, CLI |
| `CREDENTIAL_NOT_FOUND` | No credential matches the name or ID | Vault Service |
| `CREDENTIAL_ALREADY_EXISTS` | The name is already used by another credential | Vault Service |
| `OPERATION_CANCELLED` | The user declined a confirmation prompt | CLI |
| `STORAGE_ERROR` | Permission denied, disk full, other file-system errors (`details.reason` holds the fs code) | Storage |
| `INTERNAL_ERROR` | Unexpected failure inside a module | Any |

#### Who catches, translates, and displays

| Layer | Responsibility |
| --- | --- |
| Crypto, Storage | Catch low-level errors (`fs`, `crypto`, `JSON.parse`) and rethrow them as `VaultError` with the right code and `cause`. Never let raw `ENOENT` and similar escape. |
| Validation | Throw `VaultError` directly. Catch nothing. |
| Vault Service | Let `VaultError`s pass through unchanged. Never swallow errors or display them. |
| CLI | The **only** layer that displays errors. The top-level handler in `src/cli.js` prints `Error: <message>` to stderr and exits with code `1`. It may map codes to friendlier text, e.g. adding "Run `vault init` first." for `VAULT_NOT_FOUND`. |

**Unexpected errors** (anything that isn't a `VaultError`) are caught by the same top-level handler. It prints a generic `Error: An unexpected error occurred.` and exits with code `1`, without printing the original message. Whether a debug flag can show the stack trace is **TBD**.

Exit codes: `0` for success, `1` for any error. Finer-grained exit codes are **TBD**.

#### Sensitive data rules

- Error messages, `details`, `cause`, and any output must **never** contain: passwords, master passwords, derived keys, notes, decrypted vault JSON, or raw ciphertext and plaintext buffers.
- Error messages **may** contain credential names, IDs, and file paths.
- Only the CLI layer may use `console.*`. There's no logging library.

### Plaintext in-memory data model

> This is the **decrypted** structure that exists in memory only. It is **not** the file format. See [Encrypted on-disk format](#encrypted-on-disk-format).

```js
{
  version: 1,
  credentials: [
    {
      id: "6f1c2a9e-3b4d-4e8f-9a7b-1c2d3e4f5a6b",
      name: "GitHub",
      username: "example-user",
      password: "secret-value",
      url: "https://github.com",
      notes: "",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z"
    }
  ]
}
```

| Field | Type | Required | Set by | Rules (limits are proposals) |
| --- | --- | --- | --- | --- |
| `version` | integer | yes | Vault Service | Plaintext schema version. Currently `1`. |
| `credentials` | `Credential[]` | yes | Vault Service | May be empty. |
| `id` | string (UUID v4) | yes | Vault Service, on create | Generated with `crypto.randomUUID()`. Unique, immutable, never supplied by users. |
| `name` | string | yes | User | Trimmed, 1–100 chars, unique within the vault (case-insensitive). |
| `username` | string | no (default `""`) | User | Trimmed, max 256 chars. |
| `password` | string | yes | User or `generatePassword` | 1–1024 chars. Stored exactly as given, **not** trimmed. |
| `url` | string | no (default `""`) | User | Trimmed, max 2048 chars. If not empty, it must parse with `new URL()`. Allowed schemes are **TBD**. |
| `notes` | string | no (default `""`) | User | Max 10,000 chars, not trimmed. Treated as sensitive. |
| `createdAt` | string | yes | Vault Service | ISO 8601 UTC from `new Date().toISOString()`. Never changes. |
| `updatedAt` | string | yes | Vault Service | Same format. Equals `createdAt` on create; refreshed on every successful update. |

Optional fields are always stored as `""`, never `undefined` or `null`, so every credential has the same shape.

**Credential IDs.** IDs are stable internal references that don't change when a credential is renamed. Users normally refer to credentials by name; commands also accept the ID wherever they accept `<name-or-id>`.

#### Validation rules

| Rule | New credential (`add`) | Update |
| --- | --- | --- |
| Required fields | `name`, `password` | At least one editable field |
| Editable fields | `name`, `username`, `password`, `url`, `notes` | Same |
| `id`, `createdAt`, `updatedAt` in input | Rejected (`INVALID_INPUT`) | Rejected (`INVALID_INPUT`) |
| Unknown fields | Rejected (`INVALID_INPUT`) | Rejected (`INVALID_INPUT`) |
| Value types | Strings only | Strings only |
| Name uniqueness | Checked by the service | Checked by the service on rename |

#### Schema version and migrations

- `version` describes the **plaintext** schema. It's independent of the envelope's `formatVersion`.
- Bump it when a change would break older code: renaming or removing a field, changing a type, or adding a required field.
- The Vault Service keeps an ordered list of pure migration functions (`1 → 2`, `2 → 3`, ...). After decryption, any older vault is migrated in memory, and the upgraded data is written on the next save. Read-only commands never rewrite the file.
- A vault with a `version` newer than this build supports fails with `VAULT_UNSUPPORTED_VERSION`, and the file is left untouched.
- Whether to back up the vault before migrating is **TBD**.

### Ownership and mutation rules

| Data | Owner | Who may create or modify it |
| --- | --- | --- |
| Plaintext `VaultData` and credentials | Vault Service | Only `initVault`, `addCredential`, `updateCredential`, `deleteCredential` |
| Encryption and decryption, `EncryptedEnvelope` | Crypto module | Only `encryptVault` produces envelopes |
| Vault file on disk | Storage module | Only `writeVaultFile` |
| Validation rules and limits | Validation module | Only Validation defines them |
| Master password | CLI layer collects it | Passed through `VaultContext` and used by Crypto. Never stored, cached, or logged. |
| Terminal input and output | CLI layer | Only the CLI |

**Only four functions change persisted data:** `initVault` (creates an empty vault), `addCredential`, `updateCredential`, and `deleteCredential`. Everything else is read-only.

**Mutation rules (all modules):**

- Never mutate arguments. Always return new objects.
- The Vault Service builds a new `VaultData` with spread, `map`, and `filter` rather than in-place `push` or `splice`.
- The service returns copies (e.g. `structuredClone`). Changing a returned object has no effect on anything.
- JavaScript strings can't be wiped from memory, so secrets should only live as long as one command run. Whether to pass the master password as a `Buffer` instead of a `string` is **TBD**.

### Encrypted on-disk format

> **Not implemented.** Only the boundary between modules is agreed here. The cryptographic design is **TBD — team agreement required**.

```text
write: VaultData ──encryptVault (Crypto)──▶ EncryptedEnvelope ──writeVaultFile (Storage)──▶ vault file
read:  vault file ──readVaultFile (Storage)──▶ EncryptedEnvelope ──decryptVault (Crypto)──▶ VaultData
```

Conceptual envelope (every value is a placeholder):

```js
{
  formatVersion: 1,       // envelope format version, NOT the plaintext `version`
  kdf:    { algorithm: "TBD", params: { /* TBD */ }, salt: "<base64>" },
  cipher: { algorithm: "TBD", nonce: "<base64>", authTag: "<base64>" },
  ciphertext: "<base64>"  // encrypted VaultData
}
```

Agreed so far:

- The envelope holds everything needed to decrypt **except** the master password. Its fields (salt, nonce, tag) aren't secret and are stored as-is.
- `version` and `credentials` exist only **inside** the ciphertext. The envelope reveals nothing about credentials, not even how many there are.
- The nonce is new for every encryption.
- Storage never interprets crypto fields. Crypto never touches the file system.

| Open decision | Status |
| --- | --- |
| KDF algorithm and parameters | **TBD — team agreement required** |
| Cipher (Node built-in candidates include AES-256-GCM and ChaCha20-Poly1305; nothing chosen yet) | **TBD — team agreement required** |
| Encoding: JSON with base64 fields, or binary | **TBD — team agreement required** |
| Whether envelope metadata is authenticated (AAD) | **TBD — team agreement required** |
| Salt: per vault or new on every write | **TBD — team agreement required** |
| File name, extension, and default location | **TBD — team agreement required** |
| Changing the master password (re-encryption flow) | **TBD — team agreement required** |

### Command behavior

All commands except `generate` need an existing vault and ask for the master password with a hidden prompt.

| Command | Service call | Shows secrets? |
| --- | --- | --- |
| `vault init` | `initVault` | No |
| `vault add` | `addCredential` (+ `generatePassword` with `--generate`) | No |
| `vault get` | `getCredential` | Only with `--show` |
| `vault list` | `listCredentials` | No |
| `vault delete` | `deleteCredential` | No |
| `vault generate` | `generatePassword` | Yes, by design |

#### `vault init`

- **Purpose:** Create a new, empty encrypted vault.
- **Arguments:** None.
- **Behavior:** Prompts for the master password twice (hidden). Calls `initVault`.
- **Success:** Prints `Vault created at <path>.` and exits `0`.
- **Failures:** `VAULT_ALREADY_EXISTS` (an existing vault is never overwritten; there's no `--force`), `INVALID_INPUT` (master password too weak, or the two entries don't match), `STORAGE_ERROR`.
- **Sensitive output:** None.

#### `vault add <name>`

- **Purpose:** Store a new credential.
- **Arguments:** `<name>` required. Optional: `--username <username>`, `--url <url>`, `--notes <notes>`, `--generate`, `--length <n>` (only with `--generate`).
- **Behavior:** Asks for the password with a hidden prompt and confirmation, or creates one with `generatePassword` when `--generate` is given. There's no `--password` flag, so passwords never end up in shell history. Calls `addCredential`.
- **Success:** Prints `Added "<name>".` and exits `0`.
- **Failures:** Unlock errors, `INVALID_INPUT`, `CREDENTIAL_ALREADY_EXISTS`.
- **Sensitive output:** None. A generated password isn't printed; use `vault get <name> --show`.
- **TBD:** `--notes` as a flag also lands in shell history. Whether notes should be prompted for instead is **TBD**.

#### `vault get <name-or-id>`

- **Purpose:** Show one credential.
- **Arguments:** `<name-or-id>` required. Optional: `--show`.
- **Behavior:** Calls `getCredential`.
- **Success:** Prints name, username, URL, and last updated time. Password and notes are masked as `********` unless `--show` is given. Exits `0`.
- **Failures:** Unlock errors, `CREDENTIAL_NOT_FOUND`.
- **Sensitive output:** Only with `--show`. Copying to the clipboard is **TBD** (Node has no built-in cross-platform clipboard).

#### `vault list`

- **Purpose:** List stored credentials.
- **Arguments:** None. A `--json` option is **TBD**.
- **Behavior:** Calls `listCredentials`.
- **Success:** Prints a table of name, username, URL, and last updated time, sorted by name. With an empty vault it prints `No credentials stored.` Exits `0`.
- **Failures:** Unlock errors.
- **Sensitive output:** None. Passwords and notes are never listed.

#### `vault delete <name-or-id>`

- **Purpose:** Remove a credential.
- **Arguments:** `<name-or-id>` required. Optional: `--yes` to skip the confirmation.
- **Behavior:** Asks for the master password, then asks for confirmation unless `--yes` is given, then calls `deleteCredential`.
- **Success:** Prints `Deleted "<name>".` and exits `0`.
- **Failures:** Unlock errors, `CREDENTIAL_NOT_FOUND`, `OPERATION_CANCELLED` (the user declined). Whether cancelling should exit `0` or `1` is **TBD**.
- **Sensitive output:** None.

#### `vault generate`

- **Purpose:** Generate a strong random password. It doesn't need a vault or a master password.
- **Arguments:** Optional: `--length <n>` (default `20`; allowed range 8–128 proposed), `--no-symbols`.
- **Behavior:** Calls `generatePassword` only. It doesn't save anything.
- **Success:** Prints only the password and a newline to stdout, so it can be piped. Exits `0`.
- **Failures:** `INVALID_INPUT` (length out of range).
- **Sensitive output:** Yes, intentionally.

### Team agreement checklist

Everything must be checked off before modules are built in parallel. Each item points to the open questions it still has.

- [ ] **Function names and signatures:** [Function contracts](#function-contracts). Open: where `promptSecret` lives.
- [ ] **Sync versus async behavior:** async for I/O and crypto; sync for validation, `generatePassword`, `resolveVaultPath`.
- [ ] **Error codes and error structure:** [Error contract](#error-contract). Open: finer exit codes, exit code for cancellation, debug output.
- [ ] **Plaintext schema and validation rules:** [Plaintext in-memory data model](#plaintext-in-memory-data-model). Open: field length limits, allowed URL schemes, master password strength rules, generator symbol set, backup before migration.
- [ ] **Module ownership and mutation rules:** [Ownership and mutation rules](#ownership-and-mutation-rules). Open: `string` vs `Buffer` for the master password.
- [ ] **Service-to-module dependencies:** [Module map](#module-map). Open: file locking for concurrent writes.
- [ ] **Command arguments and expected behavior:** [Command behavior](#command-behavior). Open: `vault edit`, `--json` for `list`, clipboard, notes via prompt, global vault path flag, default vault location, non-interactive use.
- [ ] **Encrypted on-disk envelope contract:** [Encrypted on-disk format](#encrypted-on-disk-format). Open: every item in its open decisions table.
- [ ] **Handling of sensitive data and error output:** [Sensitive data rules](#sensitive-data-rules).

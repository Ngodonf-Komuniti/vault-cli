import { generatePassword, addCredential } from '../services/vaultService.js'
import { resolveVaultPath } from '../storage/vaultFile.js'
import { promptSecret } from '../utils/promptSecret.js'
import { VaultError, ErrorCode } from '../utils/errors.js'

export function registerAddCommand(program) {
  program
    .command('add <name>')
    .option('--username <username>', 'Username for the credential')
    .option('--url <url>', 'URL associated with the credential')
    .option('--notes <notes>', 'Additional notes for the credential')
    .option('--generate', 'Generate a random password for the credential')
    .option('--length <n>', 'Length of the generated password', Number)
    .description('Add a new credential to the vault')
    .action(async (name, options) => {
      const { username = '', url = '', notes = '', generate, length } = options

      if (length !== undefined && !generate) {
        throw new VaultError(
          ErrorCode.INVALID_INPUT,
          '--length can only be used with --generate',
        )
      }

      const vaultPath = resolveVaultPath()
      const masterPassword = await promptSecret('master password')
      const password = generate
        ? generatePassword({ length })
        : await promptSecret('credential password', { confirm: true })

      await addCredential(
        { vaultPath, masterPassword },
        { name, username, password, url, notes },
      )
      console.log(`Added "${name}".`)
    })
}
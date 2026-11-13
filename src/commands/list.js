import { listCredentials } from '../services/vaultService.js'
import { resolveVaultPath } from '../storage/vaultFile.js'
import { promptSecret } from '../utils/promptSecret.js'

export function registerListCommand(program) {
  program
    .command('list')
    .description('List all credentials in the vault')
    .action(async () => {
      const vaultPath = resolveVaultPath()
      const masterPassword = await promptSecret('master password')
      const credentials = await listCredentials({
        vaultPath,
        masterPassword,
      })

      if (credentials.length === 0) {
        console.log('No credentials stored.')
        return
      }

      console.table(
        credentials.map((credential) => ({
          Name: credential.name,
          Username: credential.username,
          URL: credential.url,
          UpdatedAt: credential.updatedAt,
        })),
      )
    })
}
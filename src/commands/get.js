import { getCredential } from '../services/vaultService.js'
import { resolveVaultPath } from '../storage/vaultFile.js'
import { promptSecret } from '../utils/promptSecret.js'

export function registerGetCommand(program) {
  program
    .command('get <name-or-id>')
    .description('Get one credential from the vault')
    .option('--show', 'Show the password and notes')
    .action(async (nameOrId, options) => {
      const vaultPath = resolveVaultPath()
      const masterPassword = await promptSecret('master password')
      const credential = await getCredential(
        { vaultPath, masterPassword },
        nameOrId,
      )

      console.log(`Name: ${credential.name}`)
      console.log(`Username: ${credential.username}`)
      console.log(`URL: ${credential.url}`)
      console.log(`Password: ${options.show ? credential.password : '********'}`)
      console.log(`Notes: ${options.show ? credential.notes : '********'}`)
      console.log(`Updated at: ${credential.updatedAt}`)
    })
}
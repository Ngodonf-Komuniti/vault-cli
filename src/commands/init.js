import { resolveVaultPath } from '../storage/vaultFile.js'
import { initVault } from '../services/vaultService.js'
import { promptSecret } from '../utils/promptSecret.js'

export function registerInitCommand(program) {
    program
    .command('init')
    .description('Create a new vault')
    .action(async () => {
        const masterPassword = await promptSecret('master password', {
            confirm: true,
        })

        const vaultPath = resolveVaultPath()
        await initVault({ vaultPath, masterPassword })
        console.log(`Vault created at ${vaultPath}.`)
    })
}

import { promptSecret } from '../utils/promptSecret.js';
import { listCredentials } from '../services/vaultService.js';
import { resolveVaultPath } from '../storage/vaultFile.js';

export function registerListCommand(program) {
  program
    .command('list')
    .description('List all credentials in the vault')
    .action(async () => {
      const masterPassword = await promptSecret('master password');
      const vaultPath = resolveVaultPath();
      const ctx = { masterPassword, vaultPath };
      const credentials = await listCredentials(ctx);

      if (credentials.length === 0) {
        console.log('No credentials stored.');
      } else {
        console.table(credentials.map(cred => ({
          Name: cred.name,
          Username: cred.username,
          URL: cred.url,
          UpdatedAt: cred.updatedAt
        })));
      }
    });
}
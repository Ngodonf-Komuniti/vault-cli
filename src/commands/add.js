import { VaultError, ErrorCode } from '../utils/errors.js';
import { promptSecret } from '../utils/promptSecret.js';
import { addCredential, generatePassword } from '../services/vaultService.js';
import { resolveVaultPath } from '../storage/vaultFile.js';

export function registerAddCommand(program) {
  program
    .command('add <name>')
    .option('--username <username>', 'Username for the credential')
    .option('--url <url>', 'URL associated with the credential')
    .option('--notes <notes>', 'Additional notes for the credential')
    .option('--generate', 'Generate a random password for the credential')
    .option('--length <n>', 'Length of the generated password', parseInt)
    .description('Add a new credential to the vault')
    .action(async (name, options) => {
      const { username = '', url = '', notes = '', generate, length } = options;
      if (length && !generate) {
        throw new VaultError(
          ErrorCode.INVALID_INPUT,
          '--length can only be used with --generate');
      }
      const masterPassword = await promptSecret('master password');

      let password;
      if (generate) {
        password = generatePassword( { length } );
      } else {
        password = await promptSecret('password', { confirm: true});
      }

      const vaultPath = resolveVaultPath();
      const ctx = { vaultPath, masterPassword };
      const input = { name, password, username, url, notes };

      await addCredential(ctx, input);

      console.log(`Added "${name}".`);
    });
}
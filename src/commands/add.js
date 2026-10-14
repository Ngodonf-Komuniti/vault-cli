export function registerAddCommand(program) {
  program
    .command('add <name>')
    .option('--username <username>', 'Username for the credential')
    .option('--url <url>', 'URL associated with the credential')
    .option('--notes <notes>', 'Additional notes for the credential')
    .option('--generate', 'Generate a random password for the credential')
    .option('--length <n>', 'Length of the generated password', parseInt)
    .description('Add a new credential to the vault')
    .action((name, options) => {
      const { username = '', url = '', notes = '', generate, length } = options;
      if (length && !generate) {
        // TODO: Change to VaultError(INVALID_INPUT) when error.js is implemented.
        throw new Error('--length can only be used with --generate');
      }
      console.log(`Adding credential: ${name}`);
      console.log(`Username: ${username}`);
      console.log(`URL: ${url}`);
      console.log(`Notes: ${notes}`);
      console.log(`Generate Password: ${generate}`);
      console.log(`Password Length: ${length}`);
    });
}
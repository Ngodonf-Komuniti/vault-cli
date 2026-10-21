#!/usr/bin/env node
import { createRequire } from 'node:module';
import { Command } from 'commander';
import { registerInitCommand } from './commands/init.js';
import { VaultError } from './utils/errors.js';
import { registerListCommand } from './commands/list.js';
import { registerAddCommand } from './commands/add.js';
import { registerGetCommand } from './commands/get.js';

const require = createRequire(import.meta.url);
const { version } = require('../package.json');

const program = new Command();

program
  .name('vault')
  .description('VaultCLI: a local-first password manager (early stage, not ready for real passwords)')
  .version(version);

registerListCommand(program);

// Temporary command to confirm the CLI is wired up. It does not inspect any vault.
program
  .command('status')
  .description('Confirm the CLI is running (temporary)')
  .action(() => {
    console.log(`VaultCLI v${version} is running.`);
  });

registerAddCommand(program);
registerGetCommand(program);

// With no arguments, show help and exit successfully instead of erroring.
registerInitCommand(program);

// Show help when no command or option was supplied.
if (process.argv.length <= 2) {
  program.help();
}

try {
  await program.parseAsync(process.argv);
} catch (error) {
  if (
    error.code === 'commander.helpDisplayed' ||
    error.code === 'commander.version'
  ) {
    process.exitCode = 0;
  } else if (error instanceof VaultError) {
    console.error(`Error: ${error.message}`);
    process.exitCode = 1;
  } else {
    console.error('Error: An unexpected error occurred.');
    process.exitCode = 1;
  }
}

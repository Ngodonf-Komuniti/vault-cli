#!/usr/bin/env node
import { createRequire } from 'node:module';
import { Command } from 'commander';
import { registerAddCommand } from './commands/add.js';

const require = createRequire(import.meta.url);
const { version } = require('../package.json');

const program = new Command();

program
  .name('vault')
  .description('VaultCLI: a local-first password manager (early stage, not ready for real passwords)')
  .version(version);

// Temporary command to confirm the CLI is wired up. It does not inspect any vault.
program
  .command('status')
  .description('Confirm the CLI is running (temporary)')
  .action(() => {
    console.log(`VaultCLI v${version} is running.`);
  });

registerAddCommand(program);

// With no arguments, show help and exit successfully instead of erroring.
if (process.argv.length <= 2) {
  program.help();
}

await program.parseAsync(process.argv);

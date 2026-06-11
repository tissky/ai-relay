#!/usr/bin/env node

// ============================================================
// AI Relay CLI — Entry Point
// ============================================================

import { Command } from 'commander';

const program = new Command();

program
  .name('ai-relay')
  .version('2.13.0')
  .description('AI Relay Local Runtime CLI');

program
  .command('login <cloud-url>')
  .description('Bind this device to a cloud admin instance')
  .action(async (cloudUrl: string) => {
    console.log('Login not yet implemented');
  });

program
  .command('local')
  .description('Manage local relay server')
  .action(() => {
    program.help();
  });

program.parse();

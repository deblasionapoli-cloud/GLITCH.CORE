/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import * as readline from 'readline';
import { InputHandler } from './src/core/input_handler';
import { Scheduler } from './src/core/scheduler';
import { SSHServer } from './src/core/ssh_server';
import 'dotenv/config';

/**
 * APEX CORE - STANDALONE DAEMON
 * 
 * Run with: npx tsx daemon.ts
 */

const inputHandler = new InputHandler();
const sshServer = new SSHServer(inputHandler);

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: false
});

rl.on('line', (line) => {
  inputHandler.handleInput(line);
});

console.clear();

const scheduler = new Scheduler(inputHandler, (frame) => {
  // Clear screen and reset cursor for local terminal
  process.stdout.write('\x1b[2J\x1b[0;0H');
  process.stdout.write(frame);
  
  // Also broadcast to SSH clients
  sshServer.broadcastFrame(frame);
});

// Configure SSH port from ENV or default to 2222
const sshPort = parseInt(process.env.SSH_PORT || '2222', 10);
sshServer.listen(sshPort);

scheduler.start();

process.on('SIGINT', () => {
  scheduler.stop();
  process.exit();
});

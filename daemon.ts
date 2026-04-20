/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import * as readline from 'readline';
import { InputHandler } from './src/core/input_handler';
import { Scheduler } from './src/core/scheduler';

/**
 * APEX CORE - STANDALONE DAEMON
 * 
 * Run with: npx tsx daemon.ts
 */

const inputHandler = new InputHandler();

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
  // Clear screen and reset cursor
  process.stdout.write('\x1b[2J\x1b[0;0H');
  process.stdout.write(frame);
});

scheduler.start();

process.on('SIGINT', () => {
  scheduler.stop();
  process.exit();
});

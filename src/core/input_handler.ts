/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Event } from './types';

export class InputHandler {
  private queue: Event[] = [];

  constructor() {}

  /**
   * Process raw string input from SSH or Terminal
   */
  public handleInput(raw: string): void {
    const trimmed = raw.trim();
    if (!trimmed) return;

    let event: Event;

    // Check if it's a command
    const commands = ['ping', 'calm', 'attack', 'glitch', 'speak', 'status', 'stream', 'ai_response'];
    const firstWord = trimmed.split(' ')[0].toLowerCase();

    if (commands.includes(firstWord)) {
      event = {
        type: 'command',
        payload: trimmed,
        timestamp: Date.now()
      };
    } else {
      event = {
        type: 'intent',
        payload: trimmed,
        timestamp: Date.now()
      };
    }

    this.queue.push(event);
  }

  public drainQueue(): Event[] {
    const events = [...this.queue];
    this.queue = [];
    return events;
  }
}

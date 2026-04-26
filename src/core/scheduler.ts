/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { State, INITIAL_STATE } from './types';
import { updateState } from './state_engine';
import { renderFrame } from './renderer';
import { InputHandler } from './input_handler';

export class Scheduler {
  private state: State = { ...INITIAL_STATE };
  private inputHandler: InputHandler;
  private onFrame: (frame: string, state: State) => void;
  private interval: NodeJS.Timeout | null = null;
  private tickRate = 166; // 6 FPS

  constructor(inputHandler: InputHandler, onFrame: (frame: string, state: State) => void) {
    this.inputHandler = inputHandler;
    this.onFrame = onFrame;
  }

  public start(): void {
    if (this.interval) return;

    this.interval = setInterval(() => {
      this.tick();
    }, this.tickRate);
  }

  public stop(): void {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }

  private tick(): void {
    const events = this.inputHandler.drainQueue();
    this.state = updateState(this.state, events);
    const frame = renderFrame(this.state);
    this.onFrame(frame, this.state);
  }
}

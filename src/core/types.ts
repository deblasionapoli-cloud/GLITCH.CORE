/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type EmotionState = 'calm' | 'alert' | 'attack' | 'glitch';

export interface Event {
  type: 'command' | 'intent';
  payload: string;
  timestamp: number;
}

export interface State {
  emotion_state: EmotionState;
  intensity: number; // 0-100
  animation_phase: number;
  stream_mode: boolean;
  event_history: Event[];
  last_speech: string;
}

export const INITIAL_STATE: State = {
  emotion_state: 'calm',
  intensity: 0,
  animation_phase: 0,
  stream_mode: false,
  event_history: [],
  last_speech: 'SYSTEM IDLE. CORE WARM.',
};

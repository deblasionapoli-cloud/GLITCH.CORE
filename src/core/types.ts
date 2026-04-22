/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type EmotionState = 'calm' | 'alert' | 'attack' | 'glitch' | 'curious' | 'surprised';

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
  speech_queue: string[];
  last_command_phase: number;
  visual_scale: number; // 0.95 - 1.1
  color_mode: 'standard' | 'warm';
}

export const INITIAL_STATE: State = {
  emotion_state: 'calm',
  intensity: 0,
  animation_phase: 0,
  stream_mode: false,
  event_history: [],
  last_speech: 'SYSTEM IDLE. CORE WARM.',
  speech_queue: [],
  last_command_phase: -1,
  visual_scale: 1.0,
  color_mode: 'standard',
};

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type EmotionState = 'calm' | 'alert' | 'attack' | 'glitch' | 'smug' | 'panic';

export interface Particle {
  x: number;
  y: number;
  char: string;
  life: number;
}

export interface Event {
  type: 'command' | 'intent';
  payload: string;
  timestamp: number;
}

export interface State {
  emotion_state: EmotionState;
  intensity: number; // 0-100
  entropy: number;   // 0-100
  stability: number; // 0-100
  animation_phase: number;
  stream_mode: boolean;
  event_history: Event[];
  particles: Particle[];
  smoke: Particle[];
  intrusion_alert: boolean;
  
  // Speech Core
  last_speech: string;     // Target full string
  display_speech: string;  // Currently rendered string (typewriter)
  speech_char_idx: number; // Character pointer
  speech_speed: number;    // Animation interval (ticks per char)
  speech_sentiment: 'positive' | 'neutral' | 'negative' | 'chaotic';
}

export const INITIAL_STATE: State = {
  emotion_state: 'calm',
  intensity: 0,
  entropy: 10,
  stability: 90,
  animation_phase: 0,
  stream_mode: false,
  event_history: [],
  particles: [],
  smoke: [],
  intrusion_alert: false,
  last_speech: 'APEX CORE ONLINE. STABILITY NOMINAL.',
  display_speech: 'APEX CORE ONLINE. STABILITY NOMINAL.',
  speech_char_idx: 0,
  speech_speed: 1,
  speech_sentiment: 'neutral',
};

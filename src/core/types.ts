/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type EmotionState = 'calm' | 'alert' | 'attack' | 'glitch' | 'curious' | 'surprised';
export type MorphType = 'blob' | 'spiky' | 'hardware' | 'eye' | 'pulse' | 'ditto' | 'custom';

export interface Event {
  type: 'command' | 'intent';
  payload: string;
  timestamp: number;
}

export interface State {
  emotion_state: EmotionState;
  current_morph: MorphType;
  morph_target: MorphType;
  intensity: number; // 0-100
  animation_phase: number;
  stream_mode: boolean;
  event_history: Event[];
  last_speech: string;
  speech_queue: string[];
  last_command_phase: number;
  visual_scale: number; // 0.95 - 1.1
  color_mode: 'standard' | 'warm';
  hardware_metrics?: {
    cpu_temp: number;
    ram_usage: number;
    clock_speed: number;
    cpu_usage: number;
    gpu_usage: number;
  };
  context_memory: string[]; // Recent news patterns
  is_thinking: boolean; // Prevenzione chiamate multiple
  custom_sprite?: string; // DNA visivo dinamico
}

export const INITIAL_STATE: State = {
  emotion_state: 'calm',
  current_morph: 'blob',
  morph_target: 'blob',
  intensity: 0,
  animation_phase: 0,
  stream_mode: false,
  event_history: [],
  last_speech: 'SYSTEM IDLE. CORE WARM.',
  speech_queue: [],
  last_command_phase: -1,
  visual_scale: 1.0,
  color_mode: 'standard',
  hardware_metrics: {
    cpu_temp: 42,
    ram_usage: 12,
    clock_speed: 1.5,
    cpu_usage: 5,
    gpu_usage: 2
  },
  context_memory: [],
  is_thinking: false,
};

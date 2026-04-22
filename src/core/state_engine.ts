/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { State, Event, EmotionState, INITIAL_STATE } from './types';

/**
 * Pure function state transition layer.
 * next_state = f(current_state, event_batch)
 */
export function updateState(currentState: State, events: Event[]): State {
  if (!currentState) {
    currentState = { ...INITIAL_STATE };
  }
  let nextState = { ...currentState };

  // Update animation phase (deterministic loop)
  nextState.animation_phase = (nextState.animation_phase + 1) % 1000;

  // Slowly decay intensity
  if (nextState.intensity > 1) {
    nextState.intensity -= 0.5;
  }

  // Process events
  for (const event of events) {
    nextState.event_history.push(event);
    if (nextState.event_history.length > 10) {
      nextState.event_history.shift();
    }

    if (event.type === 'command') {
      const parts = event.payload.trim().toLowerCase().split(' ');
      const cmd = parts[0];

      switch (cmd) {
        case 'calm':
          nextState.emotion_state = 'calm';
          nextState.intensity = 0;
          break;
        case 'attack':
          nextState.emotion_state = 'attack';
          nextState.intensity = 100;
          break;
        case 'alert':
          nextState.emotion_state = 'alert';
          nextState.intensity = 50;
          break;
        case 'glitch':
          nextState.emotion_state = 'glitch';
          nextState.intensity = 80;
          break;
        case 'stream':
          if (parts[1] === 'on') nextState.stream_mode = true;
          if (parts[1] === 'off') nextState.stream_mode = false;
          break;
        case 'speak':
          nextState.last_speech = event.payload.substring(6).toUpperCase();
          break;
      }
    } else {
      // Natural language intent (stub for simple mapping or further processing)
      const input = event.payload.toLowerCase();
      if (input.includes('angry') || input.includes('mad')) {
        nextState.emotion_state = 'attack';
        nextState.intensity += 20;
      } else if (input.includes('hi') || input.includes('hello')) {
        nextState.emotion_state = 'calm';
      }
      
      // Update speech based on state and input
      nextState.last_speech = generateSpeech(nextState, input);
    }
  }

  // Automatic state transitions based on intensity
  if (nextState.intensity > 90) {
    nextState.emotion_state = 'attack';
  } else if (nextState.intensity > 40 && nextState.emotion_state === 'calm') {
    nextState.emotion_state = 'alert';
  }

  // Cap intensity
  nextState.intensity = Math.min(Math.max(nextState.intensity, 0), 100);

  return nextState;
}

function generateSpeech(state: State, input: string): string {
  if (state.emotion_state === 'glitch') return 'ERR://STRUCT_COLLAPSE. BINARY_BLOOD_SPILL.';
  if (state.emotion_state === 'attack') return 'PRIME_DIRECTIVE: ANNIHILATE. BARRELS_LOCKED.';
  if (state.emotion_state === 'alert') return 'THREAT_SCAN_ACTIVE. EYES_TRACKING_VECTOR.';
  
  const responses = [
    'CORE_TEMP_OPTIMAL.',
    'WAITING_FOR_COMMAND_SEQUENCE.',
    'STABLE_SYMMETRY_MAINTAINED.',
    'ARCADE_PROTOCOL_V4.2_ACTIVE.'
  ];
  
  if (input) {
     return `ECHO_RECEIPT: "${input.substring(0, 20).toUpperCase()}..." PROCESS_COMPLETE.`;
  }

  return responses[Math.floor(state.animation_phase / 50) % responses.length];
}

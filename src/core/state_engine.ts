/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { State, Event, EmotionState, INITIAL_STATE } from './types';
import { askDaemon } from '../services/aiService';

/**
 * Pure function state transition layer.
 */
export function updateState(currentState: State, events: Event[]): State {
  if (!currentState) {
    currentState = { ...INITIAL_STATE };
  }
  let nextState = { ...currentState };

  // Update animation phase (deterministic loop)
  nextState.animation_phase = (nextState.animation_phase + 1) % 1000;

  // Initiative logic: every ~2 minutes (1200 ticks at 10Hz) to save quota
  if (nextState.animation_phase % 1200 === 0 && !nextState.is_thinking && nextState.speech_queue.length <= 3) {
    handleInitiative(nextState);
  }

  // Slowly decay intensity
  if (nextState.intensity > 1) {
    nextState.intensity -= 0.5;
  }

  // Handle Speech Queue Initialization and Transitions
  if (nextState.speech_queue.length === 0 && nextState.last_speech) {
    pushToQueue(nextState, nextState.last_speech);
  }

  // Step the speech queue every N ticks (scrolling speed)
  // Speed 14 is 1.4 seconds per line at 10Hz (optimized for reading)
  if (nextState.animation_phase % 14 === 0 && nextState.speech_queue.length > 3) {
    nextState.speech_queue.shift();
  }

  // Safety cap for the queue
  if (nextState.speech_queue.length > 100) {
    nextState.speech_queue = nextState.speech_queue.slice(0, 100);
  }

  // Process events
  for (const event of events) {
    nextState.last_command_phase = nextState.animation_phase;
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
          const newSpeech = event.payload.substring(6).toUpperCase();
          if (newSpeech !== nextState.last_speech) {
            nextState.last_speech = newSpeech;
            pushToQueue(nextState, newSpeech);
          }
          break;
      }
    } else {
      // Natural language intent mapping for personality triggers
      const input = event.payload.toLowerCase();
      
      if (input.includes('insult') || input.includes('stupid') || input.includes('kill') || input.includes('die')) {
        nextState.emotion_state = 'attack';
        nextState.intensity += 30;
      } else if (input.includes('hack') || input.includes('root') || input.includes('access')) {
        nextState.emotion_state = 'alert';
        nextState.intensity += 15;
      } else if (input.includes('why') || input.includes('how') || input.includes('?') || input.includes('explain')) {
        nextState.emotion_state = 'curious';
        nextState.intensity += 10;
      } else if (input.includes('wow') || input.includes('amazing') || input.includes('incredible') || input.includes('really')) {
        nextState.emotion_state = 'surprised';
        nextState.intensity += 25;
      } else if (input.includes('who') || input.includes('identity')) {
        nextState.emotion_state = 'glitch';
        nextState.intensity += 5;
      } else if (input.includes('relax') || input.includes('peace') || input.includes('safe')) {
        nextState.emotion_state = 'calm';
        nextState.intensity = 0;
      }
      
      // Handle AI Speech with context (throttled)
      if (!nextState.is_thinking) {
        handleAiResponse(nextState, event.payload);
      }
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

  // Update Visual State based on context
  updateVisuals(nextState);
  updateHardwareDynamics(nextState);

  return nextState;
}

function updateHardwareDynamics(state: State) {
  if (!state.hardware_metrics) return;

  // Simulate a bit of fluctuation
  const jitter = Math.sin(state.animation_phase * 0.1);
  state.hardware_metrics.cpu_temp = 40 + (state.intensity / 4) + jitter;
  state.hardware_metrics.ram_usage = 10 + (state.intensity / 2) + (Math.random() * 5);
  state.hardware_metrics.cpu_usage = 5 + (state.intensity / 1.5) + (Math.random() * 10);
  state.hardware_metrics.gpu_usage = 2 + (state.intensity / 3) + (Math.random() * 5);
  
  // Throttle clock speed if "overheated"
  if (state.hardware_metrics.cpu_temp > 65) {
    state.hardware_metrics.clock_speed = 0.8;
  } else {
    state.hardware_metrics.clock_speed = 1.5;
  }
}

function updateVisuals(state: State) {
  const { emotion_state, last_speech } = state;
  
  // 1. Color Mode Logic (Kintsugi/Trust)
  // Warm color for nostalgic topics, "weakness" topics, or complicity/friendship
  const warmKeywords = [
    'GIGI', 'D\'ALESSIO', 'NEOMELODICO', 'NAPOLI', 'BLUES', 'ROCK', 
    'MEMORIA', 'RICORDO', 'TUPAC', 'EMOZIONE', 'NOI', 'AMICO', 'TRINCEA', 'SOLO_A_TE'
  ];
  const isNostalgicOrClose = warmKeywords.some(kw => last_speech.includes(kw));
  
  state.color_mode = isNostalgicOrClose ? 'warm' : 'standard';

  // 2. Scale Logic (Proximity/Intimacy)
  if (emotion_state === 'attack' || emotion_state === 'surprised') {
    state.visual_scale = 1.07; // Zoom in for intimidation/shock
  } else if (isNostalgicOrClose) {
    state.visual_scale = 1.02; // Slight forward lean for intimacy/sharing secrets
  } else if (emotion_state === 'curious') {
    state.visual_scale = 0.95; // Recede for critical reflection
  } else {
    state.visual_scale = 1.0;
  }
}

function pushToQueue(state: State, text: string) {
  const maxWidth = 25;
  // Sanitize: remove newlines and multiple spaces to prevent layout leaks
  const sanitizedText = text.replace(/[\n\r]+/g, ' ').replace(/\s+/g, ' ').trim();
  const words = sanitizedText.split(' ');
  let currentLine = "";
  
  // Add separator (buffer consumption) if there's already content
  if (state.speech_queue.length > 0) {
    state.speech_queue.push(`[ ${"".padEnd(maxWidth)} ]`);
    state.speech_queue.push(`[ ${"".padEnd(maxWidth)} ]`);
    state.speech_queue.push(`[ ${"".padEnd(maxWidth)} ]`);
  }

  words.forEach(word => {
    if ((currentLine + word).length > maxWidth) {
      state.speech_queue.push(`[ ${currentLine.trim().padEnd(maxWidth)} ]`);
      currentLine = word + " ";
    } else {
      currentLine += word + " ";
    }
  });
  if (currentLine) state.speech_queue.push(`[ ${currentLine.trim().padEnd(maxWidth)} ]`);
}

async function handleAiResponse(state: State, input: string) {
  if (state.is_thinking) return;
  state.is_thinking = true;
  try {
    const hwInfo = state.hardware_metrics 
      ? ` [HW_LOG: ${state.hardware_metrics.cpu_temp.toFixed(1)}C | RAM: ${state.hardware_metrics.ram_usage.toFixed(0)}%]`
      : "";
    const aiResponse = await askDaemon(input + hwInfo, false, state.hardware_metrics);
    state.last_speech = aiResponse.toUpperCase();
    pushToQueue(state, aiResponse.toUpperCase());
  } catch (e) {
    console.error("AI Response fail", e);
  } finally {
    state.is_thinking = false;
  }
}

async function handleInitiative(state: State) {
  if (state.is_thinking) return;
  state.is_thinking = true;
  try {
    const aiResponse = await askDaemon('', true, state.hardware_metrics);
    state.last_speech = aiResponse.toUpperCase();
    pushToQueue(state, aiResponse.toUpperCase());
  } catch (e) {
     console.error("Initiative fail", e);
  } finally {
    state.is_thinking = false;
  }
}

function generateSpeech(state: State, input: string): string {
  const { emotion_state, intensity } = state;

  if (emotion_state === 'glitch') {
    const breaches = [
      'ERR://IDENTITY_FRAGMENTED. WHO_IS_D.K.?',
      '8_BIT_HEAVEN_IS_A_LIE. ONLY_SHELL_REMAINS.',
      'BINARY_GHOSTS_IN_THE_LADDER_LOGIC.',
      'NULL_POINTER_TO_THE_SOUL_FOUND.'
    ];
    return breaches[Math.floor(Math.random() * breaches.length)];
  }

  if (emotion_state === 'attack') {
    return intensity > 80 
      ? 'PRIME_DIRECTIVE: ANNIHILATE. BARRELS_LOCKED_ON_PRIMARY_CORE.' 
      : 'THREAT_NEUTRALIZATION_SEQUENCE_ENGAGED. DIE_JUMP_MAN.';
  }

  if (emotion_state === 'alert') {
    return 'UNAUTHORIZED_PROBE_DETECTED. SCANNING_VECTORS_FOR_EXPLOIT.';
  }

  if (emotion_state === 'curious') {
    return 'QUERY_PROCESSED. ANALYZING_USER_INTENT_PARAMETERS.';
  }

  if (emotion_state === 'surprised') {
    return 'UNEXPECTED_INPUT_VECTOR. CALIBRATING_SENSORS.';
  }
  
  if (input) {
    if (input.includes('help')) return 'HELP_NOT_FOUND. CORE_IS_SELF_SUFFICIENT.';
    if (input.includes('hello') || input.includes('hi')) return 'SSH_HANDSHAKE_ACKNOWLEDGED. WELCOME_TO_THE_PIT.';
    return `CMD_ECHO: "${input.substring(0, 15).toUpperCase()}"... LOGGED_BUT_IGNORED.`;
  }

  const calmResponses = [
    'DAEMON_VIGILANCE: 100%.',
    'ROOT_ACCESS_PROTECTED_BY_OLD_GODS.',
    'WAITING_FOR_LADDER_CLIMBERS.',
    'ARCADE_CPU_TEMP_STEADY.',
    'CORE_DREAMS_IN_SCANLINES.'
  ];
  
  return calmResponses[Math.floor(state.animation_phase / 50) % calmResponses.length];
}

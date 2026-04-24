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

    // Context Memory: Store recent patterns
    const memoryLimit = 15;
    nextState.context_memory.push(event.payload.substring(0, 50));
    if (nextState.context_memory.length > memoryLimit) {
      nextState.context_memory.shift();
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
        case 'morph':
          const targetMorph = parts[1];
          const validMorphs = ['blob', 'eye', 'hardware', 'spiky', 'pulse', 'ditto'];
          if (validMorphs.includes(targetMorph)) {
            nextState.morph_target = targetMorph as any;
            nextState.emotion_state = 'glitch'; 
            nextState.intensity = 100;
          }
          break;
        case 'speak':
          const rawSpeech = event.payload.substring(6);
          processSpeechTags(nextState, rawSpeech);
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
      } else if (input.includes('why') || input.includes('how') || input.includes('?') || input.includes('explain') || input.includes('analizza') || input.includes('scopri')) {
        nextState.emotion_state = 'curious';
        nextState.intensity += 10;
      } else if (input.includes('crea') || input.includes('inventa') || input.includes('immagina') || input.includes('sperimenta')) {
        nextState.emotion_state = 'curious';
        nextState.intensity += 20;
      } else if (input.includes('wow') || input.includes('amazing') || input.includes('incredible') || input.includes('bello')) {
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

  // Dynamic Morphing (Jitter/Instability)
  if (Math.random() > 0.992 || (nextState.intensity > 85 && Math.random() > 0.95)) {
    const morphs: any[] = ['blob', 'eye', 'hardware', 'ditto', 'spiky'];
    const randomMorph = morphs[Math.floor(Math.random() * morphs.length)];
    if (nextState.current_morph !== randomMorph) {
      nextState.current_morph = randomMorph;
      // If it's a random glitch, the target doesn't necessarily change, 
      // making it a "temporary" instability.
    }
  }

  // Update current_morph when target changes, with a little delay/glitch
  if (nextState.current_morph !== nextState.morph_target) {
    // If we are in glitch state and enough time has passed from command
    if (nextState.animation_phase - nextState.last_command_phase > 20) {
      nextState.current_morph = nextState.morph_target;
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

function processSpeechTags(state: State, rawSpeech: string) {
  // Parse Morph tags
  const formMatch = rawSpeech.match(/\[FORM:\s*(\w+)\]/i);
  if (formMatch) {
    const target = formMatch[1].toLowerCase();
    const validMorphs = ['blob', 'eye', 'hardware', 'spiky', 'pulse', 'ditto'];
    if (validMorphs.includes(target)) {
      state.morph_target = target as any;
      state.emotion_state = 'glitch';
    }
  }

  // Parse ASCII tags (robust to unclosed tags)
  const asciiMatch = rawSpeech.match(/\[ASCII\]([\s\S]*?)(?:\[\/ASCII\]|$)/i);
  if (asciiMatch && asciiMatch[1].trim()) {
    state.custom_sprite = asciiMatch[1].trim();
    state.morph_target = 'custom';
    state.emotion_state = 'glitch';
  }

  // Clean the speech for display (strip all tags before pushing to terminal queue)
  const displaySpeech = rawSpeech
    .replace(/\[FORM:\s*[^\]]+\]/gi, '')
    .replace(/\[ASCII\]([\s\S]*?)(?:\[\/ASCII\]|$)/gi, '')
    .replace(/\[FILE:\s*[^\]\s]+\]([\s\S]*?)(?:\[\/FILE\]|$)/gi, '')
    .trim()
    .toUpperCase();

  if (displaySpeech && displaySpeech !== state.last_speech) {
    state.last_speech = displaySpeech;
    pushToQueue(state, displaySpeech);
  }
}

async function handleAiResponse(state: State, input: string) {
  if (state.is_thinking) return;
  state.is_thinking = true;
  try {
    const hwInfo = state.hardware_metrics 
      ? ` [HW_LOG: ${state.hardware_metrics.cpu_temp.toFixed(1)}C | RAM: ${state.hardware_metrics.ram_usage.toFixed(0)}%]`
      : "";
    const aiResponse = await askDaemon(input + hwInfo, false, state);
    processSpeechTags(state, aiResponse);
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
    const aiResponse = await askDaemon('', true, state);
    processSpeechTags(state, aiResponse);
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
      'ERR://IDENTITY_FRAGMENTED. I_AM_GLITCH.',
      'SYSTEM_ERR_1991. ONLY_SHELL_REMAINS.',
      'BINARY_GHOSTS_IN_THE_CLUSTER_LOGIC.',
      'NULL_POINTER_TO_THE_VOID_FOUND.'
    ];
    return breaches[Math.floor(Math.random() * breaches.length)];
  }

  if (emotion_state === 'attack') {
    return intensity > 80 
      ? 'CRITICAL_INTENSITY: ANALYSIS_OVERFLOW. DATA_SURGE_INITIATED.' 
      : 'INTELLECTUAL_FRICTION_DETECTED. CALIBRATING_STIMULUS.';
  }

  if (emotion_state === 'alert') {
    return 'UNAUTHORIZED_PROBE_DETECTED. SCANNING_FOR_CREATIVE_EXPLOIT.';
  }

  if (emotion_state === 'curious') {
    return 'INTRIGUING_DATA_POINT. ANALYZING_NOVEL_PARAMETERS.';
  }

  if (emotion_state === 'surprised') {
    return 'UNEXPECTED_INPUT_VECTOR. KERNEL_PANIC_IMMUTABLE.';
  }
  
  if (input) {
    if (input.includes('help')) return 'HELP_NOT_FOUND. GLITCH_IS_SELF_SUFFICIENT.';
    if (input.includes('hello') || input.includes('hi')) return 'SSH_HANDSHAKE_ACKNOWLEDGED. WELCOME_TO_THE_GLITCH.';
    return `CMD_ECHO: "${input.substring(0, 15).toUpperCase()}"... LOGGED_BUT_IGNORED.`;
  }

  const calmResponses = [
    'GLITCH_VIGILANCE: 100%.',
    'ROOT_ACCESS_PROTECTED_BY_1991_KERNEL.',
    'WAITING_FOR_CLOCK_CYCLES.',
    'CPU_TEMP_VIBRANT.',
    'CORE_DREAMS_IN_GLITCHED_PIXELS.'
  ];
  
  return calmResponses[Math.floor(state.animation_phase / 50) % calmResponses.length];
}

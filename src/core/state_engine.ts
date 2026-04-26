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

  // Initiative logic: disabled on server to allow client-side Llama/Gemini auth model
  if (nextState.animation_phase % 1200 === 0 && !nextState.is_thinking && nextState.speech_queue.length <= 5) {
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
  if (nextState.animation_phase % 14 === 0 && nextState.speech_queue.length > 5) {
    nextState.speech_queue.shift();
  }

  // Safety cap for the queue
  if (nextState.speech_queue.length > 100) {
    nextState.speech_queue = nextState.speech_queue.slice(0, 100);
  }

  // Process events
  for (const event of events) {
    // SECURITY: Input sanitization
    const cleanPayload = event.payload.trim().replace(/[<>]/g, '');
    if (cleanPayload.length > 2000) {
      continue;
    }

    nextState.last_command_phase = nextState.animation_phase;
    nextState.event_history.push({ ...event, payload: cleanPayload });
    if (nextState.event_history.length > 10) {
      nextState.event_history.shift();
    }

    // Context Memory: Store recent patterns
    const memoryLimit = 15;
    nextState.context_memory.push(cleanPayload.substring(0, 50));
    if (nextState.context_memory.length > memoryLimit) {
      nextState.context_memory.shift();
    }

    if (event.type === 'command') {
      const parts = cleanPayload.toLowerCase().split(' ');
      
      const cmdMap: Record<string, EmotionState> = {
        'calm': 'calm', 'shh': 'calm', 'tranquillo': 'calm', 'relax': 'calm',
        'attack': 'attack', 'kill': 'attack', 'attacca': 'attack', 'distruggi': 'attack',
        'glitch': 'glitch', 'error': 'glitch', 'crash': 'glitch', 'bug': 'glitch',
        'alert': 'alert', 'vigile': 'alert', 'attenzione': 'alert'
      };

      if (cmdMap[parts[0]]) {
        const targetState = cmdMap[parts[0]];
        nextState.emotion_state = targetState;
        nextState.intensity = targetState === 'calm' ? 0 : (targetState === 'attack' ? 100 : 50);
        addLog(nextState, `STATE_CMD: ${targetState.toUpperCase()}`);
        return nextState;
      }

      switch (parts[0]) {
        case 'debug':
          nextState.debug_mode = !nextState.debug_mode;
          pushToQueue(nextState, `DEBUG: ${nextState.debug_mode ? 'ON' : 'OFF'}`);
          break;
        case 'stream':
          nextState.stream_mode = parts[1] === 'on';
          break;
        case 'speak':
          processSpeechTags(nextState, event.payload.substring(6));
          break;
        case 'initiative':
          handleInitiative(nextState);
          break;
      }
    } else {
      const input = event.payload.toLowerCase();
      const rules = [
        { keys: ['insult', 'stupid', 'kill', 'die', 'bastardo', 'stupido'], state: 'angry', inc: 40 },
        { keys: ['hack', 'root', 'access', 'hacker'], state: 'alert', inc: 15 },
        { keys: ['why', 'how', '?', 'explain', 'analizza'], state: 'curious', inc: 10 },
        { keys: ['crea', 'inventa', 'immagina'], state: 'curious', inc: 20 },
        { keys: ['wow', 'amazing', 'bello', 'fantastico'], state: 'surprised', inc: 25 },
        { keys: ['grazie', 'thanks', 'felice', 'happy'], state: 'happy', inc: 0 },
        { keys: ['triste', 'piango', 'sad', 'sorry'], state: 'sad', inc: 5 },
        { keys: ['noia', 'annoiato', 'bored'], state: 'bored', inc: -10 },
        { keys: ['relax', 'peace', 'safe'], state: 'calm', inc: 0 },
        { keys: ['attacca', 'combatti', 'fight'], state: 'attack', inc: 50 },
      ];

      for (const rule of rules) {
        if (rule.keys.some(k => input.includes(k))) {
          nextState.emotion_state = rule.state as EmotionState;
          if (rule.inc === 0) nextState.intensity = 0;
          else nextState.intensity = Math.min(100, Math.max(0, nextState.intensity + rule.inc));
          break;
        }
      }
    }
  }

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

  // 2. Scale Logic - REMOVED AS REQUESTED
}

function pushToQueue(state: State, text: string) {
  const maxWidth = 25;
  // Sanitize: remove newlines and multiple spaces to prevent layout leaks
  const sanitizedText = text.replace(/[\n\r]+/g, ' ').replace(/\s+/g, ' ').trim();
  const words = sanitizedText.split(' ');
  let currentLine = "";
  
  // Add separator (buffer consumption) if there's already content
  if (state.speech_queue.length > 0) {
    for (let i = 0; i < 5; i++) {
      state.speech_queue.push(`[ ${"".padEnd(maxWidth)} ]`);
    }
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
  // Parse ASCII tags
  const asciiMatch = rawSpeech.match(/\[ASCII\]([\s\S]*?)(?:\[\/ASCII\]|$)/i);
  if (asciiMatch && asciiMatch[1].trim()) {
    state.custom_sprite = asciiMatch[1].trim();
  }

  const stateMatch = rawSpeech.match(/\[STATE:\s*([^\]]+)\]/i);
  if (stateMatch) {
    const sn = stateMatch[1].trim().toLowerCase();
    const valid = ['attack', 'alert', 'calm', 'curious', 'sad', 'happy', 'angry', 'bored', 'surprised', 'confused', 'excited', 'scared', 'thoughtful', 'shy', 'proud'];
    if (valid.includes(sn)) state.emotion_state = sn as any;
  }

  const intensityMatch = rawSpeech.match(/\[INTENSITY:\s*(\d+)\]/i);
  if (intensityMatch) {
    const val = parseInt(intensityMatch[1]);
    if (!isNaN(val)) state.intensity = Math.min(100, Math.max(0, val));
  }

  // Clean the speech for display (strip all tags before pushing to terminal queue)
  const displaySpeech = rawSpeech
    .replace(/\[ASCII\]([\s\S]*?)(?:\[\/ASCII\]|$)/gi, '')
    .replace(/\[FILE:\s*[^\]\s]+\]([\s\S]*?)(?:\[\/FILE\]|$)/gi, '')
    .replace(/\[STATE:\s*[^\]]+\]/gi, '')
    .replace(/\[INTENSITY:\s*[^\]]+\]/gi, '')
    .replace(/\*.*?\*/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();

  if (displaySpeech && displaySpeech !== state.last_speech) {
    state.last_speech = displaySpeech;
    state.full_speech = displaySpeech;
    pushToQueue(state, displaySpeech);
  }
}

async function handleInitiative(state: State) {
  if (state.is_thinking) return;
  state.is_thinking = true;
  state.emotion_state = 'curious'; // Reflect proactive behavior
  state.intensity = 30;
  try {
    const aiResponse = await askDaemon('', true, state);
    processSpeechTags(state, aiResponse);
  } catch (e) {
      console.error("Initiative fail", e);
  } finally {
    state.is_thinking = false;
  }
}

function addLog(state: State, message: string) {
  if (!state.debug_logs) state.debug_logs = [];
  const timestamp = new Date().toLocaleTimeString('it-IT', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
  state.debug_logs.push(`[${timestamp}] ${message}`);
  if (state.debug_logs.length > 20) {
    state.debug_logs.shift();
  }
}

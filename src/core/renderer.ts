/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { State } from './types';

/**
 * Pure transformation layer: State -> ASCII Frame
 */
export function renderFrame(state: State): string {
  if (!state) {
    return "ERROR: STATE_UNDEFINED\n[ SYSTEM_HALTED ]";
  }
  const { emotion_state, animation_phase, intensity } = state;
  const iScale = intensity / 100;
  const isGlitched = emotion_state === 'glitch';

  // 1. Dynamic Jitter scaling
  let jitter = "";
  if (isGlitched || emotion_state === 'attack' || iScale > 0.4) {
    const jitterThreshold = 0.95 - (iScale * 0.2);
    jitter = Math.random() > jitterThreshold ? (Math.random() > 0.5 ? "  " : "    ") : "";
  }

  // 2. High-Fidelity Blinking
  const blinkInterval = isGlitched ? 60 : 180;
  const isBlinking = (animation_phase % blinkInterval < 4) || (isGlitched && Math.random() > 0.9);

  // 3. Eye Movement & Noise
  const eyePos = Math.floor(animation_phase / 30) % 3;
  const isProcessing = state.last_command_phase >= 0 && (animation_phase - state.last_command_phase < 5);
  const isCalmIdle = emotion_state === 'calm' && Math.random() > 0.92;
  const isEarTwitch = isCalmIdle && Math.random() > 0.5;
  
  let eyeL = " O ";
  let eyeR = " O ";
  
  if (isBlinking) {
    eyeL = " - ";
    eyeR = " - ";
  } else if (isProcessing) {
    eyeL = " * ";
    eyeR = " * ";
  } else if (isCalmIdle && Math.random() > 0.4) {
    // Subtle eye dart
    eyeL = Math.random() > 0.5 ? " . " : " , ";
    eyeR = Math.random() > 0.5 ? " . " : " , ";
  } else if (emotion_state === 'attack') {
    const symbols = [" > ", " # ", " X ", " ! ", " < "];
    eyeL = symbols[animation_phase % symbols.length];
    eyeR = symbols[(animation_phase + 1) % symbols.length];
  } else if (emotion_state === 'curious') {
    // Investigative scanning eyes
    const scan = Math.floor(animation_phase / 10) % 4;
    const eyeFrames = [" o ", " . ", " o ", " O "];
    eyeL = eyeFrames[scan];
    eyeR = eyeFrames[(scan + 2) % 4];
  } else if (emotion_state === 'surprised') {
    eyeL = " 0 ";
    eyeR = " 0 ";
  } else if (isGlitched) {
    const noise = ["%", "&", "X", "$", "!", "?", "0", "1", "@", "#", "{}", "][", "||"];
    eyeL = ` ${noise[Math.floor(Math.random() * noise.length)]} `;
    eyeR = ` ${noise[Math.floor(Math.random() * noise.length)]} `;
  } else {
    eyeL = eyePos === 1 ? " o " : " O ";
    eyeR = eyePos === 1 ? " o " : " O ";
  }

  // 4. Base Components (Full Carhartt Winter Hat)
  const hatLines = [
    "      .-----------------.      ",
    "     /      _______      \\     ",
    "    |      |       |      |    ",
    "    |      |  [C]  |      |    ",
    "    |      |_______|      |    ",
    "    |_____________________|    ",
    "    |=====================|    "
  ];

  let brow = "  .___________________.  ";
  let eyesLine = `|    (${eyeL})   (${eyeR})    |`;
  let middle = "|          ^          |";
  
  if (isEarTwitch) {
    // Simulate ear twitch by changing side borders
    eyesLine = `>    (${eyeL})   (${eyeR})    <`;
  }

  let mouth = "|    {===========}    |";
  let chin =  "  '___________________'  ";

  // 5. Advanced Expression & Corruption
  if (emotion_state === 'calm') {
    // Subtle idle movements
    if (isCalmIdle) {
      if (Math.random() > 0.6) brow = "  .^^^^^^^^^^^^^^^^^^^.  "; // Brow lift
      if (Math.random() > 0.8) brow = "  .___________________.  "; // Neutral
      if (Math.random() > 0.6) mouth = "|    {-----------}    |"; // Subtle mouth shift
      if (Math.random() > 0.5) middle = "|         (^)         |"; // Nose twitch
    }
  } else if (emotion_state === 'alert') {
    brow = (animation_phase % 10 < 5) ? "  .^^^^^^^^^^^^^^^^^^^.  " : "  .-------------------.  ";
    mouth = "|    {-----------}    |";
  } else if (emotion_state === 'attack') {
    // Chaotic flickering brows
    const b = animation_phase % 2 === 0 ? "V" : "W";
    brow = `  .${b}${b}${b}${b}${b}${b}${b}${b}${b}${b}${b}${b}${b}${b}${b}${b}${b}${b}${b}.  `;

    // Aggressive grinding teeth/mouth
    const teeth = animation_phase % 3 === 0 ? "WWWWWWWWWWW" : (animation_phase % 3 === 1 ? "MMMMMMMMMMM" : "VVVVVVVVVVV");
    mouth = `|    {${teeth}}    |`;
    
    // Snarling nose/middle
    middle = (animation_phase % 4 < 2) ? "|         /V\\         |" : "|         \\M/         |";
  } else if (emotion_state === 'curious') {
    brow = "  .____/________/_____.  "; 
    mouth = (animation_phase % 20 < 10) ? "|    {    (o)    }    |" : "|    {     *     }    |";
    middle = "|         <?>         |"; // Investigative nose
  } else if (emotion_state === 'surprised') {
    brow = "  .  /           \\  .  "; // Raised brows
    mouth = "|    {    (   )    }    |"; // Wide mouth
    middle = "|          O          |"; // Shocked nose
  } else if (isGlitched) {
    const n = () => ["!", "@", "#", "$", "%", "^", "&", "*", "?", "/", "X", "Z", "7", "0"][Math.floor(Math.random() * 14)];
    brow = ` ._${n()}_${n()}_${n()}_${n()}_${n()}_${n()}_${n()}_. `;
    mouth = `|  {${n()}${n()}${n()}${n()}${n()}${n()}${n()}${n()}${n()}${n()}${n()}}   |`;
    if (Math.random() > 0.5) middle = `|   ${n()}      ${Math.random() > 0.5 ? "ERR" : "?"}      ${n()}   |`;
  }

  // 6. Speech Sync & Interaction Feedback
  const isReceiving = state.last_command_phase >= 0 && (animation_phase - state.last_command_phase < 15);
  
  if (state.last_speech && state.last_speech.length > 0 && !isBlinking) {
    // Rhythmic oscillation for realistic speech cadence
    const syncCycle = 0.75;
    const oscillation = Math.sin(animation_phase * syncCycle) * 0.5 + 0.5;
    
    // Character density check: pretend we are articulating more on certain ticks
    const isBusy = (animation_phase % 5 < 4);
    
    if (isBusy) {
      if (oscillation > 0.8) {
        mouth = "|    {    (---)    }    |";
      } else if (oscillation > 0.5) {
        mouth = "|    {     ---     }    |";
      } else if (oscillation > 0.2) {
        mouth = "|    {      o      }    |";
      } else {
        mouth = "|    {===========}    |"; // Brief closure
      }
    }
  }

  // Interaction Feedback: Subtle brow/middle reaction when input is RECEIVED
  if (isReceiving) {
    const pulse = animation_phase % 2 === 0;
    if (pulse) {
      brow = "  .^^^^^^^^^^^^^^^^^^^.  ";
      middle = "|         (<*>)        |";
    }
  }

  // 7. Final Assembly with Advanced Chaos Engine
  // Each line has a life cycle of 14 * 3 = 42 phases.
  // We use this to calculate a typewriter reveal for the most recent lines.
  const shiftInterval = 14;
  const revealSpeed = 2; // chars per phase
  
  let rawSpeechLines = state.speech_queue.slice(0, 3);
  let speechLines: string[] = [];

  rawSpeechLines.forEach((line, idx) => {
    // [ CONTENT ] is 29 chars total. Content is index 2 to 27.
    const age = (animation_phase % shiftInterval) + (2 - idx) * shiftInterval;
    const revealThreshold = age * revealSpeed;
    
    // Extract content from brackets [ ... ]
    // Line format is "[ CONTENT ]" where CONTENT is maxWidth (25)
    let content = line.substring(2, line.length - 2); 
    const chars = content.split("");
    const noise = ["!", "@", "#", "$", "%", "*", "+", "x", "/"];

    const processedChars = chars.map((char, i) => {
      if (i < revealThreshold - 2) return char; // Fully visible
      if (i < revealThreshold) return noise[Math.floor(Math.random() * noise.length)]; // Noise/Flicker
      return " "; // Hidden
    });

    speechLines.push(`[ ${processedChars.join("")} ]`);
  });
  
  // Padding for consistent 3-row layout if queue is shorter than window
  while (speechLines.length < 3) {
    speechLines.push(`[ ${"".padEnd(25)} ]`);
  }

  const signalLine = isProcessing ? "      [ SIGNAL_RX ]      " : "";
  let rawLines = [...hatLines, brow, eyesLine, middle, mouth, chin, signalLine, ...speechLines, ""];
  
  // Apply Vertical Tearing (Line Level)
  if (isGlitched || iScale > 0.8) {
    if (Math.random() > 0.9) {
      // Swap two random lines
      const idx1 = Math.floor(Math.random() * rawLines.length);
      const idx2 = Math.floor(Math.random() * rawLines.length);
      [rawLines[idx1], rawLines[idx2]] = [rawLines[idx2], rawLines[idx1]];
    }
    if (Math.random() > 0.95) {
      // Duplicate a line (destroys frame height slightly but looks very glitched)
      const target = Math.floor(Math.random() * (rawLines.length - 1));
      rawLines[target] = rawLines[target + 1];
    }
  }

  const frame = rawLines.map((line, idx) => {
    let processed = line;

    // Apply Horizontal Tearing (Advanced)
    if (isGlitched || iScale > 0.6) {
      const tearChance = isGlitched ? 0.4 : 0.15;
      if (Math.random() < tearChance) {
        const offset = Math.floor(Math.random() * (isGlitched ? 12 : 4)) - (isGlitched ? 6 : 2);
        const pad = " ".repeat(Math.abs(offset));
        processed = offset > 0 ? pad + processed : shiftLeft(processed, Math.abs(offset));
      }
    }

    // Apply Deep Character Corruption
    const corruptionChance = isGlitched ? (0.1 + iScale * 0.4) : (iScale > 0.8 ? 0.05 : 0);
    if (corruptionChance > 0 && processed.length > 0) {
      const chars = processed.split("");
      const sets = [
        ["X", "#", "@", "%", "&", "!", "?", "0", "1", "§", "Δ", "Ω"], // Standard Chaos
        ["0", "1"], // Binary Leak
        ["A", "B", "C", "D", "E", "F", "0", "1", "2", "3", "4", "5", "6", "7", "8", "9"], // Hex Dump
        ["█", "▓", "▒", "░", " "], // Block Crush
      ];
      const activeSet = sets[Math.floor(Math.random() * sets.length)];

      for (let i = 0; i < chars.length; i++) {
        if (Math.random() < corruptionChance && chars[i] !== " " && chars[i] !== "|") {
          chars[i] = activeSet[Math.floor(Math.random() * activeSet.length)];
        }
      }
      processed = chars.join("");
    }

    // Apply Face Tilting (for 'curious' state)
    if (emotion_state === 'curious' && idx > 0 && idx < 6) {
      const tiltOffset = Math.floor(idx / 2) - 1;
      const tiltPad = " ".repeat(Math.abs(tiltOffset));
      processed = tiltOffset > 0 ? tiltPad + processed : shiftLeft(processed, Math.abs(tiltOffset));
    }

    return jitter + processed;
  }).join("\n");

  return frame;
}

function shiftLeft(s: string, n: number): string {
  return s.substring(n) + " ".repeat(n);
}

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
  const { emotion_state, animation_phase, intensity, current_morph } = state;
  const iScale = intensity / 100;
  const isGlitched = emotion_state === 'glitch';

  // 1. Procedural Background Layer (Data Stream)
  const bgWidth = 40;
  const generateBGLine = (phase: number, row: number) => {
    const seed = (phase + row * 17) % 100;
    const chars = [" ", " ", " ", " ", ".", "·", "'", "`", " ", " "];
    let line = "";
    for (let i = 0; i < bgWidth; i++) {
       const charIdx = (seed + i * 7) % chars.length;
       line += chars[charIdx];
    }
    return line;
  };

  // 2. High-Fidelity Blinking & Jitter
  const blinkInterval = isGlitched ? 60 : 180;
  const isBlinking = (animation_phase % blinkInterval < 4) || (isGlitched && Math.random() > 0.9);
  
  // Row-specific jitter seed
  const getRowJitter = (rowIdx: number) => {
    if (!isGlitched && iScale < 0.4) return "";
    const rowEntropy = Math.sin(animation_phase * 0.5 + rowIdx * 0.2);
    if (rowEntropy > 0.8 || Math.random() < (iScale * 0.1)) {
        return "  ".repeat(Math.floor(Math.random() * 2) + 1);
    }
    return "";
  };

  // 3. Eye Movement & Noise
  const isProcessing = state.last_command_phase >= 0 && (animation_phase - state.last_command_phase < 5);
  const isCalmIdle = emotion_state === 'calm' && Math.random() > 0.92;
  
  let eyeL = " O ";
  let eyeR = " O ";
  let eyeC = " [O] ";
  
  if (isBlinking) {
    eyeL = " - "; eyeR = " - "; eyeC = " [-] ";
  } else if (isProcessing) {
    eyeL = " * "; eyeR = " * "; eyeC = " [*] ";
  } else if (emotion_state === 'attack') {
    const symbols = [" > ", " # ", " X ", " ! ", " < "];
    eyeL = symbols[animation_phase % symbols.length];
    eyeR = symbols[(animation_phase + 1) % symbols.length];
    eyeC = " [!] ";
  } else if (emotion_state === 'curious') {
    const scan = Math.floor(animation_phase / 10) % 4;
    const eyeFrames = [" o ", " . ", " o ", " O "];
    eyeL = eyeFrames[scan];
    eyeR = eyeFrames[(scan + 2) % 4];
    eyeC = ` [${eyeFrames[scan]}] `;
  } else if (isGlitched) {
    const noise = ["%", "&", "X", "$", "!", "?", "0", "1", "@", "#"];
    const n = () => noise[Math.floor(Math.random() * noise.length)];
    eyeL = ` ${n()} `; eyeR = ` ${n()} `; eyeC = ` [${n()}] `;
  }

  // 4. Morph Logic
  let spriteLines: string[] = [];
  const isSpeaking = state.last_command_phase >= 0 && (animation_phase - state.last_command_phase < 45);

  if (current_morph === 'eye') {
    const iris = isBlinking ? "---" : (isProcessing ? "***" : (isSpeaking && animation_phase % 2 === 0 ? " O " : " o "));
    spriteLines = [
      "          ,---.          ",
      "     _..-'     '-.._     ",
      "   .'   .-------.   '.   ",
      "  /    /         \\    \\  ",
      ` |    |     ${iris}     |    | `,
      "  \\    \\         /    /  ",
      "   '.   '-------'   .'   ",
      "     '-.._     _..-'     ",
      "          '---'          "
    ];
  } else if (current_morph === 'hardware') {
    const p = (animation_phase % 4 < 2) ? "::" : "..";
    const load = isProcessing ? "||||||||||||||||" : (isSpeaking ? ">>> DATA TX >>>>" : ":: IDLE STATE ::");
    const pins = (animation_phase % 2 === 0) ? "|| || || || || || ||" : " |  |  |  |  |  |  |";
    spriteLines = [
      "   ______________________   ",
      "  |                      |  ",
      `  | ${p}  GLITCH.CORE  ${p} |  `,
      `  |  [${load}]  |  `,
      `  |   (${eyeL})  (${eyeR})   |  `,
      "  |  [________________]  |  ",
      "  |      ::::::::::      |  ",
      "  |__==__==__==__==__==__|  ",
      `    ${pins}    `
    ];
  } else if (current_morph === 'ditto') {
    const w = Math.sin(animation_phase * 0.3) * 3;
    const pad = (n: number) => " ".repeat(Math.max(0, Math.floor(n)));
    const m = isBlinking ? "-" : (isSpeaking ? (animation_phase % 2 === 0 ? "o" : "O") : "_");
    spriteLines = [
      `${pad(4+w)}  .----------.  `,
      `${pad(2+w*0.8)} /            \\ `,
      `${pad(w)}|   ${eyeL}   ${eyeR}   |`,
      `${pad(1-w*0.5)} \\    _${m}__    / `,
      `${pad(2-w)}  '--'    '--'  `,
      `${pad(4-w*1.1)}   /      \\    `,
      `${pad(3-w*1.5)}  /________\\   `
    ];
  } else if (current_morph === 'spiky') {
    const s1 = animation_phase % 4 === 0 ? " +" : " x";
    const s2 = animation_phase % 4 === 2 ? " +" : " x";
    spriteLines = [
      `     ${s1}     |     ${s2}     `,
      "  \\  |  /      \\  |  /  ",
      "   \\ | /        \\ | /   ",
      ` -- (${eyeL}) ---- (${eyeR}) -- `,
      "   / | \\        / | \\   ",
      "  /  |  \\      /  |  \\  ",
      `     ${s1}     |     ${s2}     `
    ];
  } else if (current_morph === 'custom' && state.custom_sprite) {
    spriteLines = state.custom_sprite.split('\n');
  } else {
    // Default Blob (The Boy with Cap [C])
    let brow = "  .___________________.  ";
    if (emotion_state === 'alert' || emotion_state === 'attack') brow = "  .^^^^^^^^^^^^^^^^^^^.  ";
    if (emotion_state === 'curious') brow = "  .____/________/_____.  ";
    if (isCalmIdle && Math.random() > 0.6) brow = "  .^^^^^^^^^^^^^^^^^^^.  ";

    let mouth = "|    {===========}    |";
    if (isSpeaking) {
      const frames = [
        "|    {    ---    }    |",
        "|    {   (---)   }    |",
        "|    {    -o-    }    |",
        "|    {     o     }    |",
        "|    {    ( )    }    |",
        "|    {    ---    }    |"
      ];
      mouth = frames[animation_phase % frames.length];
    } else if (emotion_state === 'attack') {
      mouth = animation_phase % 2 === 0 ? "|    {VVVVVVVVVVV}    |" : "|    {^^^^^^^^^^^}    |";
    } else if (emotion_state === 'surprised') {
      mouth = "|    {    (   )    }    |";
    } else if (emotion_state === 'curious') {
      mouth = animation_phase % 4 < 2 ? "|    {  _______  }    |" : "|    {  -------  }    |";
    }

    let nose = "|          ^          |";
    if (isProcessing && animation_phase % 2 === 0) nose = "|         (<*>)        |";
    else if (emotion_state === 'attack') nose = "|         /V\\         |";

    spriteLines = [
      "      .-----------------.      ",
      "     /      _______      \\     ",
      "    |      |       |      |    ",
      "    |      |  [C]  |      |    ",
      "    |      |_______|      |    ",
      "    |_____________________|    ",
      "    |=====================|    ",
      brow,
      `    |    (${eyeL})   (${eyeR})    |`,
      `    ${nose}`,
      `    ${mouth}`,
      "    '___________________'  "
    ];
  }

  // --- ENTROPY & GLITCH OVERLAY ---
  const entropy = state.intensity / 100;
  const isCurrentlyGlitching = emotion_state === 'glitch' || Math.random() < (entropy * 0.15);

  if (isCurrentlyGlitching) {
    spriteLines = spriteLines.map(line => {
      if (Math.random() < (0.1 + entropy * 0.2)) {
        return line.split('').map(char => {
          if (char === ' ') return Math.random() < 0.05 ? "." : " ";
          return Math.random() < (0.2 + entropy * 0.3) ? ["@", "#", "$", "%", "&", "!", "?", "0", "1", "X"][Math.floor(Math.random() * 10)] : char;
        }).join('');
      }
      return line;
    });
  }

  // 5. Speech Rendering
  let rawSpeechLines = state.speech_queue.slice(0, 3);
  let speechLines: string[] = [];
  const revealSpeed = 2;
  const shiftInterval = 14;

  rawSpeechLines.forEach((line, idx) => {
    const age = (animation_phase % shiftInterval) + (2 - idx) * shiftInterval;
    const revealThreshold = age * revealSpeed;
    let content = line.substring(2, line.length - 2); 
    const charList = content.split("");
    const noise = ["!", "@", "#", "$", "%", "*"];

    const processedChars = charList.map((char, i) => {
      if (i < revealThreshold - 2) return char;
      if (i < revealThreshold) return noise[Math.floor(Math.random() * noise.length)];
      return " ";
    });

    speechLines.push(`[ ${processedChars.join("")} ]`);
  });
  
  while (speechLines.length < 3) {
    speechLines.push(`[ ${"".padEnd(25)} ]`);
  }

  const signalLine = isProcessing ? "      [ SIGNAL_RX ]      " : "";
  let rawLines = [...spriteLines, signalLine, ...speechLines];
  
  // Apply Distortion
  if (isGlitched || iScale > 0.8) {
    if (Math.random() > 0.9) {
      const idx1 = Math.floor(Math.random() * rawLines.length);
      const idx2 = Math.floor(Math.random() * rawLines.length);
      [rawLines[idx1], rawLines[idx2]] = [rawLines[idx2], rawLines[idx1]];
    }
  }

  // 4. Composite: Foreground over Background
  const bgLines = rawLines.map((_, idx) => generateBGLine(animation_phase, idx));
  
  // Calculate character bounding box for uniform centering
  const maxLineLength = Math.max(...rawLines.map(l => l.length));
  const globalPadding = Math.max(0, Math.floor((bgWidth - maxLineLength) / 2));

  const frame = rawLines.map((line, idx) => {
    // Preserve relative internal spacing by using one global offset
    const centeredFG = " ".repeat(globalPadding) + line;

    const bg = bgLines[idx] || "";
    
    // Merge foreground over background
    const merged = bg.split('').map((char, charIdx) => {
        const fgChar = centeredFG[charIdx];
        // Only prioritize FG if it's not a space
        if (fgChar && fgChar !== " ") return fgChar;
        return char;
    }).join('');

    let finalLine = merged;
    
    // Add horizontal scanline effect
    const scanlinePos = (animation_phase % 40);
    if (idx === scanlinePos || idx === scanlinePos - 1) {
        finalLine = finalLine.replace(/[^\s]/g, (c) => Math.random() > 0.5 ? "=" : "-");
    }

    if (isGlitched || iScale > 0.6) {
      if (Math.random() < (isGlitched ? 0.3 : 0.1)) {
        const offset = Math.floor(Math.random() * 4) - 2;
        finalLine = offset > 0 ? " ".repeat(offset) + finalLine : finalLine.substring(Math.abs(offset));
      }
    }
    return finalLine;
  }).join("\n");

  return frame;
}

function shiftLeft(s: string, n: number): string {
  return s.substring(n) + " ".repeat(n);
}

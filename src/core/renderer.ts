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

  // 1. Procedural Background Layer (Data Stream)
  const bgWidth = 72;
  const bgHeight = 22;
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
  } else if (emotion_state === 'attack' || emotion_state === 'angry') {
    const symbols = emotion_state === 'angry' ? [" > ", " < ", " ! "] : [" > ", " # ", " X ", " ! ", " < "];
    eyeL = symbols[animation_phase % symbols.length];
    eyeR = symbols[(animation_phase + 1) % symbols.length];
    eyeC = " [!] ";
  } else if (emotion_state === 'happy') {
    eyeL = " ^ "; eyeR = " ^ "; eyeC = " [^] ";
  } else if (emotion_state === 'sad') {
    eyeL = " . "; eyeR = " . "; eyeC = " [.] ";
  } else if (emotion_state === 'bored') {
    eyeL = " - "; eyeR = " - "; eyeC = " [-] ";
  } else if (emotion_state === 'surprised') {
    eyeL = " o "; eyeR = " o "; eyeC = " [o] ";
  } else if (emotion_state === 'curious') {
    // Advanced Curious Eye: Scanning and focal points
    const scanTime = Math.floor(animation_phase / 6);
    const focalPoint = scanTime % 8;
    const eyeFrames = [" o ", " . ", " O ", " o ", " 0 ", " . ", " o ", " @ "];
    eyeL = eyeFrames[focalPoint];
    eyeR = eyeFrames[(focalPoint + 3) % 8];
    eyeC = ` [${eyeFrames[focalPoint]}] `;
  } else if (isGlitched) {
    const noise = ["%", "&", "X", "$", "!", "?", "0", "1", "@", "#"];
    const n = () => noise[Math.floor(Math.random() * noise.length)];
    eyeL = ` ${n()} `; eyeR = ` ${n()} `; eyeC = ` [${n()}] `;
  }

  // 4. Sprite Rendering (Fixed to Carhartt Boy)
  let spriteLines: string[] = [];
  const isSpeaking = state.last_command_phase >= 0 && (animation_phase - state.last_command_phase < 45);

  // Breathing effect: slight vertical offset based on phase
  const breathOffset = Math.floor(Math.sin(animation_phase * 0.15) * 1.2);
  const floatOffset = Math.floor(Math.cos(animation_phase * 0.05) * 0.8);
  const totalYShift = breathOffset + floatOffset;

  let brow = "  .___________________.  ";
  if (emotion_state === 'alert' || emotion_state === 'attack' || emotion_state === 'angry') brow = "  .^^^^^^^^^^^^^^^^^^^.  ";
  if (emotion_state === 'curious') brow = "  .____/________/_____.  ";
  if (emotion_state === 'surprised') brow = "  .  /             \\  .  ";
  if (emotion_state === 'happy') brow = "  .   \\           /   .  ";
  if (emotion_state === 'sad') brow = "  .   /           \\   .  ";
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
  } else if (emotion_state === 'attack' || emotion_state === 'angry') {
    mouth = (animation_phase % 2 === 0) ? "|    {VVVVVVVVVVV}    |" : "|    {^^^^^^^^^^^}    |";
  } else if (emotion_state === 'happy') {
    mouth = "|    {  \\_______/  }    |";
  } else if (emotion_state === 'sad') {
    mouth = "|    {  /-------\\  }    |";
  } else if (emotion_state === 'surprised') {
    mouth = "|    {    (   )    }    |";
  } else if (emotion_state === 'curious') {
    mouth = animation_phase % 4 < 2 ? "|    {  _______  }    |" : "|    {  -------  }    |";
  } else if (emotion_state === 'bored') {
    mouth = "|    {  ---------  }    |";
  }

  let nose = "|          ^          |";
  if (isProcessing && animation_phase % 2 === 0) nose = "|         (<*>)        |";
  else if (emotion_state === 'attack' || emotion_state === 'angry') nose = "|         /V\\         |";
  else if (emotion_state === 'happy') nose = "|          v          |";
  else if (emotion_state === 'sad') nose = "|          .          |";

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

  // --- SPRITE SCALING (Horizontal ~2.2x, Vertical ~1.3x) ---
  // Horizontal scaling
  spriteLines = spriteLines.map(line => {
    let scaled = "";
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      scaled += char;
      // 2.2x factor: double every character, and triple every 5th character
      if (char !== 'C') {
        scaled += char;
        if (i % 5 === 0) scaled += char;
      }
    }
    return scaled;
  });

  // Apply a slight horizontal sway
  const horizontalSway = Math.floor(Math.sin(animation_phase * 0.08) * 2);
  if (horizontalSway !== 0) {
    spriteLines = spriteLines.map(line => {
      const pad = " ".repeat(Math.abs(horizontalSway));
      return horizontalSway > 0 ? pad + line : line + pad;
    });
  }

  // Vertical scaling (approx 1.3x)
  const verticallyScaled: string[] = [];
  for (let i = 0; i < spriteLines.length; i++) {
    verticallyScaled.push(spriteLines[i]);
    // Duplicate every 3rd line to get ~1.3x height
    if (i % 3 === 2) {
      verticallyScaled.push(spriteLines[i]);
    }
  }
  spriteLines = verticallyScaled;

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

  // Calculate max sprite width for speech alignment
  const maxSpriteWidth = Math.max(...spriteLines.map(l => l.length));
  const speechBoxWidth = 29; // "[ " + 25 + " ]"
  const speechAlignOffset = Math.max(0, Math.floor((maxSpriteWidth - speechBoxWidth) / 2));
  const speechPadding = " ".repeat(speechAlignOffset);

  // 5. HUD Dynamic Text Rendering: Typewriter & Buffer Distortion
  const displayedSpeech = state.full_speech || "";
  const speechLength = displayedSpeech.length;
  
  // Calculate visibility based on phase since last command
  const charSpeed = 1.5 + (state.intensity / 50);
  const visibleCharsThreshold = Math.floor((animation_phase - state.last_command_phase) * charSpeed);
  
  let processedSpeech = displayedSpeech.substring(0, Math.max(0, visibleCharsThreshold));
  
  // Add a glitch character at the end of the reveal
  if (visibleCharsThreshold > 0 && visibleCharsThreshold < speechLength) {
    const glitches = ["_", "█", "▒", "░", "/", "\\", "¶", "§", "∆", "√"];
    processedSpeech += glitches[Math.floor(Math.random() * glitches.length)];
  }

  // Wrap speech into multiple lines for the HUD (max 3 lines)
  const wrapWidth = 50;
  const rawSpeechLines_HUD: string[] = [];
  for (let i = 0; i < processedSpeech.length && rawSpeechLines_HUD.length < 3; i += wrapWidth) {
    rawSpeechLines_HUD.push(processedSpeech.substring(i, i + wrapWidth));
  }
  
  const hudLines = rawSpeechLines_HUD.map((line, i) => {
    // Slight jitter to the line position if intensity is high
    const jitter = (intensity > 50 && Math.random() > 0.95) ? " " : "";
    return `> ${jitter}${line}`.padEnd(wrapWidth + 3);
  });

  while (hudLines.length < 3) hudLines.push(" ".repeat(wrapWidth + 3));

  // Current sliding queue (smaller, to the side or above)
  const miniQueue = state.speech_queue.slice(0, 3).map(l => l.substring(0, 29));
  
  // 4. Composite: Foreground over Background
  const bgLines = new Array(bgHeight).fill("").map((_, idx) => generateBGLine(animation_phase, idx));
  
  // Character sprite layout
  const maxLineLength = Math.max(...spriteLines.map(l => l.length));
  const charHOffset = Math.max(0, Math.floor((bgWidth - maxLineLength) / 2));
  const charVOffset = Math.max(0, Math.floor((bgHeight - spriteLines.length) / 2) + totalYShift - 2);

  const frame = bgLines.map((bg, idx) => {
    // 1. Overlay Character Sprite
    const spriteIdx = idx - charVOffset;
    let currentLine = bg;

    if (spriteIdx >= 0 && spriteIdx < spriteLines.length) {
        const spriteLine = spriteLines[spriteIdx];
        const spriteChars = spriteLine.split('');
        const lineChars = currentLine.split('');
        
        for (let i = 0; i < spriteChars.length; i++) {
            const hPos = charHOffset + i;
            if (hPos >= 0 && hPos < bgWidth && spriteChars[i] !== ' ') {
                lineChars[hPos] = spriteChars[i];
            }
        }
        currentLine = lineChars.join('');
    }

    // 2. Overlay HUD (Bottom)
    const hudRowStart = bgHeight - 4;
    const hudIdx = idx - hudRowStart;
    if (hudIdx >= 0 && hudIdx < hudLines.length) {
        const hudLine = hudLines[hudIdx];
        const hudHOffset = Math.floor((bgWidth - hudLine.length) / 2);
        const hudChars = hudLine.split('');
        const lineChars = currentLine.split('');

        for (let i = 0; i < hudChars.length; i++) {
            const hPos = hudHOffset + i;
            if (hPos >= 0 && hPos < bgWidth) {
                lineChars[hPos] = hudChars[i];
            }
        }
        currentLine = lineChars.join('');
    }

    // Add horizontal scanline effect
    const scanlinePos = (animation_phase % 40);
    if (idx === scanlinePos || idx === scanlinePos - 1) {
        currentLine = currentLine.replace(/[^\s]/g, (c) => Math.random() > 0.5 ? "=" : "-");
    }

    // Global glitching
    if (isGlitched || iScale > 0.6) {
      if (Math.random() < (isGlitched ? 0.3 : 0.1)) {
        const offset = Math.floor(Math.random() * 4) - 2;
        currentLine = offset > 0 ? " ".repeat(offset) + currentLine : currentLine.substring(Math.abs(offset));
      }
    }

    return currentLine;
  }).join("\n");

  return frame;
}

function shiftLeft(s: string, n: number): string {
  return s.substring(n) + " ".repeat(n);
}

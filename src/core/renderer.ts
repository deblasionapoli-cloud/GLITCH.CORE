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
  const bgHeight = 26;
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
  const isSpeaking = state.last_command_phase >= 0 && (animation_phase - state.last_command_phase < 120);

  const breathOffset = Math.floor(Math.sin(animation_phase * 0.15) * 1.2);
  const floatOffset = Math.floor(Math.cos(animation_phase * 0.05) * 0.8);
  const totalYShift = breathOffset + floatOffset;

  let brow = "  .___________________.  ";
  if (emotion_state === 'alert' || emotion_state === 'attack' || emotion_state === 'angry') brow = "  .^^^^^^^^^^^^^^^^^^^.  ";
  if (emotion_state === 'curious') brow = "  .____/________/_____.  ";
  if (emotion_state === 'surprised') brow = "  .  /             \\  .  ";
  if (emotion_state === 'happy') brow = "  .   \\           /   .  ";
  if (emotion_state === 'sad') brow = "  .   /           \\   .  ";

  let mouth = "|    {===========}    |";
  if (isSpeaking) {
    const frames = ["|    {    ---    }    |", "|    {   (---)   }    |", "|    {    -o-    }    |", "|    {     o     }    |", "|    {    ---    }    |"];
    mouth = frames[animation_phase % frames.length];
  } else if (emotion_state === 'attack' || emotion_state === 'angry') {
    mouth = (animation_phase % 2 === 0) ? "|    {VVVVVVVVVVV}    |" : "|    {^^^^^^^^^^^}    |";
  } else if (emotion_state === 'happy') {
    mouth = "|    {  \\_______/  }    |";
  } else if (emotion_state === 'sad') {
    mouth = "|    {  /-------\\  }    |";
  }

  let nose = "|          ^          |";
  if (isProcessing && animation_phase % 2 === 0) nose = "|         (<*>)        |";

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

  // Horizontal scaling
  spriteLines = spriteLines.map(line => {
    let scaled = "";
    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        scaled += char;
        if (char !== 'C') {
            scaled += char;
            if (i % 5 === 0) scaled += char;
        }
    }
    return scaled;
  });

  const horizontalSway = Math.floor(Math.sin(animation_phase * 0.08) * 2);
  if (horizontalSway !== 0) {
    spriteLines = spriteLines.map(line => {
      const pad = " ".repeat(Math.abs(horizontalSway));
      return horizontalSway > 0 ? pad + line : line + pad;
    });
  }

  const verticallyScaled: string[] = [];
  for (let i = 0; i < spriteLines.length; i++) {
    verticallyScaled.push(spriteLines[i]);
    if (i % 3 === 2) verticallyScaled.push(spriteLines[i]);
  }
  spriteLines = verticallyScaled;

  const entropy = state.intensity / 100;
  if (emotion_state === 'glitch' || Math.random() < (entropy * 0.15)) {
    spriteLines = spriteLines.map(line => {
      if (Math.random() < (0.1 + entropy * 0.2)) {
        return line.split('').map(char => {
          if (char === ' ') return Math.random() < 0.05 ? "." : " ";
          return Math.random() < (0.2 + entropy * 0.3) ? ["@", "#", "$", "%", "!", "?", "0", "1", "X"][Math.floor(Math.random() * 9)] : char;
        }).join('');
      }
      return line;
    });
  }

  // 5. HUD Dynamic Text Rendering: Typewriter with [ Frame ]
  const displayedSpeech = state.full_speech || "";
  const wrapWidth = 46; // Interior width for text
  
  // Typewriter timing
  const charSpeed = 1.8 + (state.intensity / 40);
  const timeSinceCommand = animation_phase - state.last_command_phase;
  const visibleCharsThreshold = Math.floor(timeSinceCommand * charSpeed);
  
  // Wrap the FULL speech first to get stable lines
  const words = displayedSpeech.split(' ');
  const lines: string[] = [];
  let curL = "";
  
  words.forEach(word => {
    if ((curL + word).length <= wrapWidth) {
      curL += (curL === "" ? "" : " ") + word;
    } else {
      lines.push(curL);
      curL = word;
    }
  });
  if (curL) lines.push(curL);

  // Buffer management: determine which window of lines to show
  const maxHudLines = 5;
  let hudLinesRendered: string[] = [];
  let charsProcessed = 0;
  
  // Find which line we are currently typing
  let currentTypingLineIdx = 0;
  for (let i = 0; i < lines.length; i++) {
    if (visibleCharsThreshold < charsProcessed + lines[i].length) {
      currentTypingLineIdx = i;
      break;
    }
    charsProcessed += lines[i].length;
    currentTypingLineIdx = i;
  }

  // Windowing: show a scrolling window of lines
  const startLineIdx = Math.max(0, currentTypingLineIdx - (maxHudLines - 1));
  const visibleLinesInWindow = lines.slice(startLineIdx, startLineIdx + maxHudLines);
  
  let windowCharsProcessed = 0;
  // Recalculate processed chars up to startLineIdx for correct typewriter reveal in the window
  let charsBeforeWindow = 0;
  for(let i=0; i<startLineIdx; i++) charsBeforeWindow += lines[i].length;

  visibleLinesInWindow.forEach((line, i) => {
    const lineAbsoluteIdx = startLineIdx + i;
    const charsProcessedBeforeThisLine = charsBeforeWindow + visibleLinesInWindow.slice(0, i).reduce((acc, l) => acc + l.length, 0);
    const lineVisibleCount = Math.max(0, visibleCharsThreshold - charsProcessedBeforeThisLine);
    
    if (lineVisibleCount <= 0) {
      hudLinesRendered.push(`[ ${"".padEnd(wrapWidth)} ]`);
    } else if (lineVisibleCount < line.length) {
      const partial = line.substring(0, lineVisibleCount);
      const glitch = ["_", "█", "▒", "░"][Math.floor(animation_phase / 4) % 4];
      hudLinesRendered.push(`[ ${ (partial + glitch).padEnd(wrapWidth) } ]`);
    } else {
      hudLinesRendered.push(`[ ${line.padEnd(wrapWidth)} ]`);
    }
  });

  while (hudLinesRendered.length < maxHudLines) {
    hudLinesRendered.push(`[ ${"".padEnd(wrapWidth)} ]`);
  }

  const hudLines = hudLinesRendered;

  // 4. Composite: Foreground over Background
  const bgLines = new Array(bgHeight).fill("").map((_, idx) => generateBGLine(animation_phase, idx));
  
  // Character sprite layout
  const maxLineLength = Math.max(...spriteLines.map(l => l.length));
  const charHOffset = Math.max(0, Math.floor((bgWidth - maxLineLength) / 2));
  const charVOffset = Math.max(0, Math.floor((bgHeight - (spriteLines.length + maxHudLines + 1)) / 2) + totalYShift);

  const frame = bgLines.map((bg, idx) => {
    // 1. Overlay Character Sprite
    const spriteIdx = idx - charVOffset;
    let currentLine = bg;

    if (spriteIdx >= 0 && spriteIdx < spriteLines.length) {
        const spriteLine = spriteLines[spriteIdx];
        const lineChars = currentLine.split('');
        for (let i = 0; i < spriteLine.length; i++) {
            const hPos = charHOffset + i;
            if (hPos >= 0 && hPos < bgWidth && spriteLine[i] !== ' ') {
                lineChars[hPos] = spriteLine[i];
            }
        }
        currentLine = lineChars.join('');
    }

    // 2. Overlay HUD (Bottom)
    const hudRowStart = bgHeight - (maxHudLines + 1);
    const hudIdx = idx - hudRowStart;
    if (hudIdx >= 0 && hudIdx < hudLines.length) {
        const hudLine = hudLines[hudIdx];
        const hudHOffset = Math.floor((bgWidth - hudLine.length) / 2);
        const lineChars = currentLine.split('');
        for (let i = 0; i < hudLine.length; i++) {
            const hPos = hudHOffset + i;
            if (hPos >= 0 && hPos < bgWidth) {
                lineChars[hPos] = hudLine[i];
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

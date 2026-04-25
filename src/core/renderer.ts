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
  const { emotion_state, animation_phase, intensity, form } = state;
  const iScale = intensity / 100;
  const isGlitched = emotion_state === 'glitch';

  // 1. Procedural Background Layer (Data Stream)
  // Increased buffer width to ensure full frame and consistent 2x scaling
  const bgWidth = 110;
  const bgHeight = 32; // Increased to fill vertical space better
  const generateBGLine = (phase: number, row: number) => {
    let line = "";
    // Horizontal scale 2x by doubling characters: iterate half width and append twice
    const halfWidth = Math.floor(bgWidth / 2);
    for (let i = 0; i < halfWidth; i++) {
       // Deterministic noise based on phase, row and col
       const noise = Math.sin(row * 0.5 + i * 0.8 + phase * 0.05) * Math.cos(row * 0.8 - i * 0.4 + phase * 0.02);
       const val = Math.abs(noise);
       
       const chars = [" ", " ", " ", " ", ".", "·", " ", " "];
       const charIdx = Math.floor(val * chars.length) % chars.length;
       const c = chars[charIdx];
       line += c + c; 
    }
    return line.padEnd(bgWidth, " ");
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
  const totalYShift = breathOffset + floatOffset - 2;

  // Hat personalization based on 'form'
  let hatLogo = "[C]";
  let hatTop = "      .-----------------.      ";
  let hatMid = "     /      _______      \\     ";
  
  if (form === 'blob') {
    hatLogo = "(B)";
    hatTop = "      ._________________.      ";
    hatMid = "     (      _______      )     ";
  } else if (form === 'eye') {
    hatLogo = "(E)";
    hatTop = "      .________O________.      ";
  } else if (form === 'ditto') {
    hatLogo = " . ";
    hatTop = "      .                 .      ";
  } else if (form === 'spiky') {
    hatLogo = "[W]";
    hatTop = "      .vvvvvvvvvvvvvvvvv.      ";
  }

  // Face Internal Width = 21 chars. Face total width (with pipes) = 23 chars. Total Line Width = 31 chars.
  let brow = "  ._________________.  ";
  if (emotion_state === 'alert' || emotion_state === 'attack' || emotion_state === 'angry') brow = "  .^^^^^^^^^^^^^^^^^.  ";
  if (emotion_state === 'curious') brow = "  .____/_______/____.  ";
  if (emotion_state === 'surprised') brow = "  .  /           \\  .  ";
  if (emotion_state === 'happy') brow = "  .   \\         /   .  ";
  if (emotion_state === 'sad') brow = "  .   /         \\   .  ";

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
  if (isProcessing && animation_phase % 2 === 0) nose = "|         (<*>)       |";

  spriteLines = [
    hatTop,
    hatMid,
    "    |      |       |      |    ",
    `    |      |  ${hatLogo}  |      |    `,
    "    |      |_______|      |    ",
    "    |_____________________|    ",
    "    |=====================|    ",
    `    |${brow}|    `,
    `    |    (${eyeL})   (${eyeR})    |    `,
    `    ${nose}    `,
    `    ${mouth}    `,
    "    '_____________________'    "
  ];

  // Normalize all sprite lines to exactly 33 characters for consistent scaling
  spriteLines = spriteLines.map(line => {
    const targetWidth = 33;
    const currentLen = line.length;
    if (currentLen < targetWidth) {
      const diff = targetWidth - currentLen;
      const leftPad = Math.floor(diff / 2);
      const rightPad = diff - leftPad;
      return " ".repeat(leftPad) + line + " ".repeat(rightPad);
    } else if (currentLen > targetWidth) {
      return line.substring(0, targetWidth);
    }
    return line;
  });

  // Simple 2x horizontal scaling by doubling characters
  spriteLines = spriteLines.map(line => {
    let scaled = "";
    for (let i = 0; i < line.length; i++) {
        scaled += line[i] + line[i];
    }
    return scaled;
  });

  // 2x Vertical scaling
  const verticallyScaled: string[] = [];
  for (const line of spriteLines) {
    verticallyScaled.push(line);
    verticallyScaled.push(line);
  }
  spriteLines = verticallyScaled;

  const horizontalSway = Math.floor(Math.sin(animation_phase * 0.08) * 2);
  if (horizontalSway !== 0) {
    spriteLines = spriteLines.map(line => {
      const p = " ".repeat(Math.abs(horizontalSway));
      return horizontalSway > 0 ? p + line : line + p;
    });
  }

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
  const wrapWidth = 52; // Interior width for text with brackets
  
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
  const maxHudLines = 4; // Reduced to 4 lines as requested
  let hudLinesRendered: string[] = [];
  
  // Create cumulative character count per line to find cursor position
  const lineEndIndices = lines.map((_, i) => 
    lines.slice(0, i + 1).reduce((acc, l) => acc + (l.length + 1), 0)
  );

  // Find where the typewriter is currently working
  let typingLineIdx = 0;
  for (let i = 0; i < lineEndIndices.length; i++) {
    if (visibleCharsThreshold < lineEndIndices[i]) {
      typingLineIdx = i;
      break;
    }
    typingLineIdx = i;
  }

  // Windowing: follow the typingLineIdx, keeping it towards the bottom
  const startIdx = Math.max(0, typingLineIdx - (maxHudLines - 1));
  const windowLines = lines.slice(startIdx, startIdx + maxHudLines);
  
  windowLines.forEach((line, i) => {
    const absIdx = startIdx + i;
    const prevChars = absIdx === 0 ? 0 : lineEndIndices[absIdx - 1];
    const visibleInLine = Math.max(0, visibleCharsThreshold - prevChars);
    
    if (visibleInLine <= 0) {
      hudLinesRendered.push(`[ ${"".padEnd(wrapWidth)} ]`);
    } else if (visibleInLine < line.length) {
      const p = line.substring(0, visibleInLine);
      const gl = ["_", "█", "▒", "░"][Math.floor(animation_phase / 4) % 4];
      hudLinesRendered.push(`[ ${(p + gl).padEnd(wrapWidth)} ]`);
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
  const charVOffset = Math.max(0, Math.floor((bgHeight - (spriteLines.length + hudLines.length + 1)) / 2) + totalYShift);

  const frameLines = bgLines.map((bg, idx) => {
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

    // 2. Overlay HUD (Bottom Interaction)
    const hudRowStart = bgHeight - (hudLines.length + 1) - 1;
    const hudIdx = idx - hudRowStart;
    if (hudIdx >= 0 && hudIdx < hudLines.length) {
        const hudLine = hudLines[hudIdx];
        const hudHOffset = Math.floor((bgWidth - hudLine.length) / 2);
        const lineChars = currentLine.split('');
        for (let i = 0; i < hudLine.length; i++) {
            const hPos = hudHOffset + i;
            if (hPos >= 0 && hPos < bgWidth) {
                // Transparency: only overwrite if HUD character is not a space
                if (hudLine[i] !== ' ') {
                    lineChars[hPos] = hudLine[i];
                }
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
        const offset = (Math.floor(Math.random() * 4) - 2);
        if (offset > 0) {
          currentLine = " ".repeat(offset) + currentLine.substring(0, bgWidth - offset);
        } else if (offset < 0) {
          currentLine = currentLine.substring(Math.abs(offset)).padEnd(bgWidth, " ");
        }
      }
    }

    return currentLine;
  });

  // 5. Overlay Debug Logs (Floating Top Right)
  if (state.debug_mode && state.debug_logs && state.debug_logs.length > 0) {
    const logs = state.debug_logs.slice(-10);
    logs.forEach((log, i) => {
      const row = 1 + i;
      if (row < frameLines.length) {
        const logStr = ` > ${log} `;
        const startX = Math.max(0, bgWidth - logStr.length - 2);
        const lineChars = frameLines[row].split('');
        for (let j = 0; j < logStr.length; j++) {
          if (startX + j < bgWidth) {
            // Transparency: only overwrite if log character is not a space
            if (logStr[j] !== ' ') {
              lineChars[startX + j] = logStr[j];
            }
          }
        }
        frameLines[row] = lineChars.join('');
      }
    });
  }

  return frameLines.join("\n");
}

function shiftLeft(s: string, n: number): string {
  return s.substring(n) + " ".repeat(n);
}

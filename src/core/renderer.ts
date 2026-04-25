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
  const isGlitched = emotion_state === 'glitch';

  // 1. Procedural Background Layer (Data Stream)
  const bgWidth = 110;
  const bgHeight = 32;
  
  // OPTIMIZATION: Use a simpler, faster noise generator instead of trig per pixel
  // This reduces trig calls from ~1760 down to 0 per frame for noise
  const generateBGLine = (phase: number, row: number) => {
    let line = "";
    const halfWidth = bgWidth >> 1;
    const rowOffset = row * 37 + phase;
    const chars = [" ", "·", " ", ".", " ", "'", "·", " ", " ", "·", ".", "`"];
    
    for (let i = 0; i < halfWidth; i++) {
       // Fast pseudo-random hash
       const hash = (rowOffset + (i * 13)) % 1024;
       const val = (hash ^ (hash >> 3)) & 15;
       const c = chars[val % chars.length];
       line += c + c; 
    }
    return line.length < bgWidth ? line.padEnd(bgWidth, " ") : line;
  };

  // 2. State & Timing (Pre-calculate shared values)
  const isSpeaking = state.last_command_phase >= 0 && (animation_phase - state.last_command_phase < 120);
  const isProcessing = state.last_command_phase >= 0 && (animation_phase - state.last_command_phase < 5);
  const blinkInterval = isGlitched ? 60 : 180;
  const isBlinking = (animation_phase % blinkInterval < 4) || (isGlitched && Math.random() > 0.9);
  const entropy = state.intensity / 100;

  // 3. Eye/Face Primitives
  let eyeL = " O "; let eyeR = " O "; let eyeC = " [O] ";
  if (isBlinking) { eyeL = " - "; eyeR = " - "; eyeC = " [-] "; }
  else if (isProcessing) { eyeL = " * "; eyeR = " * "; eyeC = " [*] "; }
  else if (emotion_state === 'attack' || emotion_state === 'angry') {
    const symbols = emotion_state === 'angry' ? [" > ", " < ", " ! "] : [" > ", " # ", " X ", " ! ", " < "];
    eyeL = symbols[animation_phase % symbols.length];
    eyeR = symbols[(animation_phase + 1) % symbols.length];
    eyeC = " [!] ";
  } else if (emotion_state === 'happy') { eyeL = " ^ "; eyeR = " ^ "; eyeC = " [^] "; }
  else if (emotion_state === 'sad') { eyeL = " . "; eyeR = " . "; eyeC = " [.] "; }
  else if (emotion_state === 'bored') { eyeL = " - "; eyeR = " - "; eyeC = " [-] "; }
  else if (emotion_state === 'surprised') { eyeL = " o "; eyeR = " o "; eyeC = " [o] "; }
  else if (emotion_state === 'curious') {
    const focalPoint = Math.floor(animation_phase / 6) % 8;
    const eyeFrames = [" o ", " . ", " O ", " o ", " @ ", " . ", " o ", " * "];
    eyeL = eyeFrames[focalPoint]; eyeR = eyeFrames[(focalPoint + 3) % 8]; eyeC = ` [${eyeFrames[focalPoint]}] `;
  } else if (isGlitched) {
    const noise = ["%", "&", "X", "$", "!", "?", "*", "+", "@", "#", "░", "▒"];
    const n = () => noise[Math.floor(Math.random() * noise.length)];
    eyeL = ` ${n()} `; eyeR = ` ${n()} `; eyeC = ` [${n()}] `;
  }

  // 4. Sprite Components
  let hatLogo = "[C]";
  let hatTop = "      .-----------------.      ";
  let hatMid = "     /      _______      \\     ";
  if (form === 'blob') { hatLogo = "(B)"; hatTop = "      ._________________.      "; hatMid = "     (      _______      )     "; }
  else if (form === 'eye') { hatLogo = "(E)"; hatTop = "      .________O________.      "; }
  else if (form === 'ditto') { hatLogo = " . "; hatTop = "      .                 .      "; }
  else if (form === 'spiky') { hatLogo = "[W]"; hatTop = "      .vvvvvvvvvvvvvvvvv.      "; }

  let brow = "  ._________________.  ";
  if (emotion_state === 'alert' || emotion_state === 'attack' || emotion_state === 'angry') brow = "  .^^^^^^^^^^^^^^^^^.  ";
  else if (emotion_state === 'curious') brow = "  .____/_______/____.  ";
  else if (emotion_state === 'surprised') brow = "  .  /           \\  .  ";
  else if (emotion_state === 'happy') brow = "  .   \\         /   .  ";
  else if (emotion_state === 'sad') brow = "  .   /         \\   .  ";

  let mouth = "|    {===========}    |";
  if (isSpeaking) {
    const typingProgress = animation_phase % 8;
    const isQuiet = intensity < 30;
    let frames = (isQuiet) ? ["|    {    ---    }    |", "|    {   -----   }    |", "|    {    ---    }    |", "|    {    ...    }    |"]
               : (intensity > 70) ? ["|    {   ( O )   }    |", "|    {    -X-    }    |", "|    {   [---]   }    |", "|    {    (0)    }    |"]
               : ["|    {    ---    }    |", "|    {   (---)   }    |", "|    {    -o-    }    |", "|    {     o     }    |"];
    mouth = frames[typingProgress % frames.length];
  } else if (emotion_state === 'attack' || emotion_state === 'angry') {
    mouth = (animation_phase % 2 === 0) ? "|    {VVVVVVVVVVV}    |" : "|    {^^^^^^^^^^^}    |";
  } else if (emotion_state === 'happy') { mouth = "|    {  \\_______/  }    |"; }
  else if (emotion_state === 'sad') { mouth = "|    {  /-------\\  }    |"; }

  let nose = "|          ^          |";
  if (isProcessing && animation_phase % 2 === 0) nose = "|         (<*>)       |";

  // Raw Sprite Base
  const baseSprite = [
    hatTop, hatMid,
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

  // OPTIMIZATION: Combine normalization, scaling, and swaying into a single block
  const horizontalSway = Math.floor(Math.sin(animation_phase * 0.08) * 2);
  const targetWidth = 33;
  const spriteHeight = baseSprite.length;
  const processedSprite: string[] = new Array(spriteHeight * 2);
  
  for (let i = 0; i < spriteHeight; i++) {
    let line = baseSprite[i];
    // Normalize to 33
    if (line.length !== targetWidth) {
      const diff = targetWidth - line.length;
      const lp = diff >> 1;
      line = " ".repeat(lp) + line + " ".repeat(diff - lp);
    }
    // Scale 2x and Sway in one pass
    let scaled = "";
    if (horizontalSway > 0) scaled = " ".repeat(horizontalSway);
    for (let j = 0; j < targetWidth; j++) scaled += line[j] + line[j];
    if (horizontalSway < 0) scaled += " ".repeat(-horizontalSway);
    
    // Vertical Scale
    processedSprite[i * 2] = scaled;
    processedSprite[i * 2 + 1] = scaled;
  }
  
  // 5. HUD Logic (Optimized linear indices)
  const displayedSpeech = state.full_speech || "";
  const wrapWidth = 52;
  const charSpeed = 1.8 + (state.intensity / 40);
  const timeSinceCommand = animation_phase - state.last_command_phase;
  const visibleThreshold = Math.floor(timeSinceCommand * charSpeed);
  
  const words = displayedSpeech.split(' ');
  const wrappedLines: string[] = [];
  let currentWrapped = "";
  words.forEach(w => {
    if ((currentWrapped + w).length <= wrapWidth) currentWrapped += (currentWrapped === "" ? "" : " ") + w;
    else { wrappedLines.push(currentWrapped); currentWrapped = w; }
  });
  if (currentWrapped) wrappedLines.push(currentWrapped);

  // Linear accumulation for line indices
  const hudMax = 4;
  let runningLen = 0;
  let typingIdx = 0;
  const hudLinesOut: string[] = [];
  
  for(let i=0; i<wrappedLines.length; i++) {
    const l = wrappedLines[i];
    const prevTotal = runningLen;
    runningLen += l.length + 1;
    if (visibleThreshold >= prevTotal) typingIdx = i;
  }

  const hudStart = Math.max(0, typingIdx - (hudMax - 1));
  let cumulativeForHud = 0;
  for(let i=0; i<hudStart; i++) cumulativeForHud += wrappedLines[i].length + 1;

  for (let i = 0; i < hudMax; i++) {
    const absIdx = hudStart + i;
    if (absIdx >= wrappedLines.length) { hudLinesOut.push(`[ ${"".padEnd(wrapWidth)} ]`); continue; }
    
    const line = wrappedLines[absIdx];
    const visibleInLine = Math.max(0, visibleThreshold - cumulativeForHud);
    cumulativeForHud += line.length + 1;

    if (visibleInLine <= 0) hudLinesOut.push(`[ ${"".padEnd(wrapWidth)} ]`);
    else if (visibleInLine < line.length) {
      const g = ["_", "█", "▒", "░"][Math.floor(animation_phase / 4) % 4];
      hudLinesOut.push(`[ ${(line.substring(0, visibleInLine) + g).padEnd(wrapWidth)} ]`);
    } else hudLinesOut.push(`[ ${line.padEnd(wrapWidth)} ]`);
  }

  // 6. Compositing (Optimized String Overlays)
  const frameLines: string[] = new Array(bgHeight);
  const spriteWidth = processedSprite[0].length;
  const charHOffset = (bgWidth - spriteWidth) >> 1;
  const breathY = Math.floor(Math.sin(animation_phase * 0.15) * 1.2);
  const floatY = Math.floor(Math.cos(animation_phase * 0.05) * 0.8);
  const charVOffset = ((bgHeight - (processedSprite.length + hudMax + 1)) >> 1) + breathY + floatY - 2;

  const hudVStart = bgHeight - hudMax - 1;
  const hudHOffset = (bgWidth - (wrapWidth + 4)) >> 1;

  for (let y = 0; y < bgHeight; y++) {
    const isCleanZone = (y >= 26);
    let line = isCleanZone ? " ".repeat(bgWidth) : generateBGLine(animation_phase, y);
    
    // Overlay Sprite (only on non-CleanZone rows or handle transparency if it overlaps)
    const sIdx = y - charVOffset;
    if (sIdx >= 0 && sIdx < processedSprite.length) {
      const sLine = processedSprite[sIdx];
      // OPTIMIZATION: Overwrite using substrings to avoid per-character allocation
      const leftPart = line.substring(0, charHOffset);
      const rightPart = line.substring(charHOffset + sLine.length);
      
      // We still need per-char check for 'transparency' (spaces in sprite)
      let merged = "";
      for (let x = 0; x < sLine.length; x++) {
        const char = sLine[x];
        merged += (char !== ' ') ? char : line[charHOffset + x];
      }
      line = leftPart + merged + rightPart;
    }
    
    // Overlay HUD (Clean background for text area)
    const hIdx = y - hudVStart;
    if (hIdx >= 0 && hIdx < hudMax) {
      const hLine = hudLinesOut[hIdx];
      line = line.substring(0, hudHOffset) + hLine + line.substring(hudHOffset + hLine.length);
    }

    // Fast scanline
    const scanPos = (animation_phase % 40);
    if (!isCleanZone && (y === scanPos || y === scanPos - 1)) {
      line = line.replace(/[^\s]/g, (c) => Math.random() > 0.5 ? "=" : "-");
    }

    frameLines[y] = line.substring(0, bgWidth);
  }

  // Global glitching (post-process)
  if (emotion_state === 'glitch' || entropy > 0.6) {
    for (let i = 0; i < frameLines.length; i++) {
      if (i < 26 && Math.random() < (emotion_state === 'glitch' ? 0.2 : 0.05)) {
        const offset = Math.floor(Math.random() * 5) - 2;
        if (offset > 0) frameLines[i] = " ".repeat(offset) + frameLines[i].substring(0, bgWidth - offset);
        else if (offset < 0) frameLines[i] = frameLines[i].substring(-offset).padEnd(bgWidth, " ");
      }
    }
  }

  return frameLines.join("\n");
}

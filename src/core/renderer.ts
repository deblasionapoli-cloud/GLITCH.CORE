/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { State } from './types';

// ANSI Colors
const C_RESET = "\x1b[0m";
const C_GREEN = "\x1b[32m";
const C_RED   = "\x1b[31m";
const C_YELLOW = "\x1b[33m";
const C_CYAN  = "\x1b[36m";
const C_DIM   = "\x1b[2m";
const C_BRIGHT = "\x1b[1m";

/**
 * APEX CORE RENDERER
 * Pure transformation layer: State -> ASCII Frame
 */
export function renderFrame(state: State, config: { width?: number } = {}): string {
  const { emotion_state, animation_phase, entropy, power_state } = state;
  const terminalWidth = config.width || 80;
  
  if (power_state === 'off') {
     const msg = `[ SIGNAL_LOST ]`;
     const padding = " ".repeat(Math.max(0, Math.floor((terminalWidth - msg.length) / 2)));
     return `\n\n\n${padding}${C_RED}${msg}${C_RESET}\n\n\n`;
  }

  if (power_state === 'rebooting') {
     const dots = ".".repeat((animation_phase % 4));
     const msg1 = `REBOOTING${dots}`;
     const msg2 = `BIOS_V_2.1.0`;
     const msg3 = `CHECKING_INTEGRITY...`;
     const p1 = " ".repeat(Math.max(0, Math.floor((terminalWidth - msg1.length) / 2)));
     const p2 = " ".repeat(Math.max(0, Math.floor((terminalWidth - msg2.length) / 2)));
     const p3 = " ".repeat(Math.max(0, Math.floor((terminalWidth - msg3.length) / 2)));
     return `\n\n\n${p1}${C_CYAN}${msg1}${C_RESET}\n\n\n${p2}${C_DIM}${msg2}${C_RESET}\n${p3}${C_DIM}${msg3}${C_RESET}`;
  }

  let color = C_GREEN;
  if (emotion_state === 'alert') color = C_YELLOW;
  if (emotion_state === 'attack' || emotion_state === 'glitch') color = C_RED;
  if (emotion_state === 'melancholic') color = C_CYAN;
  if (emotion_state === 'nostalgic') color = C_YELLOW + C_DIM;
  if (emotion_state === 'schizo') color = C_RED + C_BRIGHT;
  if (entropy > 60) color = C_BRIGHT + C_RED;

  // Base Face (Fixed segments for ASCII structure)
  const faceWidth = 25;
  let top    = "  [===================]  ";
  let brow   = " /                     \\ ";
  let eyes   = "|    [ O ]     [ O ]    |";
  let nose   = "|          |          |";
  let mouth  = "|    {-----------}    |";
  let bottom = " \\_____________________/ ";

  // State-based deformation
  if (emotion_state === 'alert') {
    eyes  = "|    [ @ ]     [ @ ]    |";
    mouth = "|    {  -------  }    |";
  } else if (emotion_state === 'attack') {
    top    = "  [vvvvvvvvvvvvvvvvvvv]  ";
    eyes   = "|    [ > ]     [ < ]    |";
    mouth  = "|    {WWWWWWWWWWW}    |";
  } else if (emotion_state === 'melancholic' || emotion_state === 'nostalgic') {
    eyes  = "|    [ u ]     [ u ]    |";
    mouth = "|    {    ___    }    |";
  } else if (emotion_state === 'schizo') {
    eyes  = "|    [ ? ]     [ ! ]    |";
    mouth = "|    { %%%%%%%%  }    |";
  }

  // ENTROPY DISTORTION
  const distort = (line: string): string => {
    if (entropy < 5) return line;
    return line.split('').map(char => {
      if (char === ' ' || char === '|') return char;
      if (Math.random() * 100 < entropy * 0.4) {
         const noise = ['!', '?', '#', '@', '&', '%', '*', '+', '=', '-', '/', '\\', 'X', '>', '<', '[', ']', '{', '}'];
         return noise[Math.floor(Math.random() * noise.length)];
      }
      return char;
    }).join('');
  };

  // Mouth animation
  if (state.display_speech.length > 0 && state.display_speech !== state.last_speech && animation_phase % 4 < 2) {
      mouth = "|    {     ---     }    |";
  }

  // Text corruption
  let finalSpeech = state.display_speech;
  if (entropy > 50 || state.speech_sentiment === 'chaotic') {
     finalSpeech = finalSpeech.split('').map(c => 
       (Math.random() * 100 < entropy * 0.1) ? ['#', '!', '_', '/', 'X'][Math.floor(Math.random()*5)] : c
     ).join('');
  }

  // Generate Diagnostic Sidebars
  const generateLog = (phaseIdx: number, side: 'L' | 'R') => {
    const logs = ["0xAF42", "SYS_INT", "IO_WAIT", "PX_INIT", "MEM_DUMP", "NET_SYNC", "IRQ_7", "DMA_SET", "VEC_RDY", "CRON_Q", "S_PIPE", "KERN_OK", "X_BOOT", "L_CORE", "P_BUSY", "SYSCALL", "SIGTERM", "0xFF01"];
    const result = [];
    for (let i = 0; i < 8; i++) {
        const idx = (phaseIdx + i) % logs.length;
        let entry = logs[idx];
        if (entropy > 40 && Math.random() < (entropy / 100)) {
           entry = Math.floor(Math.random() * 65535).toString(16).toUpperCase().padStart(6, '0');
        }
        const marker = Math.random() > 0.95 ? "!!" : "..";
        if (side === 'L') result.push(`${C_DIM}${entry.padEnd(7)}${C_RESET} ${marker}`);
        else result.push(`${marker} ${C_DIM}${entry.padStart(7)}${C_RESET}`);
    }
    return result;
  };

  const leftBar = generateLog(Math.floor(animation_phase / 5), 'L');
  const rightBar = generateLog(Math.floor(animation_phase / 5), 'R');

  const faceLines = [
    distort(top),
    distort(brow),
    distort(eyes),
    distort(nose),
    distort(mouth),
    distort(bottom),
  ];

  // Dynamic Layout Calculation
  const sideBarWidth = 10; // Log (7) + Marker (3)
  const contentWidth = faceWidth + (sideBarWidth * 2) + 2; // + spacing
  const horizontalPadding = " ".repeat(Math.max(0, Math.floor((terminalWidth - contentWidth) / 2)));

  const mergedLines = faceLines.map((line, i) => {
      const l = leftBar[i] || "          ";
      const r = rightBar[i] || "          ";
      return `${horizontalPadding}${l} ${color}${line}${C_RESET} ${r}`;
  });

  const speechEnv = `[ ${finalSpeech} ]`;
  const speechPad = " ".repeat(Math.max(0, Math.floor((terminalWidth - speechEnv.length) / 2)));

  const frame = [
    "",
    ...mergedLines,
    "",
    `${speechPad}${C_CYAN}${speechEnv}${C_RESET}`,
    ""
  ].join('\n');

  return frame;
}





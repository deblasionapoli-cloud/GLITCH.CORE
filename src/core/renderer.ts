/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { State } from './types';

/**
 * APEX CORE RENDERER
 * Pure transformation layer: State -> ASCII Frame
 */
export function renderFrame(state: State): string {
  const { emotion_state, animation_phase, entropy } = state;
  
  // Base Components (Geometric/Terminal Aesthetic)
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
  }

  // ENTROPY DISTORTION (Distinctive Trait)
  // Higher entropy causes character replacement and shifting
  const distort = (line: string): string => {
    if (entropy < 5) return line;
    
    return line.split('').map(char => {
      // Don't distort layout characters as easily to keep structure
      if (char === ' ' || char === '|') return char;
      
      // Probabilistic character swap based on entropy
      if (Math.random() * 100 < entropy * 0.4) {
         const noise = ['!', '?', '#', '@', '&', '%', '*', '+', '=', '-', '/', '\\', 'X', '>', '<', '[', ']', '{', '}'];
         return noise[Math.floor(Math.random() * noise.length)];
      }
      return char;
    }).join('');
  };

  // Mouth animation during speech simulation
  if (state.display_speech.length > 0 && state.display_speech !== state.last_speech && animation_phase % 4 < 2) {
      mouth = "|    {     ---     }    |";
  }

  // Text corruption on the speech line itself if entropy is high
  let finalSpeech = state.display_speech;
  if (entropy > 50 || state.speech_sentiment === 'chaotic') {
     finalSpeech = finalSpeech.split('').map(c => 
       (Math.random() * 100 < entropy * 0.1) ? ['#', '!', '_', '/', 'X'][Math.floor(Math.random()*5)] : c
     ).join('');
  }

  // Generate Diagnostic Sidebars with Entropy Corruption
  const generateLog = (phaseIdx: number, side: 'L' | 'R') => {
    const logs = [
      "0xAF42", "SYS_INT", "IO_WAIT", "PX_INIT", "MEM_DUMP", "NET_SYNC", 
      "IRQ_7", "DMA_SET", "VEC_RDY", "CRON_Q", "S_PIPE", "KERN_OK",
      "X_BOOT", "L_CORE", "P_BUSY", "SYSCALL", "SIGTERM", "0xFF01"
    ];
    const result = [];
    for (let i = 0; i < 8; i++) {
        const idx = (phaseIdx + i) % logs.length;
        let entry = logs[idx];
        
        // Corrupt logs based on core entropy
        if (entropy > 40 && Math.random() < (entropy / 100)) {
           entry = Math.floor(Math.random() * 65535).toString(16).toUpperCase().padStart(6, '0');
        }

        const marker = Math.random() > 0.95 ? "!!" : "..";
        if (side === 'L') result.push(`${entry.padEnd(7)} ${marker}`);
        else result.push(`${marker} ${entry.padStart(7)}`);
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

  // Merge sidebars with face
  const mergedLines = faceLines.map((line, i) => {
      const l = leftBar[i] || "         ";
      const r = rightBar[i] || "         ";
      return `${l.padEnd(12)} ${line} ${r.padStart(12)}`;
  });

  const frame = [
    "",
    ...mergedLines,
    "",
    `[ ${finalSpeech} ]`,
    ""
  ].join('\n');

  return frame;
}





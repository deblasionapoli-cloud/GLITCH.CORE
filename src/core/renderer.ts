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
  
  // Animation jitter logic based on intensity/state
  const jitter = emotion_state === 'attack' || emotion_state === 'glitch' 
    ? (Math.random() > 0.8 ? ' ' : '')
    : '';

  // Base DK Face Components
  let brow = "  .___________________.  ";
  let eyes = "|    ( O )   ( O )    |";
  let middle = "|          ^          |";
  let mouth = "|    {===========}    |";
  let chin =  "  '___________________'  ";

  // State-based deformation
  if (emotion_state === 'alert') {
    eyes =  "|    ( @ )   ( @ )    |";
    mouth = "|    {-----------}    |";
  } else if (emotion_state === 'attack') {
    brow =  "  .vvvvvvvvvvvvvvvvvvv.  ";
    eyes =  "|    ( > )   ( < )    |";
    mouth = "|    {WWWWWWWWWWW}    |";
    // Jitter eyes
    if (animation_phase % 2 === 0) {
      eyes = "|     (> )   ( <)     |";
    }
  } else if (emotion_state === 'glitch') {
    brow =  " ._!!_?_!!_#_!!_@_!!_. ";
    eyes =  "|  ( % )   ( & )   |";
    mouth = "|  {/\\/\\/\\/\\/\\/\\}   |";
    if (Math.random() > 0.5) {
       middle = "|   X      ?      X   |";
    }
  }

  // Mouth animation during speech simulation (subtle)
  if (state.last_speech.length > 0 && animation_phase % 4 < 2) {
      if (emotion_state === 'calm') mouth = "|    {     ---     }    |";
  }

  const frame = [
    jitter + brow,
    jitter + eyes,
    jitter + middle,
    jitter + mouth,
    jitter + chin,
    "",
    `[ ${state.last_speech} ]`,
    ""
  ].join('\n');

  return frame;
}

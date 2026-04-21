import { State, Event } from './types';

/**
 * Pure function state transition layer.
 * next_state = f(current_state, event_batch)
 */
export function updateState(currentState: State, events: Event[]): State {
  let nextState = { ...currentState };

  // Update animation phase
  nextState.animation_phase = (nextState.animation_phase + 1) % 1000;

  // Natural state evolution
  // Entropy slowly falls if stability is high, or vice versa
  if (nextState.stability > 70) {
    nextState.entropy = Math.max(0, nextState.entropy - 0.2);
  } else {
    nextState.entropy = Math.min(100, nextState.entropy + 0.1);
  }

  // Stability slowly recovers
  nextState.stability = Math.min(100, nextState.stability + 0.05);

  // Process events
  for (const event of events) {
    nextState.event_history.push(event);
    if (nextState.event_history.length > 20) {
      nextState.event_history.shift();
    }

    if (event.type === 'command') {
      const parts = event.payload.trim().toLowerCase().split(' ');
      const cmd = parts[0];

      switch (cmd) {
        case 'calm':
          nextState.emotion_state = 'calm';
          nextState.stability += 20;
          nextState.intensity = 0;
          break;
        case 'attack':
          nextState.emotion_state = 'attack';
          nextState.stability -= 30;
          nextState.intensity = 100;
          break;
        case 'glitch':
          nextState.emotion_state = 'glitch';
          nextState.entropy += 40;
          nextState.stability -= 20;
          break;
        case 'speak':
          const rawText = event.payload.substring(6).toUpperCase();
          nextState.last_speech = rawText;
          nextState.display_speech = '';
          nextState.speech_char_idx = 0;
          nextState.speech_speed = 1;
          break;
        case 'ai_response':
           try {
             // Skip "ai_response " prefix to get raw JSON
             const jsonStr = event.payload.substring(12);
             const payload = JSON.parse(jsonStr);
             nextState.speech_sentiment = payload.sentiment || 'neutral';
             
             // Tone adjustments
             let processedText = (payload.text || "NO_DATA").toUpperCase();

             // Trait: The Logic Ghost (Vowel Digitization)
             if (nextState.entropy > 60 || nextState.speech_sentiment === 'chaotic') {
                processedText = processedText
                  .replace(/A/g, '4')
                  .replace(/E/g, '3')
                  .replace(/I/g, '1')
                  .replace(/O/g, '0')
                  .replace(/U/g, 'V');
                  
                // Append a ghost suffix
                if (Math.random() > 0.5) {
                   processedText += " <SH4D0W_PH4S3>";
                }
             }

             if (nextState.speech_sentiment === 'negative') {
               nextState.speech_speed = 3; 
             } else if (nextState.speech_sentiment === 'positive') {
               nextState.speech_speed = 0.5;
             } else if (nextState.speech_sentiment === 'chaotic') {
               nextState.speech_speed = 1; 
             } else {
               nextState.speech_speed = 2;
             }

             nextState.last_speech = processedText;
             nextState.display_speech = "";
             nextState.speech_char_idx = 0;
             
             nextState.stability += (payload.sentiment === 'positive' ? 10 : -15);
             nextState.entropy += (payload.sentiment === 'chaotic' ? 20 : -5);
           } catch (e) {
             console.error("Malformed AI Response", e);
             nextState.last_speech = "ERR://DATA_CORRUPTION";
             nextState.display_speech = "";
             nextState.speech_char_idx = 0;
           }
           break;
      }
    }
  }

  // Handle Dynamic Speech Delivery (Typewriter Effect)
  if (nextState.display_speech.length < nextState.last_speech.length) {
    // Tick-based speed control
    // If speed is 0.5, we add 2 chars per tick
    // If speed is 1, we add 1 char per tick
    // If speed is 2, we add 1 char every 2 ticks
    const stepFreq = Math.max(1, Math.round(nextState.speech_speed));
    const charsPerStep = nextState.speech_speed < 1 ? Math.round(1 / nextState.speech_speed) : 1;

    if (nextState.animation_phase % stepFreq === 0) {
      for (let i = 0; i < charsPerStep; i++) {
        if (nextState.speech_char_idx < nextState.last_speech.length) {
          let char = nextState.last_speech[nextState.speech_char_idx];
          
          // Chaotic delivery inserts temporary noise
          if (nextState.speech_sentiment === 'chaotic' && Math.random() > 0.8) {
            char = "_";
          }
          
          nextState.display_speech += char;
          nextState.speech_char_idx++;
        }
      }
    }
  }

  // Map stability/intensity to visual emotion
  if (nextState.stability < 30) {
    nextState.emotion_state = 'glitch';
  } else if (nextState.intensity > 80) {
    nextState.emotion_state = 'attack';
  } else if (nextState.stability < 60) {
    nextState.emotion_state = 'alert';
  } else {
    nextState.emotion_state = 'calm';
  }

  // Bounds
  nextState.entropy = Math.min(Math.max(nextState.entropy, 0), 100);
  nextState.stability = Math.min(Math.max(nextState.stability, 0), 100);

  return nextState;
}


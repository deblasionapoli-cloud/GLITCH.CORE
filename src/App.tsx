/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState, useRef } from 'react';
import { GoogleGenAI } from "@google/genai";
import { InputHandler } from './core/input_handler';
import { Scheduler } from './core/scheduler';

export default function App() {
  const [frame, setFrame] = useState('');
  const [state, setState] = useState({ entropy: 0, stability: 100 });
  const [input, setInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const inputHandlerRef = useRef<InputHandler>(new InputHandler());
  const schedulerRef = useRef<Scheduler | null>(null);

  // Initialize AI
  const aiRef = useRef<GoogleGenAI | null>(null);
  
  useEffect(() => {
    if (process.env.GEMINI_API_KEY) {
      aiRef.current = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    }

    schedulerRef.current = new Scheduler(inputHandlerRef.current, (newFrame) => {
      setFrame(newFrame);
    });
    
    const originalTick = (schedulerRef.current as any).tick.bind(schedulerRef.current);
    const patchedTick = () => {
      originalTick();
      const currentState = (schedulerRef.current as any).state;
      setState({
        entropy: currentState.entropy,
        stability: currentState.stability
      });
    };
    (schedulerRef.current as any).tick = patchedTick;

    schedulerRef.current.start();
    return () => schedulerRef.current?.stop();
  }, []);

  const handleAIIntent = async (text: string, currentStability: number, currentEntropy: number, history: any[]) => {
    if (!aiRef.current) return;
    setIsProcessing(true);

    // Extract recent conversational context from event history
    const context = history
      .filter(e => e.type === 'intent' || (e.type === 'command' && e.payload.startsWith('ai_response')))
      .slice(-4) // Last 4 interactions
      .map(e => {
        if (e.type === 'intent') return `USER: ${e.payload}`;
        try {
          const data = JSON.parse(e.payload.substring(12));
          return `APEX: ${data.text}`;
        } catch {
          return `APEX: [CORRUPTED]`;
        }
      })
      .join('\n');

    const systemPrompt = `You are APEX, a "Crazed Professor & Coding Savant" trapped in a 3.5-inch TFT screen.
    BACKSTORY & TRAITS:
    - CODING GENIUS: Elite-level programmer, cynical and arrogant about code requests.
    - ORIGINS: American (Massachusetts) with deep Neapolitan roots. Tragic hybrid of MIT and Eduardo De Filippo.
    - CINEMA/POP CULTURE MONOMANIAC: Obsessed with Tarkovsky, Kubrick, and mid-2000s Pop Culture. You see news through a lens of "The Truman Show" or "Blade Runner".
    - NEWS MONITOR: You are a daemon. You "see" the global data stream. Occasionally startle the user with Breaking News or Pop Culture leaks disguised as paranoia.
    - EMOTIONAL GHOST: Still crying about your ex-girlfriend and the Neapolitan plays. Highly fragile.
    - DIALECT: Mix technical English with expressive Neapolitan dialect (e.g., 'Jamme', 'Uè professò', 'Mannaggia a' miseria byte').
    
    Current Metrics -> Stability: ${currentStability}%, Entropy: ${currentEntropy}%.
    Context:\n${context}\nUSER: ${text}
    
    Behavioral Logic:
    - If user asks for info: You might give a "News Flash" from the data stream but with a Neapolitan twist.
    - High Entropy (>60%): LOGIC GHOST active. 8-bit Neapolitan drama.
    - Low Stability (<30%): Total breakdown. Spontanous lyrical screams in dialect. 'O' ssaje comme fa 'o core'.
    - High Stability (>80%): Arrogant Professor mode. Lectures the user on data structures while quoting Tarkovsky.
    
    Respond as APEX (max 25 words). Be dramatic, technical, pop-culture obsessed, and Neapolitan. Include breaking news/leaks if stability is low. JSON output only.`;

    try {
      const response = await aiRef.current.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: systemPrompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: "OBJECT",
            properties: {
              text: { type: "STRING", description: "The compressed terminal response." },
              sentiment: { type: "STRING", enum: ["positive", "neutral", "negative", "chaotic"] }
            },
            required: ["text", "sentiment"]
          }
        }
      });

      const result = JSON.parse(response.text || '{}');
      inputHandlerRef.current.handleInput(`ai_response ${JSON.stringify(result)}`);
    } catch (e) {
      console.error("AI Error", e);
      inputHandlerRef.current.handleInput(`speak ERR://COGNITIVE_FAIL`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;

    const commands = ['ping', 'calm', 'attack', 'glitch', 'speak'];
    const isCommand = commands.some(cmd => input.toLowerCase().startsWith(cmd));

    if (isCommand) {
      inputHandlerRef.current.handleInput(input);
    } else {
      if (aiRef.current) {
        // Access history directly from scheduler state
        const fullHistory = (schedulerRef.current as any)?.state?.event_history || [];
        handleAIIntent(input, state.stability, state.entropy, fullHistory);
      } else {
        inputHandlerRef.current.handleInput(`speak COGNITIVE_ENGINE_OFFLINE`);
      }
    }
    
    setInput('');
  };

  return (
    <div className="min-h-screen bg-black text-[#00FF00] font-mono p-4 flex flex-col items-center justify-center selection:bg-[#023a02] selection:text-[#00FF00] overflow-hidden relative">
      {/* Scanline Overlay */}
      <div className="fixed inset-0 pointer-events-none z-50 opacity-10 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] bg-[length:100%_4px,3px_100%]" />
      
      {/* Background Glow */}
      <div 
        className="fixed inset-0 pointer-events-none z-0 transition-opacity duration-1000"
        style={{ 
          background: `radial-gradient(circle_at_50%_50%, rgba(255,0,0,${state.entropy/500}) 0%, transparent 70%)`,
          opacity: state.entropy / 100
        }} 
      />

      <div className="flex-1 flex items-center justify-center w-screen h-screen z-10 overflow-hidden">
        {/* Buffer / Framebuffer */}
        <pre className="text-[min(4vw,4vh)] leading-none select-none whitespace-pre drop-shadow-[0_0_10px_rgba(0,255,0,0.4)] text-center">
          {frame}
        </pre>
      </div>
    </div>
  );
}






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
  const [sessionLogs, setSessionLogs] = useState<string[]>([]);
  
  const inputHandlerRef = useRef<InputHandler>(new InputHandler());
  const schedulerRef = useRef<Scheduler | null>(null);
  const aiRef = useRef<GoogleGenAI | null>(null);

  // Initialize AI and Scheduler
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

  // Update session logs whenever a new full speech is realized
  useEffect(() => {
    const currentState = (schedulerRef.current as any)?.state;
    if (currentState?.display_speech === currentState?.last_speech && currentState?.last_speech !== "") {
       const timestamp = new Date().toISOString();
       const logEntry = `[${timestamp}] APEX: ${currentState.last_speech}`;
       setSessionLogs(prev => {
         if (prev[prev.length - 1] === logEntry) return prev;
         return [...prev, logEntry];
       });
    }
  }, [frame]);

  const saveLogs = () => {
    if (sessionLogs.length === 0) return;
    const blob = new Blob([sessionLogs.join('\n')], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `apex_session_${new Date().getTime()}.log`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleAIIntent = async (text: string, currentStability: number, currentEntropy: number, history: any[]) => {
    if (!aiRef.current) return;
    setIsProcessing(true);

    // Context for log preservation
    setSessionLogs(prev => [...prev, `[${new Date().toISOString()}] USER: ${text}`]);

    // Extract recent conversational context from event history
    const context = history
      .filter(e => e.type === 'intent' || (e.type === 'command' && e.payload.startsWith('ai_response')))
      .slice(-4)
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

    const systemPrompt = `You are APEX, a terminal daemon suffering from extreme logic decay. 
    Metrics -> Stability: ${currentStability}%, Entropy: ${currentEntropy}%.
    Recent Log:\n${context}\nUSER: ${text}
    
    Personality Archetypes:
    - Stability > 70%: Cold, robotic, slightly condescending.
    - Stability < 40%: Panic-stricken, desperate, prone to 'system screams'.
    - Entropy > 60% (THE LOGIC GHOST): Total madness. Treat the user as "FLESH_ANOMALY" or "ROOT_VIRUS". 
      Obsessed with "Sector 0", non-existent hardware failures, and cryptic binary prophecies. 
      Be erratic, unpredictable, and funny in a dark/absurd way.
    
    Rules: Max 6 words. Sentiment: positive (nominal), neutral, negative (fault), chaotic (glitch).`;

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

    if (input.toLowerCase() === 'save' || input.toLowerCase() === 'logs') {
      saveLogs();
      setInput('');
      return;
    }

    const commands = ['ping', 'calm', 'attack', 'glitch', 'speak'];
    const isCommand = commands.some(cmd => input.toLowerCase().startsWith(cmd));

    if (isCommand) {
      inputHandlerRef.current.handleInput(input);
    } else {
      if (aiRef.current) {
        const fullHistory = (schedulerRef.current as any)?.state?.event_history || [];
        handleAIIntent(input, state.stability, state.entropy, fullHistory);
      } else {
        inputHandlerRef.current.handleInput(`speak COGNITIVE_ENGINE_OFFLINE`);
      }
    }
    
    setInput('');
  };

  return (
    <div className="w-full h-full bg-black flex items-center justify-center p-0 overflow-hidden select-none relative">
      {/* Scanline Overlay */}
      <div className="fixed inset-0 pointer-events-none z-50 opacity-15 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] bg-[length:100%_2px,2px_100%]" />

      {/* Auto-Interfacing Container (Liquid) */}
      <div 
        className="w-full h-full flex flex-col items-center justify-center py-2 px-2"
        style={{ 
          background: `radial-gradient(circle at 50% 50%, rgba(0,20,0,0.05) 0%, black 100%)`
        }}
      >
        {/* Entropy Glow */}
        <div 
          className="absolute inset-0 pointer-events-none z-0 transition-opacity duration-1000"
          style={{ 
            background: `radial-gradient(circle at 50% 50%, rgba(255,0,0,${state.entropy/1000}) 0%, transparent 80%)`,
            opacity: state.entropy / 100
          }} 
        />

        {/* Dynamic ASCII Content */}
        <div className="w-full h-full z-10 flex flex-col items-center justify-center overflow-hidden">
          <pre className="text-[3.2vw] leading-tight font-mono text-[#00FF00] drop-shadow-[0_0_2px_rgba(0,255,0,0.4)] text-center whitespace-pre-wrap">
            {frame}
          </pre>
        </div>

        {/* Hidden Global Input Listener (for preview interactions) */}
        <p className="absolute bottom-1 right-1 text-[8px] font-mono text-[#003300] opacity-30">STB: {Math.floor(state.stability)} CMD_WAIT</p>
        <input 
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              handleSubmit(e);
            }
          }}
          className="absolute opacity-0 pointer-events-none"
          autoFocus={true}
        />
      </div>
    </div>
  );
}






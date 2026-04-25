/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { State, INITIAL_STATE } from './core/types';
import { renderFrame } from './core/renderer';
import { askDaemon } from './services/aiService';
import { auth, signIn, signOut, onRemoteCommand, markCommandProcessed, sendRemoteCommand } from './services/memoryService';
import { onAuthStateChanged, User } from 'firebase/auth';
import { Maximize2, Minimize2, Radio, Terminal } from 'lucide-react';
import { motion } from 'motion/react';

import { imageToAscii } from './utils/imageUtils';

export default function App() {
  const [frame, setFrame] = useState('');
  const [state, setState] = useState<State>(INITIAL_STATE);
  const [input, setInput] = useState('');
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [generatedFiles, setGeneratedFiles] = useState<{name: string, time: string}[]>([]);
  const socketRef = useRef<Socket | null>(null);
  const idleTimerRef = useRef<NodeJS.Timeout | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen().catch(err => {
        console.error(`Error attempting to enable full-screen mode: ${err.message}`);
      });
    } else {
      document.exitFullscreen();
    }
  };

  useEffect(() => {
    const handleFsChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handleFsChange);
    return () => document.removeEventListener('fullscreenchange', handleFsChange);
  }, []);

  const resetIdleTimer = () => {
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    
    // Più frequente: tra 45 e 120 secondi di inattività
    const randomInterval = 45000 + Math.random() * 75000;
    
    idleTimerRef.current = setTimeout(async () => {
      if (!isAiLoading) {
        setIsAiLoading(true);
        const response = await askDaemon("", true); 
        processDaemonResponse(response);
        setIsAiLoading(false);
        resetIdleTimer();
      }
    }, randomInterval);
  };

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
    });

    const socket = io();
    socketRef.current = socket;

    socket.on('state_update', (newState: State) => {
      setState(newState);
      setFrame(renderFrame(newState));
    });

    resetIdleTimer();

    return () => {
      unsub();
      socket.disconnect();
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    };
  }, []); // Remove isRemoteMode dependency to keep socket stable

  const processDaemonResponse = (response: string) => {
    // 1. Process Actions (Morph, State, Intensity)
    const morphMatch = response.match(/\[FORM:\s*([^\]]+)\]/i);
    if (morphMatch) {
      const morphName = morphMatch[1].trim().toLowerCase();
      const validMorphs = ['blob', 'eye', 'hardware', 'ditto', 'spiky'];
      if (validMorphs.includes(morphName)) {
        socketRef.current?.emit('command', `morph ${morphName}`);
      }
    }

    const stateMatch = response.match(/\[STATE:\s*([^\]]+)\]/i);
    if (stateMatch) {
      const stateName = stateMatch[1].trim().toLowerCase();
      const validStates = ['glitch', 'attack', 'alert', 'calm'];
      if (validStates.includes(stateName)) {
        socketRef.current?.emit('command', stateName);
      }
    }

    const intensityMatch = response.match(/\[INTENSITY:\s*(\d+)\]/i);
    if (intensityMatch) {
      const val = parseInt(intensityMatch[1]);
      if (!isNaN(val)) {
        socketRef.current?.emit('command', `intensity ${val}`);
      }
    }

    // 2. Process File Generation
    const fileMatch = response.match(/\[FILE:\s*([^\]\s]+)\]([\s\S]*?)(?:\[\/FILE\]|$)/i);
    if (fileMatch) {
      const filename = fileMatch[1].trim();
      const content = fileMatch[2].trim();
      if (content.length > 0) {
        const blob = new Blob([content], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        setGeneratedFiles(prev => [{name: filename, time: new Date().toLocaleTimeString()}, ...prev].slice(0, 5));
      }
    }

    // 3. Clean and Speak: Remove only known system tags
    const cleanResponse = response
      .replace(/\[FILE:\s*[^\]]+\][\s\S]*?\[\/FILE\]/gi, '')
      .replace(/\[FORM:\s*[^\]]+\]/gi, '')
      .replace(/\[STATE:\s*[^\]]+\]/gi, '')
      .replace(/\[INTENSITY:\s*[^\]]+\]/gi, '')
      .replace(/\s+/g, ' ')
      .trim();

    if (cleanResponse) {
      socketRef.current?.emit('command', `speak ${response}`);
    }
  };

  const handleCommandExecution = async (cmd: string) => {
    const cleanInput = cmd.trim();
    if (!cleanInput || !socketRef.current) return;

    resetIdleTimer();

    // Natural Language Intent Mapping (Local)
    const lowerInput = cleanInput.toLowerCase();
    
    // Quick triggers for state
    if (lowerInput.match(/\b(calmati|calma|shh|tranquillo|calm)\b/)) {
      socketRef.current.emit('command', 'calm');
      return;
    }
    if (lowerInput.match(/\b(attacca|distruggi|aggressivo|attack|kill)\b/)) {
      socketRef.current.emit('command', 'attack');
      return;
    }
    if (lowerInput.match(/\b(impazzisci|errore|glitch|bug|crash)\b/)) {
      socketRef.current.emit('command', 'glitch');
      return;
    }
    if (lowerInput.match(/\b(attenzione|avviso|alert|occhio|vigile)\b/)) {
      socketRef.current.emit('command', 'alert');
      return;
    }

    // Stream control
    if (lowerInput.includes('stream on') || lowerInput.includes('attiva stream')) {
      socketRef.current.emit('command', 'stream on');
      return;
    }
    if (lowerInput.includes('stream off') || lowerInput.includes('disattiva stream')) {
      socketRef.current.emit('command', 'stream off');
      return;
    }

    // Morph control
    const morphMatch = lowerInput.match(/\b(cambia forma in|trasformati in|morph|forma)\s+(\w+)\b/);
    if (morphMatch) {
      const morphName = morphMatch[2];
      const validMorphs = ['blob', 'eye', 'hardware', 'ditto', 'spiky'];
      if (validMorphs.includes(morphName)) {
        socketRef.current.emit('command', `morph ${morphName}`);
        return;
      }
    }

    // Fallback to AI for complex commands
    setIsAiLoading(true);
    const aiResponse = await askDaemon(cleanInput);
    setIsAiLoading(false);
    processDaemonResponse(aiResponse);
  };

  const handleFileUpload = async (fileOrEvent: File | React.ChangeEvent<HTMLInputElement>) => {
    let file: File | undefined;
    if ('target' in fileOrEvent) {
      file = fileOrEvent.target.files?.[0];
    } else {
      file = fileOrEvent;
    }

    if (!file || isAiLoading) return;

    setIsAiLoading(true);
    try {
      if (file.type.startsWith('image/')) {
        const ascii = await imageToAscii(file, 25);
        const prompt = `Ho scansionato questo oggetto visivo: \n${ascii}\nCosa ne pensi? Cambia forma se serve.`;
        const aiResponse = await askDaemon(prompt);
        processDaemonResponse(aiResponse);
      } else {
        const text = await file.text();
        const prompt = `Ho trovato questo frammento dati intitolato "${file.name}":\n\n${text.substring(0, 2000)}${text.length > 2000 ? '...' : ''}\n\nAnalizzalo. Se vuoi restituirmi una versione elaborata o un file di sistema, usa il formato [FILE:nome]...[/FILE].`;
        socketRef.current?.emit('command', `input [UPLOAD_FILE:${file.name}]`);
        const aiResponse = await askDaemon(prompt);
        processDaemonResponse(aiResponse);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsAiLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileUpload(e.dataTransfer.files[0]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanInput = input.trim();
    if (!cleanInput) return;

    await handleCommandExecution(cleanInput);
    setInput('');
  };

  // Adaptive Color Logic
  const getTerminalTheme = () => {
    const { emotion_state, intensity, animation_phase, last_command_phase, color_mode } = state;
    const iScale = intensity / 100;
    const isProcessing = last_command_phase >= 0 && (animation_phase - last_command_phase < 5);

    if (isProcessing) return 'text-phosphor-white glow-white brightness-125';

    if (emotion_state === 'glitch') {
      const glitchThemes = [
        'text-phosphor-green glow-green', 
        'text-phosphor-red glow-red', 
        'text-phosphor-white glow-white', 
        'text-phosphor-amber glow-amber', 
        'text-phosphor-cyan glow-cyan', 
        'text-phosphor-magenta glow-magenta'
      ];
      const speed = Math.max(1, Math.floor(10 - iScale * 8));
      const idx = (animation_phase % speed === 0) 
        ? Math.floor(Math.random() * glitchThemes.length)
        : Math.floor((animation_phase / 5) % glitchThemes.length);
      return glitchThemes[idx];
    }

    if (emotion_state === 'attack') return 'text-phosphor-red glow-red';
    
    // Kintsugi Color Shift
    if (color_mode === 'warm') return 'text-phosphor-amber glow-amber'; 

    if (emotion_state === 'alert' || iScale > 0.5) return 'text-phosphor-amber glow-amber';
    if (emotion_state === 'curious' || emotion_state === 'sad') return 'text-phosphor-cyan glow-cyan';
    if (emotion_state === 'surprised') return 'text-phosphor-magenta glow-magenta';
    if (emotion_state === 'bored') return 'text-phosphor-green opacity-70 brightness-75';
    
    return 'text-phosphor-green glow-green';
  };

  const themeClass = getTerminalTheme();

  return (
    <div 
      onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={handleDrop}
      className={`min-h-screen bg-[#050505] flex flex-col items-center justify-center ${isFullscreen ? 'p-0' : 'p-0 md:p-2'} font-mono selection:bg-[#00FF00] selection:text-black relative overflow-hidden transition-all duration-500 ${isDragging ? 'ring-2 ring-[#00FF00] ring-inset' : ''}`}
    >
      {/* Handcrafted performance mode: Overlays and glows disabled */}

      {/* Auth UI */}
      <div className={`fixed top-4 right-4 z-[60] flex items-center gap-4 transition-opacity duration-300 ${isFullscreen ? 'opacity-0 hover:opacity-100' : ''}`}>
        {user ? (
          <button 
            onClick={signOut}
            className="text-[8px] uppercase tracking-widest text-white/30 hover:text-[#00FF00] transition-colors border border-white/10 px-2 py-1 rounded-sm"
          >
            LOGOUT_IDENTITY_{user.displayName?.split(' ')[0]}
          </button>
        ) : (
          <button 
            onClick={signIn}
            className="text-[8px] uppercase tracking-widest text-[#00FF00]/40 hover:text-[#00FF00] transition-colors border border-[#00FF00]/20 px-2 py-1 rounded-sm animate-pulse"
          >
            RESTORE_IDENTITY_LINK
          </button>
        )}
      </div>        {/* Main Container */}
      <div className="relative flex flex-col items-center w-full h-screen max-w-full">
        {/* Character Box */}
        <div 
          className="relative flex-1 w-full flex items-center justify-center p-0"
        >
          <div 
            ref={containerRef}
            className={`relative flex flex-col items-center transition-all duration-300 overflow-hidden ${isFullscreen ? 'fixed inset-0 w-screen h-screen z-40 bg-black' : 'w-full h-full bg-transparent md:bg-black/80'}`}
          >
            {/* Fullscreen Toggle Button */}
            <button 
              onClick={toggleFullscreen}
              className="absolute top-4 left-4 z-50 text-white/20 hover:text-white/80 transition-colors p-2"
              title="Toggle Protocol (Fullscreen)"
            >
              {isFullscreen ? <Minimize2 size={24} /> : <Maximize2 size={18} />}
            </button>
 
            <pre 
              className={`${themeClass} text-[2.2vh] sm:text-[2.4vh] md:text-[2.8vh] leading-none tracking-tighter flex flex-col items-center justify-center select-none transition-all duration-200 overflow-hidden font-mono w-full h-full flex-1 relative`}
            >
              {(() => {
                const lines = frame.split('\n');
                
                return lines.map((line, i) => {
                  const isHud = (i >= 26); 
                  const isSpecialRow = i >= 32;
                  
                  return (
                    <div 
                      key={i} 
                      className={`flex justify-center w-full overflow-visible ${isHud ? 'py-[0.5vh]' : 'py-[0.01vh]'} ${isSpecialRow ? 'relative' : ''}`}
                      data-entity={isHud ? 'hud' : isSpecialRow ? 'special-row' : 'character'}
                    >
                      <span 
                        className={`whitespace-pre inline-block transition-all duration-300 ${isHud ? 'font-bold opacity-100' : 'opacity-[0.85]'}`} 
                        style={{ 
                          transform: isHud ? 'scale(2.2, 1.7)' : 'scale(1.2, 1.1)', 
                          transformOrigin: 'center'
                        }}
                      >
                        {line}
                      </span>
                    </div>
                  );
                });
              })()}
            </pre>

            {/* Global Input Bar - Small and moved to corner to avoid overlapping HUD */}
            <div className={`transition-all duration-500 z-[100] absolute bottom-4 right-4 sm:bottom-6 sm:right-6 w-[calc(100%-2rem)] sm:w-[320px]`}>
              <motion.div 
                animate={{ 
                  y: [0, -2, 0],
                }}
                transition={{
                  duration: 4,
                  repeat: Infinity,
                  ease: "easeInOut"
                }}
                className="flex items-center gap-3 bg-black/40 border border-white/10 rounded-full px-4 py-2 opacity-40 hover:opacity-100 focus-within:opacity-100 focus-within:bg-black/80 focus-within:border-white/30 transition-all duration-300 backdrop-blur-md relative overflow-hidden"
              >
                <form onSubmit={handleSubmit} className="flex-1 flex items-center gap-2">
                  <span className={`${themeClass} text-[10px] opacity-60 font-bold tracking-widest`}>&gt;</span>
                  <input 
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    disabled={isAiLoading}
                    className={`${themeClass} flex-1 bg-transparent border-none outline-none text-[12px] uppercase font-bold placeholder-[#ffffff33] tracking-widest ${isAiLoading ? 'opacity-20 animate-pulse' : ''}`}
                    placeholder={isAiLoading ? "SYS..." : "CMD_"}
                    autoFocus
                  />
                </form>
                
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  onChange={handleFileUpload}
                  className="hidden" 
                  accept=".txt,.json,.md,.js,.ts"
                />
                <button 
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isAiLoading}
                  className="text-white/20 hover:text-[#00FF00] transition-colors p-1"
                  title="Upload data cluster"
                >
                  <Terminal size={14} />
                </button>
              </motion.div>
            </div>
          </div>
        </div>
      </div>

      {/* Background Ambience */}
      <div className="fixed top-0 left-0 w-full p-4 flex justify-between items-center opacity-10 pointer-events-none text-red-500">
        <span className="text-[8px] uppercase tracking-tighter">GLITCH.CORE v0.9.1-ERR // SYSTEM_ANOMALY</span>
        <span className="text-[8px] uppercase tracking-tighter">Identity: GLITCH // Port 3000</span>
      </div>
    </div>
  );
}


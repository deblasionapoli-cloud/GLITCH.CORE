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
  const [isRemoteMode, setIsRemoteMode] = useState(false);
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

  // Remote Command Listener
  useEffect(() => {
    if (user && !isRemoteMode) {
      const unsub = onRemoteCommand(async (cmd, id) => {
        console.log("Remote command received:", cmd);
        await handleCommandExecution(cmd);
        await markCommandProcessed(id);
      });
      return () => unsub?.();
    }
  }, [user, isRemoteMode]);

  const resetIdleTimer = () => {
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    if (isRemoteMode) return;
    
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

    // 3. Clean and Speak: Remove all tags and speak the residue
    const cleanResponse = response
      .replace(/\[FILE:\s*[^\]]+\][\s\S]*?\[\/FILE\]/gi, '')
      .replace(/\[FORM:\s*[^\]]+\]/gi, '')
      .replace(/\[STATE:\s*[^\]]+\]/gi, '')
      .replace(/\[INTENSITY:\s*[^\]]+\]/gi, '')
      .replace(/\[.*?\]/gi, '') // Final catch-all
      .replace(/\*.*?\*/gi, '') // Strip asterisk descriptions
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

    if (isRemoteMode) {
      await sendRemoteCommand(cleanInput);
      setInput('');
      return;
    }

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

  // If in Remote Mode, show a simplified UI
  if (isRemoteMode) {
    return (
      <div className="min-h-screen bg-[#050505] flex flex-col items-center justify-center p-6 font-mono text-phosphor-green selection:bg-phosphor-green selection:text-black relative">
        {/* Remote Grid Background */}
        <div className="absolute inset-0 opacity-5 pointer-events-none bg-[linear-gradient(rgba(0,255,0,0.1)_1px,transparent_1px),linear-gradient(90deg,rgba(0,255,0,0.1)_1px,transparent_1px)] bg-[size:40px_40px]" />
        
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-lg bg-black/60 border border-phosphor-green/30 rounded-xl p-10 backdrop-blur-2xl shadow-[0_0_80px_rgba(0,255,0,0.15)] relative z-10"
        >
          <div className="flex items-center justify-between mb-10">
            <div className="flex items-center gap-4">
              <div className="w-2 h-2 rounded-full bg-phosphor-green animate-ping" />
              <div className="flex items-center gap-2 opacity-60">
                <Radio size={14} />
                <h1 className="text-[10px] uppercase tracking-[0.4em] font-bold">Uplink.Online</h1>
              </div>
            </div>
            <div className="text-[10px] opacity-30 uppercase tracking-widest font-bold">
              Latency: 12ms
            </div>
          </div>
          
          <form onSubmit={handleSubmit} className="space-y-8">
            <div className="relative group">
              <div className="absolute -left-4 top-1/2 -translate-y-1/2 w-1 h-0 group-focus-within:h-8 bg-phosphor-green transition-all" />
              <input 
                type="text"
                autoFocus
                value={input}
                onChange={(e) => setInput(e.target.value)}
                className="w-full bg-transparent border-b border-phosphor-green/20 focus:border-phosphor-green/80 outline-none py-6 text-2xl uppercase tracking-[0.2em] transition-all placeholder:text-phosphor-green/10"
                placeholder="INPUT_SEQUENCE"
              />
              <div className="flex justify-between mt-2">
                <span className="text-[8px] opacity-40 uppercase tracking-widest">Protocol: Encrypted_Tunnel</span>
                <span className="text-[8px] opacity-40 uppercase tracking-widest">Buffer: Clear</span>
              </div>
            </div>
            
            <button 
              type="submit"
              className="w-full group relative overflow-hidden bg-phosphor-green/5 hover:bg-phosphor-green/10 border border-phosphor-green/20 text-phosphor-green py-4 rounded-md uppercase tracking-[0.5em] text-[11px] font-bold transition-all"
            >
              <span className="relative z-10">Transmit_Direct</span>
              <div className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-1000 bg-gradient-to-r from-transparent via-phosphor-green/10 to-transparent" />
            </button>
          </form>

          <div className="mt-12 flex flex-col items-center gap-4">
             <div className="w-full h-[1px] bg-white/5" />
             <button 
              onClick={() => setIsRemoteMode(false)}
              className="group flex items-center gap-2 text-[9px] uppercase tracking-widest text-white/30 hover:text-white/80 transition-all"
            >
              <Terminal size={12} className="group-hover:rotate-12 transition-transform" />
              Close_Remote_Session
            </button>
          </div>
        </motion.div>

        {/* Status Bar Footer */}
        <div className="fixed bottom-6 left-6 right-6 flex justify-between items-center opacity-20 text-[8px] uppercase tracking-[0.3em] font-bold">
          <span>Signal_Strength: 98%</span>
          <span>Core_Ready</span>
        </div>
      </div>
    );
  }

  return (
    <div 
      onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={handleDrop}
      className={`min-h-screen bg-[#050505] flex flex-col items-center justify-center p-0 md:p-2 font-mono selection:bg-[#00FF00] selection:text-black relative overflow-hidden transition-colors duration-500 ${isDragging ? 'ring-2 ring-[#00FF00] ring-inset' : ''}`}
    >
      {/* Subtle CRT Overlays */}
      <div className="fixed inset-0 pointer-events-none z-50 opacity-[0.03] bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] bg-[length:100%_4px,3px_100%]" />
      <div className="fixed inset-0 pointer-events-none z-40 bg-[radial-gradient(circle_at_50%_50%,rgba(0,255,0,0.02)_0%,transparent_80%)]" />

      {/* Auth UI */}
      <div className="fixed top-4 right-4 z-[60] flex items-center gap-4">
        {user && (
          <button 
            onClick={() => setIsRemoteMode(true)}
            className="flex items-center gap-2 text-[8px] uppercase tracking-widest text-[#00FF00]/40 hover:text-[#00FF00] transition-colors border border-[#00FF00]/10 px-2 py-1 rounded-sm"
          >
            <Radio size={10} />
            Remote_Uplink
          </button>
        )}
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
      </div>

      {/* Main Container */}
      <div className="relative group flex flex-col items-center gap-2 w-full h-screen max-w-[1200px]">
        {/* Character Box */}
        <div 
          className="relative group/box flex-1 w-full flex items-center justify-center"
        >
          {/* Decorative Border Glow */}
          <div 
            className="absolute -inset-2 blur-2xl opacity-10 group-hover/box:opacity-20 transition-all duration-1000"
            style={{ 
              backgroundColor: state.emotion_state === 'attack' ? '#FF3300' : 
                              state.color_mode === 'warm' ? '#FFCC00' :
                              state.emotion_state === 'alert' ? '#FFCC00' : 
                              state.emotion_state === 'curious' || state.emotion_state === 'sad' ? '#00FFFF' :
                              state.emotion_state === 'surprised' ? '#FF00FF' :
                              state.emotion_state === 'glitch' ? '#FFFFFF' :
                              '#00FF00' 
            }}
          />
          
          <div 
            ref={containerRef}
            className={`relative flex flex-col items-center bg-transparent md:bg-black/50 border border-white/5 rounded-sm px-1 py-2 backdrop-blur-sm shadow-2xl transition-all duration-300 overflow-hidden ${isFullscreen ? 'fixed inset-0 w-screen h-screen z-40' : 'w-full h-full'}`}
          >
            {/* Fullscreen Toggle Button */}
            <button 
              onClick={toggleFullscreen}
              className="absolute top-2 left-2 z-50 text-white/30 hover:text-white/80 transition-colors p-1"
              title="Toggle Protocol (Fullscreen)"
            >
              {isFullscreen ? <Minimize2 size={20} /> : <Maximize2 size={14} />}
            </button>

            <pre 
              className={`${themeClass} text-[3.8vh] md:text-[4vh] leading-[1.0] tracking-tighter whitespace-pre flex flex-col items-center justify-center select-none transition-all duration-200 overflow-hidden font-mono w-full h-full flex-1`}
            >
              {frame.split('\n').map((line, i) => (
                <div key={i} className="flex justify-center w-full">
                  <span className="w-full text-center block" style={{ transform: 'scale(1.0, 1.1)', transformOrigin: 'center' }}>{line}</span>
                </div>
              ))}
            </pre>
          </div>
        </div>

        {/* Floating Input Dock (Separated) */}
        {!isFullscreen && (
          <motion.div 
            animate={{ 
              y: [0, -4, 0],
            }}
            transition={{
              duration: 4,
              repeat: Infinity,
              ease: "easeInOut"
            }}
            className="w-[400px] flex items-center gap-4 bg-black/40 border border-white/5 rounded-full px-4 py-2 opacity-60 hover:opacity-100 focus-within:opacity-100 transition-all duration-300 backdrop-blur-md relative overflow-hidden"
          >
            {/* Subtle Phosphor Line Underneath */}
            <div 
              className="absolute bottom-0 left-1/2 -translate-x-1/2 w-1/2 h-[1px] opacity-20 blur-[1px] transition-colors duration-500"
              style={{ 
                backgroundColor: state.emotion_state === 'attack' ? '#FF3300' : 
                                state.color_mode === 'warm' ? '#FFCC00' :
                                state.emotion_state === 'curious' ? '#00FFFF' :
                                '#00FF00' 
              }}
            />

            <form onSubmit={handleSubmit} className="flex-1 flex items-center gap-2">
              <span className={`${themeClass} text-[10px] opacity-40 font-bold tracking-widest`}>&gt;</span>
              <input 
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                disabled={isAiLoading}
                className={`${themeClass} flex-1 bg-transparent border-none outline-none text-[11px] uppercase font-bold placeholder-[#ffffff11] tracking-widest ${isAiLoading ? 'opacity-20 animate-pulse' : ''}`}
                placeholder={isAiLoading ? "SYS_WAIT" : "GLITCH_CMD..."}
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
              className="text-white/10 hover:text-[#00FF00] transition-colors p-1"
              title="Upload data cluster (file)"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
              </svg>
            </button>
          </motion.div>
        )}
        
        {/* Fullscreen Input (Fixed overlay) */}
        {isFullscreen && (
          <motion.div 
            initial={{ y: 50, opacity: 0 }}
            animate={{ 
              y: [0, -6, 0],
              opacity: 1
            }}
            transition={{
              y: { duration: 5, repeat: Infinity, ease: "easeInOut" },
              opacity: { duration: 0.5 }
            }}
            className="fixed bottom-12 left-1/2 -translate-x-1/2 w-[90vw] max-w-[600px] flex items-center gap-4 bg-black/95 border border-white/20 rounded-md px-6 py-4 opacity-40 hover:opacity-100 focus-within:opacity-100 transition-all duration-500 z-50 backdrop-blur-2xl shadow-[0_0_40px_rgba(255,255,255,0.1)]"
          >
             <form onSubmit={handleSubmit} className="flex-1 flex items-center gap-3">
              <span className={`${themeClass} text-[14px] opacity-60 font-bold tracking-widest animate-pulse`}>CMD_</span>
              <input 
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                disabled={isAiLoading}
                className={`${themeClass} flex-1 bg-transparent border-none outline-none text-[18px] uppercase font-bold placeholder-[#ffffff22] tracking-widest ${isAiLoading ? 'opacity-20 animate-pulse' : ''}`}
                placeholder={isAiLoading ? "..." : "TYPE_COMMAND"}
                autoFocus
              />
            </form>
          </motion.div>
        )}
      </div>

      {/* Background Ambience */}
      <div className="fixed top-0 left-0 w-full p-4 flex justify-between items-center opacity-10 pointer-events-none text-red-500">
        <span className="text-[8px] uppercase tracking-tighter">GLITCH.CORE v0.9.1-ERR // SYSTEM_ANOMALY</span>
        <span className="text-[8px] uppercase tracking-tighter">Identity: GLITCH // Port 3000</span>
      </div>
    </div>
  );
}


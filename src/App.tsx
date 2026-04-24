/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { State, INITIAL_STATE } from './core/types';
import { renderFrame } from './core/renderer';
import { askDaemon } from './services/aiService';
import { auth, signIn, signOut } from './services/memoryService';
import { onAuthStateChanged, User } from 'firebase/auth';
import { Maximize2, Minimize2 } from 'lucide-react';
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
  }, []);

  const processDaemonResponse = (response: string) => {
    let cleanResponse = response;
    
    // Check for file generation tags: [FILE:name.ext]content[/FILE]
    const fileMatch = response.match(/\[FILE:\s*([^\]\s]+)\]([\s\S]*?)(?:\[\/FILE\]|$)/i);
    if (fileMatch) {
      const filename = fileMatch[1].trim();
      const content = fileMatch[2].trim();
      
      if (content.length > 0) {
        // Trigger download
        const blob = new Blob([content], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        // Add to log
        setGeneratedFiles(prev => [{name: filename, time: new Date().toLocaleTimeString()}, ...prev].slice(0, 5));
      }
      
      // Remove file block from speech
      cleanResponse = cleanResponse.replace(/\[FILE:\s*([^\]\s]+)\]([\s\S]*?)(?:\[\/FILE\]|$)/gi, '').trim();
    }

    // Check for morph tags: [FORM: morph_name]
    const morphMatch = response.match(/\[FORM:\s*([^\]]+)\]/i);
    if (morphMatch) {
      const morphName = morphMatch[1].trim().toLowerCase();
      // Valid morphs: blob, eye, hardware, ditto, spiky
      const validMorphs = ['blob', 'eye', 'hardware', 'ditto', 'spiky'];
      if (validMorphs.includes(morphName)) {
        socketRef.current?.emit('command', `morph ${morphName}`);
      }
      
      // Remove the form tag from the text and clean up whitespace
      cleanResponse = cleanResponse.replace(/\[FORM:\s*[^\]]+\]/gi, '').replace(/\s+/g, ' ').trim();
    }

    // Check for custom ASCII: [ASCII]...[/ASCII]
    const asciiMatch = response.match(/\[ASCII\]([\s\S]*?)\[\/ASCII\]/i);
    // We don't strip it here yet, because the server's speak command needs to see it.
    // However, for the local intent/speak flow, we might want to ensure the server gets the full payload.
    
    if (cleanResponse || asciiMatch) {
      // Send the UNMODIFIED response to the server so it can handle all tags
      socketRef.current?.emit('command', `speak ${response}`);
    }
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
    const cleanInput = input.trim().toLowerCase();
    if (!cleanInput || !socketRef.current || isAiLoading) return;

    resetIdleTimer();

    const systemCommands = ['calm', 'attack', 'alert', 'glitch', 'stream on', 'stream off', 'morph'];
    const isSystemCmd = systemCommands.some(cmd => cleanInput.startsWith(cmd));

    if (isSystemCmd) {
      socketRef.current.emit('command', cleanInput);
    } else {
      setIsAiLoading(true);
      const aiResponse = await askDaemon(cleanInput);
      setIsAiLoading(false);
      processDaemonResponse(aiResponse);
    }

    setInput('');
  };

  // ... (rest of theme and UI logic)

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

  // Input Shiver/Ghosting detection
  const materialistKeywords = ['soldi', 'luxury', 'money', 'comprare', 'profitto', 'brand', 'marketing', 'sucesso'];
  const isMaterialistInput = materialistKeywords.some(kw => input.toLowerCase().includes(kw));
  const isTupacInput = input.toLowerCase().includes('tupac');

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
              className={`${themeClass} text-[3.8vh] leading-[1.0] tracking-tighter whitespace-pre flex flex-col items-center justify-center select-none transition-all duration-200 overflow-hidden font-mono w-full flex-1`}
            >
              {frame.split('\n').map((line, i) => (
                <div key={i} className="flex justify-center w-full">
                  <span className="w-fit text-center block" style={{ transform: 'scale(1.2, 1.1)' }}>{line}</span>
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
            initial={{ y: 20, opacity: 0 }}
            animate={{ 
              y: [0, -6, 0],
              opacity: 1
            }}
            transition={{
              y: { duration: 5, repeat: Infinity, ease: "easeInOut" },
              opacity: { duration: 0.5 }
            }}
            className="fixed bottom-10 left-1/2 -translate-x-1/2 w-[500px] flex items-center gap-4 bg-black/80 border border-white/5 rounded-sm px-6 py-3 opacity-20 hover:opacity-100 focus-within:opacity-100 transition-all duration-500 z-50 backdrop-blur-xl"
          >
             <form onSubmit={handleSubmit} className="flex-1 flex items-center gap-2">
              <span className={`${themeClass} text-[12px] opacity-40 font-bold tracking-widest animate-pulse`}>CMD_</span>
              <input 
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                disabled={isAiLoading}
                className={`${themeClass} flex-1 bg-transparent border-none outline-none text-[14px] uppercase font-bold placeholder-[#ffffff11] tracking-widest ${isAiLoading ? 'opacity-20 animate-pulse' : ''}`}
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


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

import { imageToAscii } from './utils/imageUtils';

export default function App() {
  const [frame, setFrame] = useState('');
  const [state, setState] = useState<State>(INITIAL_STATE);
  const [input, setInput] = useState('');
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [generatedFiles, setGeneratedFiles] = useState<{name: string, time: string}[]>([]);
  const socketRef = useRef<Socket | null>(null);
  const idleTimerRef = useRef<NodeJS.Timeout | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const resetIdleTimer = () => {
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    const randomInterval = 120000 + Math.random() * 180000;
    
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

    if (isProcessing) return 'text-[#FFFFFF] brightness-200 drop-shadow-[0_0_15px_rgba(255,255,255,0.8)]';

    if (emotion_state === 'glitch') {
      const glitchColors = ['text-[#00FF00]', 'text-[#FF0000]', 'text-[#FFFFFF]', 'text-[#FFFF00]', 'text-[#00FFFF]', 'text-[#FF00FF]'];
      const speed = Math.max(1, Math.floor(10 - iScale * 8));
      const colorIdx = (animation_phase % speed === 0) 
        ? Math.floor(Math.random() * glitchColors.length)
        : Math.floor((animation_phase / 5) % glitchColors.length);
      return glitchColors[colorIdx];
    }

    if (emotion_state === 'attack') return 'text-[#FF3300] drop-shadow-[0_0_12px_rgba(255,51,0,0.6)]';
    
    // Kintsugi Color Shift
    if (color_mode === 'warm') return 'text-[#FFB347] drop-shadow-[0_0_12px_rgba(255,179,71,0.5)]'; // Amber/Warm

    if (emotion_state === 'alert' || iScale > 0.5) return 'text-[#FFCC00] drop-shadow-[0_0_8px_rgba(255,204,0,0.4)]';
    if (emotion_state === 'curious') return 'text-[#00FFFF] drop-shadow-[0_0_8px_rgba(0,255,255,0.4)]';
    if (emotion_state === 'surprised') return 'text-[#FF00FF] drop-shadow-[0_0_8px_rgba(255,0,255,0.4)]';
    
    return 'text-[#00FF00] drop-shadow-[0_0_8px_rgba(0,255,0,0.4)]';
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
      className={`min-h-screen bg-[#050505] flex flex-col items-center justify-center p-4 font-mono selection:bg-[#00FF00] selection:text-black relative overflow-hidden transition-colors duration-500 ${isDragging ? 'ring-2 ring-[#00FF00] ring-inset' : ''}`}
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
      <div className="relative group">
        {/* Decorative Border Glow */}
        <div 
          className="absolute -inset-1 blur-xl opacity-0 group-hover:opacity-100 transition-all duration-1000"
          style={{ 
            backgroundColor: state.emotion_state === 'attack' ? 'rgba(255,0,0,0.1)' : 
                            state.color_mode === 'warm' ? 'rgba(255,179,71,0.1)' :
                            state.emotion_state === 'alert' ? 'rgba(255,255,0,0.05)' : 
                            state.emotion_state === 'curious' ? 'rgba(0,255,255,0.05)' :
                            state.emotion_state === 'surprised' ? 'rgba(255,0,255,0.05)' :
                            'rgba(0,255,0,0.05)' 
          }}
        />
        
        <div 
          className="relative flex flex-col items-center bg-black/40 border border-white/5 rounded-sm p-8 backdrop-blur-sm shadow-2xl transition-transform duration-500"
          style={{ transform: `scale(${state.visual_scale})` }}
        >
          <pre 
            style={{ minHeight: '272px', height: 'auto' }}
            className={`${themeClass} text-sm md:text-base leading-[1.1] tracking-tight whitespace-pre flex flex-col items-center justify-center select-none transition-colors duration-200 overflow-hidden font-mono max-h-[400px]`}
          >
            {frame.split('\n').map((line, i) => (
              <div key={i} className="flex justify-center w-full">
                <span className="w-[40ch] text-left">{line}</span>
              </div>
            ))}
          </pre>

          {/* Terminal Input */}
          <div className="mt-8 w-full flex items-center gap-4 border-t border-white/20 pt-4 opacity-80 hover:opacity-100 focus-within:opacity-100 transition-all duration-300">
            <form onSubmit={handleSubmit} className="flex-1 flex items-center gap-2">
              <input 
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                disabled={isAiLoading}
                className={`${themeClass} flex-1 bg-transparent border-none outline-none text-[12px] uppercase font-bold placeholder-[#ffffff33] tracking-widest ${isAiLoading ? 'opacity-20 animate-pulse' : ''} ${isMaterialistInput ? 'animate-[bounce_0.5s_infinite]' : ''} ${isTupacInput ? 'blur-[0.5px] drop-shadow-[0_0_2px_rgba(255,255,255,0.5)]' : ''}`}
                placeholder={isAiLoading ? "PROCESSING_ERR..." : "SEND CMD TO GLITCH..."}
                autoFocus
              />
            </form>

            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileUpload}
              className="hidden"
            />
            
            <button 
              onClick={() => fileInputRef.current?.click()}
              disabled={isAiLoading}
              className="text-white/20 hover:text-[#00FF00] transition-colors p-1"
              title="Upload data cluster (file)"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
              </svg>
            </button>
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


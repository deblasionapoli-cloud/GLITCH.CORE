/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Terminal, Cpu, ShieldAlert, Zap, Radio, Smile } from 'lucide-react';
import { InputHandler } from './core/input_handler';
import { Scheduler } from './core/scheduler';

export default function App() {
  const [frame, setFrame] = useState('');
  const [input, setInput] = useState('');
  const [history, setHistory] = useState<string[]>([]);
  const inputHandlerRef = useRef<InputHandler>(new InputHandler());
  const schedulerRef = useRef<Scheduler | null>(null);
  const terminalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    schedulerRef.current = new Scheduler(inputHandlerRef.current, (newFrame) => {
      setFrame(newFrame);
    });
    schedulerRef.current.start();

    return () => schedulerRef.current?.stop();
  }, []);

  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [frame]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;

    inputHandlerRef.current.handleInput(input);
    setHistory(prev => [...prev, `> ${input}`].slice(-5));
    setInput('');
  };

  return (
    <div className="min-h-screen bg-[#050505] text-[#00FF00] font-mono p-4 md:p-8 flex flex-col items-center justify-center selection:bg-[#00FF00] selection:text-black">
      {/* Scanline Overlay */}
      <div className="fixed inset-0 pointer-events-none z-50 opacity-10 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] bg-[length:100%_4px,3px_100%]" />
      
      {/* Glow Effect */}
      <div className="fixed inset-0 pointer-events-none z-40 bg-[radial-gradient(circle_at_50%_50%,rgba(0,255,0,0.05)_0%,transparent_70%)]" />

      {/* Main Terminal Container */}
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-2xl bg-[#0a0a0a] border-2 border-[#1a1a1a] rounded-lg shadow-[0_0_20px_rgba(0,255,0,0.1)] overflow-hidden relative"
      >
        {/* Hardware Header */}
        <div className="bg-[#1a1a1a] p-3 border-bottom border-[#333] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Cpu className="w-4 h-4 text-[#00FF00] animate-pulse" />
            <span className="text-[10px] tracking-widest uppercase font-bold text-[#666]">
              Donkey Kong SSH Core v1.0.0 // RPI_DAEMON
            </span>
          </div>
          <div className="flex gap-1">
            <div className="w-2 h-2 rounded-full bg-red-500/50" />
            <div className="w-2 h-2 rounded-full bg-yellow-500/50" />
            <div className="w-2 h-2 rounded-full bg-green-500" />
          </div>
        </div>

        {/* Framebuffer Display */}
        <div 
          ref={terminalRef}
          className="p-6 min-h-[400px] flex flex-col items-center justify-center relative overflow-hidden"
        >
          <pre className="text-xl md:text-2xl leading-tight whitespace-pre bg-transparent border-none focus:outline-none text-center select-none">
            {frame}
          </pre>
        </div>

        {/* Command Input Area */}
        <div className="border-t-2 border-[#1a1a1a] p-4 bg-[#080808]">
          <div className="mb-4 space-y-1 opacity-40">
            {history.map((h, i) => (
              <div key={i} className="text-xs">{h}</div>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="flex items-center gap-3">
            <span className="text-[#00FF00] font-bold">ssh@dk_core:~$</span>
            <input 
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              className="flex-1 bg-transparent border-none outline-none text-[#00FF00] placeholder-[#004400]"
              placeholder="ENTER COMMAND..."
              autoFocus
            />
          </form>
        </div>

        {/* Status Bar */}
        <div className="bg-[#111] px-4 py-1 flex items-center justify-between text-[9px] uppercase tracking-tighter text-[#444]">
          <div className="flex gap-4">
            <span className="flex items-center gap-1"><Radio className="w-2 h-2" /> Link: Stable</span>
            <span className="flex items-center gap-1"><ShieldAlert className="w-2 h-2" /> Sec: ARM_V8</span>
          </div>
          <div className="flex gap-4">
             <span>MEM: 128MB / 4GB</span>
             <span className="text-green-500 animate-pulse">UPTIME: 100%</span>
          </div>
        </div>
      </motion.div>

      {/* Manual / Help */}
      <div className="mt-8 grid grid-cols-2 md:grid-cols-4 gap-4 text-[10px] text-[#333] uppercase">
          <div className="p-2 border border-[#111] rounded">
            <span className="text-[#666]">Emotion:</span> calm | alert | attack | glitch
          </div>
          <div className="p-2 border border-[#111] rounded">
            <span className="text-[#666]">Commands:</span> ping | speak &lt;txt&gt; | status
          </div>
          <div className="p-2 border border-[#111] rounded">
             <span className="text-[#666]">Interface:</span> stdin -&gt; queue -&gt; render
          </div>
          <div className="p-2 border border-[#111] rounded">
             <span className="text-[#666]">Arch:</span> deterministic deterministic
          </div>
      </div>
    </div>
  );
}


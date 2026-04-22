/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState, useRef } from 'react';
import { InputHandler } from './core/input_handler';
import { Scheduler } from './core/scheduler';

export default function App() {
  const [frame, setFrame] = useState('');
  const inputHandlerRef = useRef<InputHandler>(new InputHandler());
  const schedulerRef = useRef<Scheduler | null>(null);

  useEffect(() => {
    schedulerRef.current = new Scheduler(inputHandlerRef.current, (newFrame, _state) => {
      setFrame(newFrame);
    });
    schedulerRef.current.start();

    return () => schedulerRef.current?.stop();
  }, []);

  return (
    <div className="min-h-screen bg-[#050505] flex flex-col items-center justify-center p-4 font-mono selection:bg-[#00FF00] selection:text-black relative overflow-hidden">
      {/* Subtle CRT Overlays */}
      <div className="fixed inset-0 pointer-events-none z-50 opacity-[0.03] bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] bg-[length:100%_4px,3px_100%]" />
      <div className="fixed inset-0 pointer-events-none z-40 bg-[radial-gradient(circle_at_50%_50%,rgba(0,255,0,0.02)_0%,transparent_80%)]" />

      {/* Main Container */}
      <div className="relative group">
        {/* Decorative Border Glow */}
        <div className="absolute -inset-1 bg-[#00FF00]/10 blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-1000" />
        
        <div className="relative flex flex-col items-center bg-black/40 border border-white/5 rounded-sm p-8 backdrop-blur-sm shadow-2xl">
          <pre 
            style={{ width: '480px', height: '272px' }}
            className="text-[#00FF00] text-sm md:text-base leading-[1.1] tracking-tight whitespace-pre flex items-center justify-center text-center select-none drop-shadow-[0_0_8px_rgba(0,255,0,0.4)]"
          >
            {frame}
          </pre>
        </div>
      </div>

      {/* Background Ambience */}
      <div className="fixed top-0 left-0 w-full p-4 flex justify-between items-center opacity-10 pointer-events-none">
        <span className="text-[8px] uppercase tracking-tighter text-white/50">Deterministic Core v1.2</span>
        <span className="text-[8px] uppercase tracking-tighter text-white/50">Status: Active // Port 2222</span>
      </div>
    </div>
  );
}


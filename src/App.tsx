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
    schedulerRef.current = new Scheduler(inputHandlerRef.current, (newFrame) => {
      setFrame(newFrame);
    });
    schedulerRef.current.start();

    return () => schedulerRef.current?.stop();
  }, []);

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-4">
      <pre 
        style={{ width: '480px', height: '272px' }}
        className="bg-[#0a0a0a] text-[#00FF00] font-mono p-4 rounded border border-[#1a1a1a] overflow-hidden whitespace-pre flex items-center justify-center text-center"
      >
        {frame}
      </pre>
    </div>
  );
}


import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { updateState } from './src/core/state_engine';
import { INITIAL_STATE, State } from './src/core/types';

async function startServer() {
  const app = express();
  const httpServer = createServer(app);
  const io = new Server(httpServer, {
    cors: {
      origin: "*",
    }
  });

  const PORT = 3000;

  // Daemon Global State
  let globalState: State = { ...INITIAL_STATE };
  
  // Tick logic on server (Daemon heartbeat)
  setInterval(() => {
    globalState = updateState(globalState, []); // Just tick animation
    io.emit('state_update', globalState);
  }, 100);

  io.on('connection', (socket) => {
    console.log('User connected to Daemon:', socket.id);
    
    // Send initial state
    socket.emit('state_update', globalState);

    socket.on('command', (payload: string) => {
      console.log(`Received command from ${socket.id}: ${payload}`);
      
      // Update global state with the command event
      const event = {
        type: 'command' as const,
        payload,
        timestamp: Date.now()
      };
      
      globalState = updateState(globalState, [event]);
      io.emit('state_update', globalState);
      
      // Notify acknowledgement
      socket.emit('command_ack', { status: 'success', cmd: payload });
    });

    socket.on('disconnect', () => {
      console.log('User disconnected:', socket.id);
    });
  });

  // Vite integration
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`Daemon server active at http://0.0.0.0:${PORT}`);
  });
}

startServer();

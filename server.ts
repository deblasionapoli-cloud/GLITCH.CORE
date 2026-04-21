import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import fs from "fs";

async function startServer() {
  const app = express();
  const PORT = 3000;
  const LOG_FILE = "/root/apex_system.log";

  app.use(express.json());

  // Rotta API per il logging
  app.post("/api/log", (req, res) => {
    const { message, type } = req.body;
    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] [${type || 'INFO'}] ${message}\n`;
    
    fs.appendFileSync(LOG_FILE, logEntry);
    console.log(logEntry.trim());
    res.json({ status: "logged" });
  });

  // Rotta per recuperare i log
  app.get("/api/logs", (req, res) => {
    if (fs.existsSync(LOG_FILE)) {
      res.sendFile(LOG_FILE);
    } else {
      res.send("No logs yet.");
    }
  });

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`SERVER APEX ATTIVO SU PORTA ${PORT}`);
    fs.appendFileSync(LOG_FILE, `--- APEX REBOOT [${new Date().toISOString()}] ---\n`);
  });
}

startServer();

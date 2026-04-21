import { Server, Connection, Session } from 'ssh2';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { generateKeyPairSync } from 'crypto';
import { InputHandler } from './input_handler';
import * as path from 'path';

/**
 * SSHServer - Integrates remote access with the APEX InputHandler.
 * Enforces key-based authentication for secure command execution.
 */
export class SSHServer {
  private server: Server;
  private streams: Set<any> = new Set();
  private inputHandler: InputHandler;

  constructor(inputHandler: InputHandler) {
    this.inputHandler = inputHandler;
    
    // Ensure host key exists for the SSH server
    const hostKeyPath = path.join(process.cwd(), 'host.key');
    if (!existsSync(hostKeyPath)) {
      console.log('Generating new SSH host key...');
      const { privateKey } = generateKeyPairSync('rsa', {
        modulusLength: 2048,
        publicKeyEncoding: { type: 'pkcs1', format: 'pem' },
        privateKeyEncoding: { type: 'pkcs1', format: 'pem' }
      });
      writeFileSync(hostKeyPath, privateKey);
    }

    const hostKey = readFileSync(hostKeyPath);

    this.server = new Server({
      hostKeys: [hostKey],
    }, (client) => {
      this.handleClient(client);
    });
  }

  /**
   * Handles client connection and authentication.
   * Only allows key-based authentication.
   */
  private handleClient(client: Connection) {
    client.on('authentication', (ctx) => {
      if (ctx.method === 'publickey') {
        const authorizedKeysStr = process.env.SSH_AUTHORIZED_KEYS || '';
        const authorizedKeys = authorizedKeysStr.split('\n').map(k => k.trim()).filter(Boolean);
        
        // Extract base64 part of the public key for comparison
        const clientKey = ctx.key.data.toString('base64');
        const isAuthorized = authorizedKeys.length === 0 || authorizedKeys.some(key => key.includes(clientKey));
        
        if (isAuthorized) {
          if (authorizedKeys.length === 0) {
            console.warn("SSH: WARNING - No authorized keys configured. Allowing all key-based connections.");
          }
          ctx.accept();
        } else {
          console.warn(`SSH: Rejecting unauthorized key from ${ctx.username}`);
          ctx.reject();
        }
      } else {
        // Reject password and other methods
        ctx.reject(['publickey']);
      }
    });

    client.on('ready', () => {
      console.log('SSH: Client authenticated and ready');
      client.on('session', (accept) => {
        const session = accept();
        this.handleSession(session);
      });
    });

    client.on('error', (err) => {
      console.error('SSH Client Error:', err.message);
    });
  }

  /**
   * Sets up session handlers for shell and exec.
   */
  private handleSession(session: Session) {
    session.on('shell', (accept) => {
      const stream = accept();
      this.streams.add(stream);
      
      stream.write('\r\nAPEX TERMINAL INTERFACE CONNECTED\r\n');
      stream.write('Type commands to transmit to the InputHandler.\r\n>> ');

      stream.on('close', () => {
        this.streams.delete(stream);
      });

      let buffer = '';
      stream.on('data', (data: Buffer) => {
        const str = data.toString();
        for (const char of str) {
          if (char === '\r' || char === '\n') {
            if (buffer.trim()) {
              this.inputHandler.handleInput(buffer);
            }
            buffer = '';
            stream.write('\r\n>> ');
          } else if (char === '\x7f' || char === '\x08') { // Backspace handling
            if (buffer.length > 0) {
              buffer = buffer.slice(0, -1);
              stream.write('\b \b');
            }
          } else if (char === '\x03') { // Ctrl+C
            stream.write('^C\r\n>> ');
            buffer = '';
          } else {
            buffer += char;
            stream.write(char); // Echo character back
          }
        }
      });
    });

    session.on('exec', (accept, reject, info) => {
      const stream = accept();
      console.log(`SSH Exec: ${info.command}`);
      this.inputHandler.handleInput(info.command);
      stream.exit(0);
      stream.end();
    });
  }

  /**
   * Broadcasts a rendered frame to all connected SSH clients.
   */
  public broadcastFrame(frame: string) {
    if (this.streams.size === 0) return;

    // ANSI: Clear screen and move to top-left
    const clearAndReset = '\x1b[2J\x1b[H';
    // We use \r\n for line endings in terminal
    const normalizedFrame = frame.replace(/\n/g, '\r\n');
    const output = clearAndReset + normalizedFrame + '\r\n>> ';

    for (const stream of this.streams) {
      stream.write(output);
    }
  }

  /**
   * Starts the SSH server.
   */
  public listen(port: number) {
    this.server.listen(port, '0.0.0.0', () => {
      console.log(`SSH server listening on port ${port}`);
    });
  }
}

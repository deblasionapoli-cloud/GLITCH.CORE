/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Server, Session } from 'ssh2';
import { generateKeyPairSync } from 'node:crypto';
import { renderFrame } from '../core/renderer';
import { INITIAL_STATE, State } from '../core/types';

export interface SshServerOptions {
  port: number;
  onCommand: (cmd: string) => void;
  getGlobalState: () => State;
}

export function startSshServer(options: SshServerOptions) {
  const { port, onCommand, getGlobalState } = options;

  // Generate a temporary host key for the session
  const { privateKey } = generateKeyPairSync('rsa' as any, {
    modulusLength: 2048,
    privateKeyEncoding: {
      type: 'pkcs1',
      format: 'pem'
    }
  }) as any;

  const server = new Server({
    hostKeys: [privateKey]
  }, (client) => {
    console.log('SSH: Client connected');

    client.on('authentication', (ctx: any) => {
      // Allow any authentication for this prototype
      ctx.accept();
    });

    client.on('ready', () => {
      console.log('SSH: Client authenticated');

      client.on('session', (accept, reject) => {
        const session = accept();

        session.on('pty', (accept, reject, info) => {
          accept && accept();
        });

        session.on('shell', (accept, reject) => {
          const stream = accept();
          
          stream.write('\r\n*** DAEMON SSH CORE v1.0 ***\r\n');
          stream.write('Handshake complete. You are now connected to the pit.\r\n');
          stream.write('Type commands to interact with the Daemon.\r\n\r\n');
          stream.write('> ');

          let buffer = '';
          stream.on('data', (data: Buffer) => {
            const str = data.toString();
            
            // Basic handling of enter and backspace
            for (let i = 0; i < str.length; i++) {
              const char = str[i];
              if (char === '\r' || char === '\n') {
                const cmd = buffer.trim();
                if (cmd) {
                  onCommand(cmd);
                  stream.write(`\r\n[ACK] Command sent to core: "${cmd}"\r\n`);
                }
                buffer = '';
                stream.write('\r\n> ');
              } else if (char === '\u007f') { // Backspace
                if (buffer.length > 0) {
                  buffer = buffer.slice(0, -1);
                  stream.write('\b \b');
                }
              } else {
                buffer += char;
                stream.write(char);
              }
            }
          });
        });

        session.on('exec', (accept, reject, info) => {
          const stream = accept();
          const cmd = info.command;
          console.log(`SSH EXEC: ${cmd}`);
          
          onCommand(cmd);
          stream.write(`Daemon received: ${cmd}\n`);
          
          // Optionally return the current state frame as output
          const frame = renderFrame(getGlobalState());
          stream.write('\nCURRENT CORE SNAPSHOT:\n');
          stream.write(frame);
          stream.write('\n');
          
          stream.exit(0);
          stream.end();
        });
      });
    });

    client.on('end', () => {
      console.log('SSH: Client disconnected');
    });
  });

  server.listen(port, '0.0.0.0', () => {
    console.log(`SSH: Daemon core listening on port ${port}`);
  });

  return server;
}

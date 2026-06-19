import http from 'http';
import { WebSocketServer } from 'ws';
import { setupWSConnection, setPersistence } from 'y-websocket/bin/utils';
import { LeveldbPersistence } from 'y-leveldb';
import * as Y from 'yjs';
import dotenv from 'dotenv';

dotenv.config();

const port = process.env.PORT || 1234;

// Initialize LevelDB persistence
const persistenceDir = './yjs-storage';
const ldb = new LeveldbPersistence(persistenceDir);

setPersistence({
  provider: ldb,
  bindState: async (docName: string, ydoc: Y.Doc) => {
    const persistedYdoc = await ldb.getYDoc(docName);
    const newUpdates = Y.encodeStateAsUpdate(ydoc);
    await ldb.storeUpdate(docName, newUpdates);
    Y.applyUpdate(ydoc, Y.encodeStateAsUpdate(persistedYdoc));
    ydoc.on('update', async (update: Uint8Array) => {
      await ldb.storeUpdate(docName, update);
    });
  },
  writeState: async (docName: string, ydoc: Y.Doc) => {
    // Optional final write hook
  }
});

// Create HTTP server
const server = http.createServer((req, res) => {
  // CORS configuration
  const clientOrigin = process.env.CLIENT_ORIGIN || '*';
  res.setHeader('Access-Control-Allow-Origin', clientOrigin);
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // Health check endpoint
  if (req.url === '/health' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', port }));
    return;
  }

  // Execute code endpoint
  if (req.url === '/execute' && req.method === 'POST') {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
    });
    req.on('end', async () => {
      try {
        console.log('Received execute body:', body);
        const payload = JSON.parse(body);
        const { language, code, stdin } = payload;

        // Validation
        if (!language || typeof code !== 'string') {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Missing language or code' }));
          return;
        }

        // Language map: maps CodeSync languages to Piston runner details
        const languageMap: Record<string, { language: string; version: string; filename: string }> = {
          javascript: { language: 'node', version: '20.11.1', filename: 'index.js' },
          python: { language: 'python', version: '3.12.0', filename: 'main.py' },
          cpp: { language: 'c++', version: '10.2.0', filename: 'main.cpp' },
        };

        const mapped = languageMap[language];
        if (!mapped) {
          // Graceful fallback for unmapped languages
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            stdout: '',
            stderr: 'This language cannot be executed.',
            code: null,
            signal: null
          }));
          return;
        }

        const pistonUrl = process.env.PISTON_URL || 'http://localhost:2000';
        const pistonPayload = {
          language: mapped.language,
          version: mapped.version,
          files: [
            {
              name: mapped.filename,
              content: code
            }
          ],
          stdin: stdin || '',
          run_timeout: 5000,
          compile_timeout: 10000,
          run_memory_limit: 268435456, // 256MB in bytes
          compile_memory_limit: 268435456 // 256MB in bytes
        };

        const response = await fetch(`${pistonUrl}/api/v2/execute`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(pistonPayload)
        });

        if (!response.ok) {
          const errText = await response.text();
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: `Piston execution failed: ${errText}` }));
          return;
        }

        const pistonResult = await response.json() as any;

        // Combine Piston's compile and run stage outputs
        let stdout = '';
        let stderr = '';
        let exitCode: number | null = null;
        let signal: string | null = null;

        if (pistonResult.compile) {
          if (pistonResult.compile.code !== 0) {
            // Compilation error occurred
            stdout = pistonResult.compile.stdout || '';
            stderr = pistonResult.compile.stderr || '';
            exitCode = pistonResult.compile.code;
            signal = pistonResult.compile.signal;
          } else {
            // Compile succeeded, execute code output
            stdout = pistonResult.run.stdout || '';
            stderr = (pistonResult.compile.stderr ? pistonResult.compile.stderr + '\n' : '') + (pistonResult.run.stderr || '');
            exitCode = pistonResult.run.code;
            signal = pistonResult.run.signal;
          }
        } else if (pistonResult.run) {
          stdout = pistonResult.run.stdout || '';
          stderr = pistonResult.run.stderr || '';
          exitCode = pistonResult.run.code;
          signal = pistonResult.run.signal;
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          stdout,
          stderr,
          code: exitCode,
          signal
        }));

      } catch (err: any) {
        console.error('Execute error:', err);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message || 'Internal Server Error' }));
      }
    });
    return;
  }

  // Fallback 404
  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('Not Found');
});

// Create WebSocket server
const wss = new WebSocketServer({ noServer: true });

wss.on('connection', (ws, req) => {
  setupWSConnection(ws, req);
});

// Upgrade HTTP connection to WebSocket
server.on('upgrade', (request, socket, head) => {
  wss.handleUpgrade(request, socket, head, (ws) => {
    wss.emit('connection', ws, request);
  });
});

server.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});

import http from 'http';
import { WebSocketServer } from 'ws';
import { setupWSConnection, setPersistence } from 'y-websocket/bin/utils';
import { LeveldbPersistence } from 'y-leveldb';
import * as Y from 'yjs';
import Anthropic from '@anthropic-ai/sdk';
import dotenv from 'dotenv';

dotenv.config();

const port = process.env.PORT || 1234;
const anthropicKey = process.env.ANTHROPIC_API_KEY;

// Initialize Anthropic client
const anthropic = anthropicKey ? new Anthropic({ apiKey: anthropicKey }) : null;

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
  // Add CORS headers for simplicity
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // HTTP /suggest endpoint for ghost-text completions
  if (req.url === '/suggest' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
    });
    req.on('end', async () => {
      try {
        const { codeBefore, codeAfter, language } = JSON.parse(body);

        if (!codeBefore && !codeAfter) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Missing code context' }));
          return;
        }

        if (!anthropic) {
          console.warn('Anthropic API key is not configured. Returning mock suggestion.');
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ suggestion: '\n// Anthropic API key not configured\n' }));
          return;
        }

        // Call Anthropic Messages API
        const response = await anthropic.messages.create({
          model: 'claude-3-5-sonnet-20241022',
          max_tokens: 100,
          temperature: 0,
          system: 'You are an expert developer coding assistant. Generate a high-quality inline code completion (ghost text) based on the provided code context. Do NOT repeat the existing code. Return ONLY the code snippet to be inserted directly between the "Code Before" and "Code After" markers. Do NOT include markdown code blocks or explanations.',
          messages: [
            {
              role: 'user',
              content: `Language: ${language || 'javascript'}

--- Code Before Cursor ---
${codeBefore}

--- Code After Cursor ---
${codeAfter}`
            }
          ]
        });

        const text = response.content[0].type === 'text' ? response.content[0].text : '';
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ suggestion: text }));
      } catch (err: any) {
        console.error('Error in /suggest endpoint:', err);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message || 'Internal server error' }));
      }
    });
    return;
  }

  // Health check endpoint
  if (req.url === '/health' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', port }));
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

// dev-server.js — Run this for local development instead of vercel dev
// Usage: node dev-server.js

import { createServer } from 'http';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Load .env.local
try {
  const envFile = readFileSync(resolve(__dirname, '.env.local'), 'utf-8');
  for (const line of envFile.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq > 0) {
      const key = trimmed.slice(0, eq).trim();
      const val = trimmed.slice(eq + 1).trim();
      process.env[key] = val;
    }
  }
  console.log('✓ Loaded .env.local');
} catch (_) {
  console.log('⚠ No .env.local found — make sure NEWSAPI_KEY is set');
}

// Import the API handler
const handlerModule = await import('./api/news.js');
const handler = handlerModule.default;

const server = createServer(async (req, res) => {
  if (req.url === '/api/news') {
    // Create mock req/res objects compatible with Vercel handler
    const mockRes = {
      statusCode: 200,
      headers: {},
      body: null,
      status(code) { this.statusCode = code; return this; },
      setHeader(key, val) { this.headers[key] = val; return this; },
      json(data) {
        this.body = JSON.stringify(data);
        res.writeHead(this.statusCode, {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          ...this.headers
        });
        res.end(this.body);
      }
    };

    // Parse body for POST
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
      try {
        req.body = body ? JSON.parse(body) : {};
      } catch (_) {
        req.body = {};
      }
      try {
        await handler(req, mockRes);
      } catch (err) {
        console.error('Handler error:', err);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
  } else {
    // Redirect everything else to Vite
    res.writeHead(302, { Location: 'http://localhost:5173' + req.url });
    res.end();
  }
});

server.listen(3001, () => {
  console.log('');
  console.log('  ✓ API server running at http://localhost:3001/api/news');
  console.log('');
  console.log('  Now in another terminal, run:  npm run dev');
  console.log('  Then open:  http://localhost:5173');
  console.log('');
});

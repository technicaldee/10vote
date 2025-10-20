import 'dotenv/config';
import { WebSocketServer } from 'ws';
import http from 'http';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { SelfBackendVerifier, AllIds, DefaultConfigStore } from '@selfxyz/core';

const PORT = Number(process.env.WS_PORT || process.env.PORT || 8080);

const server = http.createServer();

// Serve built static files (SPA) from the Vite build output
const DIST_DIR = path.resolve(process.cwd(), 'build');
const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.webmanifest': 'application/manifest+json',
};

// Initialize SelfBackendVerifier (single instance)
const SELF_SCOPE = process.env.SELF_SCOPE || 'self-playground';
const SELF_ENDPOINT = process.env.SELF_VERIFY_ENDPOINT || 'https://playground.self.xyz/api/verify';
const SELF_MOCK = String(process.env.SELF_MOCK_PASSPORT || 'false').toLowerCase() === 'true';
const SELF_USER_ID_TYPE = process.env.SELF_USER_IDENTIFIER_TYPE || 'uuid';
const selfBackendVerifier = new SelfBackendVerifier(
  SELF_SCOPE,
  SELF_ENDPOINT,
  SELF_MOCK,
  AllIds,
  new DefaultConfigStore({
    minimumAge: 18,
    excludedCountries: ['IRN', 'PRK', 'RUS', 'SYR'],
    ofac: true,
  }),
  SELF_USER_ID_TYPE
);

server.on('request', async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const pathname = url.pathname;

    // Self verification endpoint
    if (pathname === '/api/self/verify' && req.method === 'POST') {
      let body = '';
      req.on('data', (chunk) => { body += chunk; });
      req.on('end', async () => {
        try {
          const { attestationId, proof, publicSignals, userContextData } = JSON.parse(body || '{}');
          if (!proof || !publicSignals || !attestationId || !userContextData) {
            res.statusCode = 400;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ message: 'Proof, publicSignals, attestationId and userContextData are required' }));
            return;
          }
          const result = await selfBackendVerifier.verify(attestationId, proof, publicSignals, userContextData);
          const isValid = !!result?.isValidDetails?.isValid;
          res.statusCode = 200;
          res.setHeader('Content-Type', 'application/json');
          res.setHeader('Access-Control-Allow-Origin', '*');
          res.end(JSON.stringify({ status: isValid ? 'success' : 'failed', result: isValid, details: result?.isValidDetails || null }));
        } catch (e) {
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          res.setHeader('Access-Control-Allow-Origin', '*');
          res.end(JSON.stringify({ error: 'Verification error', message: e?.message || String(e) }));
        }
      });
      return;
    }

    // Celo tx proxy to avoid CORS in browser
    if (pathname === '/api/celo/txlist' && req.method === 'GET') {
      const address = url.searchParams.get('address');
      const sort = url.searchParams.get('sort') || 'desc';
      const upstream = process.env.BLOCKSCOUT_API_URL || 'https://explorer.celo.org/mainnet/api';
      if (!address) {
        res.statusCode = 400;
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.end(JSON.stringify({ error: 'address_required' }));
        return;
      }
      const target = `${upstream}?module=account&action=txlist&address=${address}&sort=${sort}`;
      try {
        const r = await fetch(target);
        const json = await r.json();
        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.end(JSON.stringify(json));
      } catch (e) {
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.end(JSON.stringify({ error: 'upstream_error', message: e?.message || String(e) }));
      }
      return;
    }

    // Avoid interfering with WebSocket path; return 404 for normal HTTP on /ws
    if (pathname === '/ws') {
      res.statusCode = 404;
      res.end('WebSocket endpoint');
      return;
    }

    let filePath = path.join(DIST_DIR, pathname.replace(/^\/+/, ''));
    if (pathname.endsWith('/')) filePath = path.join(DIST_DIR, pathname.replace(/^\/+/, ''), 'index.html');

    if (!fs.existsSync(filePath)) {
      // Single Page App fallback
      filePath = path.join(DIST_DIR, 'index.html');
    }

    const ext = path.extname(filePath).toLowerCase();
    const mime = mimeTypes[ext] || 'application/octet-stream';
    res.setHeader('Content-Type', mime);

    const stream = fs.createReadStream(filePath);
    stream.on('error', () => {
      res.statusCode = 500;
      res.end('Server error');
    });
    stream.pipe(res);
  } catch (e) {
    res.statusCode = 500;
    res.end('Server error');
  }
});

const wss = new WebSocketServer({ server, path: '/ws' });

const rooms = new Map(); // roomId -> Set<ws>
const queueByCategory = new Map(); // category -> Array<ws>
const clients = new Set(); // track connected clients
let nextId = 1;

function printStatus() {
  const cats = Array.from(queueByCategory.keys());
  const catSummaries = cats.map((c) => `${c}:${(queueByCategory.get(c) || []).length}`).join(' ');
  console.log(`[WS] Clients:${clients.size} Queues{ ${catSummaries || 'none'} } Rooms:${rooms.size}`);
}

function joinRoom(ws, roomId) {
  if (!rooms.has(roomId)) rooms.set(roomId, new Set());
  rooms.get(roomId).add(ws);
  ws.roomId = roomId;
}

function leaveRoom(ws) {
  const roomId = ws.roomId;
  if (!roomId) return;
  const set = rooms.get(roomId);
  if (set) {
    set.delete(ws);
    if (set.size === 0) rooms.delete(roomId);
  }
}

wss.on('connection', (ws, req) => {
  ws.id = `c${nextId++}`;
  clients.add(ws);
  const ip = (req?.headers['x-forwarded-for'] || req?.socket?.remoteAddress || 'unknown');
  console.log(`[WS] Connected ${ws.id} from ${ip}. Total clients: ${clients.size}`);
  printStatus();
  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message.toString());
      if (data.type === 'join' && data.roomId) {
        joinRoom(ws, data.roomId);
        ws.send(JSON.stringify({ type: 'joined', roomId: data.roomId, clientId: ws.id }));
      } else if (data.type === 'broadcast' && ws.roomId) {
        const payload = { type: 'event', roomId: ws.roomId, senderId: ws.id, event: data.event, ts: Date.now() };
        const set = rooms.get(ws.roomId) || new Set();
        for (const client of set) {
          if (client.readyState === 1) client.send(JSON.stringify(payload));
        }
      } else if (data.type === 'queue' && data.category && typeof data.stake === 'number') {
        const cat = String(data.category);
        const stake = Number(data.stake);
        const list = queueByCategory.get(cat) || [];
        const other = list.find((c) => c !== ws && c.readyState === 1);
        if (other) {
          const remaining = list.filter((c) => c !== other);
          if (remaining.length) queueByCategory.set(cat, remaining); else queueByCategory.delete(cat);
          const duelId = '0x' + crypto.randomBytes(32).toString('hex');
          const creatorMsg = { type: 'match_found', role: 'creator', category: cat, stake, duelId };
          const joinerMsg = { type: 'match_found', role: 'joiner', category: cat, stake, duelId };
          console.log(`[WS] Pairing ${ws.id} (creator) with ${other.id} (joiner) in category '${cat}' duelId=${duelId}`);
          try { ws.send(JSON.stringify(creatorMsg)); } catch {}
          try { other.send(JSON.stringify(joinerMsg)); } catch {}
          printStatus();
        } else {
          list.push(ws);
          queueByCategory.set(cat, list);
          ws.queueCategory = cat;
          console.log(`[WS] Queued ${ws.id} in category '${cat}'. Queue size: ${list.length}`);
          try { ws.send(JSON.stringify({ type: 'queued', category: cat })); } catch {}
          printStatus();
        }
      } else if (data.type === 'leave_queue') {
        const cat = ws.queueCategory;
        if (cat) {
          const list = queueByCategory.get(cat) || [];
          const remaining = list.filter((c) => c !== ws);
          if (remaining.length) queueByCategory.set(cat, remaining); else queueByCategory.delete(cat);
          ws.queueCategory = undefined;
          console.log(`[WS] ${ws.id} left queue '${cat}'. New size: ${remaining.length}`);
          try { ws.send(JSON.stringify({ type: 'left_queue', category: cat })); } catch {}
          printStatus();
        }
      } else if (data.type === 'status') {
        const { phase, duelId, extra } = data;
        console.log(`[WS] status ${ws.id}: ${phase} duelId=${duelId || ''} ${extra ? JSON.stringify(extra) : ''}`);
      }
    } catch (e) {
      ws.send(JSON.stringify({ type: 'error', message: 'Invalid message format' }));
    }
  });
  ws.on('close', () => {
    const cat = ws.queueCategory;
    if (cat) {
      const list = queueByCategory.get(cat) || [];
      const remaining = list.filter((c) => c !== ws);
      if (remaining.length) queueByCategory.set(cat, remaining); else queueByCategory.delete(cat);
      ws.queueCategory = undefined;
    }
    leaveRoom(ws);
    clients.delete(ws);
    console.log(`[WS] Disconnected ${ws.id}. Total clients: ${clients.size}`);
    printStatus();
  });
  ws.on('error', (err) => {
    console.log(`[WS] Client ${ws.id} error:`, err?.message || String(err));
  });
});

server.listen(PORT, () => {
  console.log(`WS server listening on port ${PORT}`);
});
import 'dotenv/config';
import { WebSocketServer } from 'ws';
import http from 'http';
import crypto from 'crypto';

const PORT = process.env.WS_PORT ? Number(process.env.WS_PORT) : 8080;

const server = http.createServer();
const wss = new WebSocketServer({ server });

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
  // assign id and register client
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
        ws.send(JSON.stringify({ type: 'joined', roomId: data.roomId }));
      } else if (data.type === 'broadcast' && ws.roomId) {
        const payload = { type: 'event', roomId: ws.roomId, event: data.event, ts: Date.now() };
        const set = rooms.get(ws.roomId) || new Set();
        for (const client of set) {
          if (client.readyState === 1) client.send(JSON.stringify(payload));
        }
      } else if (data.type === 'queue' && data.category && typeof data.stake === 'number') {
        const cat = String(data.category);
        const stake = Number(data.stake);
        const list = queueByCategory.get(cat) || [];
        // Try to pair with someone else already waiting
        const other = list.find((c) => c !== ws && c.readyState === 1);
        if (other) {
          // Remove 'other' from queue
          const remaining = list.filter((c) => c !== other);
          if (remaining.length) queueByCategory.set(cat, remaining); else queueByCategory.delete(cat);
          // Generate a duelId and notify both
          const duelId = '0x' + crypto.randomBytes(32).toString('hex');
          const creatorMsg = { type: 'match_found', role: 'creator', category: cat, stake, duelId };
          const joinerMsg = { type: 'match_found', role: 'joiner', category: cat, stake, duelId };
          console.log(`[WS] Pairing ${ws.id} (creator) with ${other.id} (joiner) in category '${cat}' duelId=${duelId}`);
          try { ws.send(JSON.stringify(creatorMsg)); } catch {}
          try { other.send(JSON.stringify(joinerMsg)); } catch {}
          printStatus();
        } else {
          // Enqueue and ack
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
    // remove from queue if present
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
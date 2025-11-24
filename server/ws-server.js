import 'dotenv/config';
import { WebSocketServer } from 'ws';
import http from 'http';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import Redis from 'ioredis';
import { ethers } from 'ethers';
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

// On-chain registration helper (optional - only if contract and private key are set)
let onChainRegistrar = null;
if (process.env.DUEL_CONTRACT_ADDRESS && process.env.PRIVATE_KEY && process.env.CELO_RPC_URL) {
  try {
    const provider = new ethers.JsonRpcProvider(process.env.CELO_RPC_URL || 'https://forno.celo.org');
    const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
    const abi = ['function registerVerifiedPlayer(address player) external'];
    onChainRegistrar = new ethers.Contract(process.env.DUEL_CONTRACT_ADDRESS, abi, wallet);
    console.log('[Self] On-chain registration enabled');
  } catch (e) {
    console.warn('[Self] On-chain registration disabled:', e.message);
  }
}

async function registerPlayerOnChain(address) {
  if (!onChainRegistrar) return;
  try {
    const tx = await onChainRegistrar.registerVerifiedPlayer(address);
    console.log(`[Self] Registering ${address} on-chain: ${tx.hash}`);
    // Don't wait - fire and forget
    tx.wait().catch(err => console.error('[Self] Registration tx failed:', err.message));
  } catch (e) {
    console.error('[Self] Registration failed:', e.message);
  }
}

server.on('request', async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const pathname = url.pathname;

    // Add CORS headers for all requests
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    // Handle preflight requests
    if (req.method === 'OPTIONS') {
      res.statusCode = 200;
      res.end();
      return;
    }

    // Self verification endpoint - also registers on-chain if valid
    if (pathname === '/api/self/verify' && req.method === 'POST') {
      let body = '';
      req.on('data', (chunk) => { body += chunk; });
      req.on('end', async () => {
        try {
          const { attestationId, proof, publicSignals, userContextData, address } = JSON.parse(body || '{}');
          if (!proof || !publicSignals || !attestationId || !userContextData) {
            res.statusCode = 400;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ message: 'Proof, publicSignals, attestationId and userContextData are required' }));
            return;
          }
          const result = await selfBackendVerifier.verify(attestationId, proof, publicSignals, userContextData);
          const isValid = !!result?.isValidDetails?.isValid;
          
          // If valid and address provided, register on-chain (async, don't wait)
          if (isValid && address && process.env.DUEL_CONTRACT_ADDRESS && process.env.PRIVATE_KEY) {
            registerPlayerOnChain(address).catch(err => {
              console.error('[Self] Failed to register player on-chain:', err.message);
            });
          }
          
          res.statusCode = 200;
          res.setHeader('Content-Type', 'application/json');
          res.setHeader('Access-Control-Allow-Origin', '*');
          res.end(JSON.stringify({ 
            status: isValid ? 'success' : 'failed', 
            result: isValid, 
            details: result?.isValidDetails || null,
            registered: isValid && address ? 'pending' : null
          }));
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

    // Health check endpoint
    if (pathname === '/health') {
      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({
        status: 'ok',
        redis: useRedis ? 'connected' : 'disconnected',
        timestamp: Date.now(),
        uptime: process.uptime()
      }));
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

const wss = new WebSocketServer({
  server,
  path: '/ws',
  // Handle CORS for WebSocket connections
  verifyClient: (info) => {
    // Allow all origins for now - in production you might want to restrict this
    return true;
  },
  // Increase max payload size if needed (default is 64KB)
  maxPayload: 1024 * 1024, // 1MB
  // Enable perMessageDeflate for better performance
  perMessageDeflate: {
    zlibDeflateOptions: {
      chunkSize: 1024,
      memLevel: 7,
      level: 3
    },
    zlibInflateOptions: {
      chunkSize: 10 * 1024
    },
    clientNoContextTakeover: true,
    serverNoContextTakeover: true,
    serverMaxWindowBits: 10,
    concurrencyLimit: 10,
    threshold: 1024
  }
});

// Initialize Redis connection (optional, falls back to in-memory if unavailable)
let redis = null;
let redisSub = null;
let redisPub = null;
let useRedis = false;

// Parse Redis connection from environment
let REDIS_HOST, REDIS_PORT, REDIS_PASSWORD, REDIS_DB;

if (process.env.REDIS_URL) {
  // Full URL format: redis://:password@host:port/db
  const url = new URL(process.env.REDIS_URL);
  REDIS_HOST = url.hostname;
  REDIS_PORT = url.port || 6379;
  REDIS_PASSWORD = url.password || undefined;
  REDIS_DB = Number(url.pathname?.slice(1) || 0);
} else if (process.env.REDIS_CONNECTION_STRING) {
  // Format: host:port
  const parts = process.env.REDIS_CONNECTION_STRING.split(':');
  REDIS_HOST = parts[0];
  REDIS_PORT = parts[1] ? Number(parts[1]) : 6379;
} else {
  // Individual env vars or defaults
  REDIS_HOST = process.env.REDIS_HOST || 'redis-15680.c273.us-east-1-2.ec2.cloud.redislabs.com';
  REDIS_PORT = process.env.REDIS_PORT ? Number(process.env.REDIS_PORT) : 15680;
}

REDIS_PASSWORD = process.env.REDIS_PASSWORD || process.env.REDIS_AUTH || undefined;
REDIS_DB = Number(process.env.REDIS_DB || 0);

try {
  if (REDIS_HOST && REDIS_PORT) {
    // Redis Cloud requires password - check if it's set
    if (!REDIS_PASSWORD) {
      console.warn('[Redis] REDIS_PASSWORD not set. Redis Cloud requires authentication.');
      console.warn('[Redis] Falling back to in-memory storage. Set REDIS_PASSWORD in .env to use Redis.');
      useRedis = false;
    } else {
      const redisConfig = {
        host: REDIS_HOST,
        port: Number(REDIS_PORT),
        password: REDIS_PASSWORD,
        db: REDIS_DB,
        retryStrategy: (times) => {
          const delay = Math.min(times * 50, 2000);
          console.log(`[Redis] Retrying connection (attempt ${times}) in ${delay}ms`);
          return delay;
        },
        maxRetriesPerRequest: 3,
        enableReadyCheck: true,
        lazyConnect: true,
        // Handle authentication errors
        showFriendlyErrorStack: true,
      };

      redis = new Redis(redisConfig);

      redisSub = redis.duplicate();
      redisPub = redis.duplicate();

      redis.on('connect', () => {
        console.log('[Redis] Connected successfully');
        useRedis = true;
      });

      redis.on('ready', () => {
        console.log('[Redis] Ready and authenticated');
        useRedis = true;
      });

      redis.on('error', (err) => {
        const errMsg = err.message || String(err);
        if (errMsg.includes('NOAUTH') || errMsg.includes('Authentication')) {
          console.error('[Redis] Authentication failed. Check REDIS_PASSWORD in .env');
          console.error('[Redis] Falling back to in-memory storage');
        } else {
          console.error('[Redis] Connection error:', errMsg);
        }
        useRedis = false;
      });

      redis.on('close', () => {
        console.log('[Redis] Connection closed');
        useRedis = false;
      });

      redis.on('reconnecting', () => {
        console.log('[Redis] Reconnecting...');
      });

      // Connect to Redis
      redis.connect().catch((err) => {
        const errMsg = err.message || String(err);
        if (errMsg.includes('NOAUTH') || errMsg.includes('Authentication')) {
          console.warn('[Redis] Authentication failed. Please set REDIS_PASSWORD in .env');
        } else {
          console.warn('[Redis] Failed to connect, falling back to in-memory storage:', errMsg);
        }
        useRedis = false;
      });

      redisSub.connect().catch((err) => {
        if (!err.message?.includes('NOAUTH')) {
          console.warn('[Redis] Subscriber connection failed:', err.message);
        }
      });
      
      redisPub.connect().catch((err) => {
        if (!err.message?.includes('NOAUTH')) {
          console.warn('[Redis] Publisher connection failed:', err.message);
        }
      });

      // Subscribe to cross-instance messages
      redisSub.on('message', (channel, message) => {
        if (channel === 'ws:broadcast') {
          try {
            const { roomId, payload } = JSON.parse(message);
            const set = rooms.get(roomId);
            if (set) {
              for (const client of set) {
                if (client.readyState === 1) {
                  client.send(JSON.stringify(payload));
                }
              }
            }
          } catch (e) {
            console.error('[Redis] Failed to process broadcast:', e);
          }
        }
      });

      redisSub.subscribe('ws:broadcast').catch(() => {});
    }
  }
} catch (e) {
  console.warn('[Redis] Initialization failed, using in-memory storage:', e.message);
  useRedis = false;
}

const rooms = new Map(); // roomId -> Set<ws> (in-memory for active connections)
const queueByCategory = new Map(); // category -> Array<ws> (in-memory for active connections)
const clients = new Set(); // track connected clients
let nextId = 1;

// Redis helper functions - improved state management
async function getQueueFromRedis(category) {
  if (!useRedis) return [];
  try {
    const data = await redis.get(`queue:${category}`);
    return data ? JSON.parse(data) : [];
  } catch (e) {
    console.error('[Redis] Failed to get queue:', e);
    return [];
  }
}

async function saveQueueToRedis(category, queueData) {
  if (!useRedis) return;
  try {
    if (queueData.length === 0) {
      await redis.del(`queue:${category}`);
    } else {
      // Store queue with metadata
      const queueInfo = {
        data: queueData,
        updatedAt: Date.now(),
        category
      };
      await redis.setex(`queue:${category}`, 300, JSON.stringify(queueInfo)); // 5min TTL
    }
  } catch (e) {
    console.error('[Redis] Failed to save queue:', e);
  }
}

async function saveRoomState(roomId, state) {
  if (!useRedis) return;
  try {
    await redis.setex(`room:${roomId}:state`, 3600, JSON.stringify(state)); // 1hr TTL
  } catch (e) {
    console.error('[Redis] Failed to save room state:', e);
  }
}

async function getRoomState(roomId) {
  if (!useRedis) return null;
  try {
    const data = await redis.get(`room:${roomId}:state`);
    return data ? JSON.parse(data) : null;
  } catch (e) {
    console.error('[Redis] Failed to get room state:', e);
    return null;
  }
}

async function addClientToRoomRedis(roomId, clientId) {
  if (!useRedis) return;
  try {
    await redis.sadd(`room:${roomId}`, clientId);
    await redis.expire(`room:${roomId}`, 3600); // 1hr TTL
  } catch (e) {
    console.error('[Redis] Failed to add client to room:', e);
  }
}

async function removeClientFromRoomRedis(roomId, clientId) {
  if (!useRedis) return;
  try {
    await redis.srem(`room:${roomId}`, clientId);
    const count = await redis.scard(`room:${roomId}`);
    if (count === 0) {
      await redis.del(`room:${roomId}`);
    }
  } catch (e) {
    console.error('[Redis] Failed to remove client from room:', e);
  }
}

function printStatus() {
  const cats = Array.from(queueByCategory.keys());
  const catSummaries = cats.map((c) => `${c}:${(queueByCategory.get(c) || []).length}`).join(' ');
  console.log(`[WS] Clients:${clients.size} Queues{ ${catSummaries || 'none'} } Rooms:${rooms.size}`);
}

async function joinRoom(ws, roomId) {
  if (!rooms.has(roomId)) rooms.set(roomId, new Set());
  rooms.get(roomId).add(ws);
  ws.roomId = roomId;
  await addClientToRoomRedis(roomId, ws.id);
}

async function leaveRoom(ws) {
  const roomId = ws.roomId;
  if (!roomId) return;
  const set = rooms.get(roomId);
  if (set) {
    set.delete(ws);
    if (set.size === 0) rooms.delete(roomId);
  }
  await removeClientFromRoomRedis(roomId, ws.id);
}

wss.on('connection', (ws, req) => {
  ws.id = `c${nextId++}`;
  clients.add(ws);
  const ip = (req?.headers['x-forwarded-for'] || req?.socket?.remoteAddress || 'unknown');
  console.log(`[WS] Connected ${ws.id} from ${ip}. Total clients: ${clients.size}`);
  printStatus();
  
  // Heartbeat ping/pong - handle both WebSocket frames and JSON messages
  ws.isAlive = true;
  ws.on('pong', () => {
    ws.isAlive = true;
  });
  
  // Handle WebSocket ping frames (native protocol)
  ws.on('ping', () => {
    ws.isAlive = true;
    // Respond with pong frame
    if (ws.readyState === 1) {
      try {
        ws.pong();
      } catch (e) {
        console.error(`[WS] Failed to send pong frame to ${ws.id}:`, e.message);
      }
    }
  });
  
  ws.on('message', async (message) => {
    try {
      const data = JSON.parse(message.toString());
      
      // Handle JSON ping/pong for heartbeat (client compatibility)
      if (data.type === 'ping') {
        ws.isAlive = true;
        if (ws.readyState === 1) {
          try {
            ws.send(JSON.stringify({ type: 'pong' }));
          } catch (e) {
            console.error(`[WS] Failed to send pong to ${ws.id}:`, e.message);
          }
        }
        return;
      }
      
      if (data.type === 'join' && data.roomId) {
        await joinRoom(ws, data.roomId);
        ws.send(JSON.stringify({ type: 'joined', roomId: data.roomId, clientId: ws.id }));
      } else if (data.type === 'broadcast' && ws.roomId) {
        const payload = { type: 'event', roomId: ws.roomId, senderId: ws.id, event: data.event, ts: Date.now() };
        const set = rooms.get(ws.roomId) || new Set();
        for (const client of set) {
          if (client.readyState === 1) client.send(JSON.stringify(payload));
        }
        // Also publish to Redis for cross-instance broadcasting
        if (useRedis && redisPub) {
          try {
            await redisPub.publish('ws:broadcast', JSON.stringify({ roomId: ws.roomId, payload }));
            // Save room state for persistence
            await saveRoomState(ws.roomId, {
              lastEvent: data.event,
              lastUpdate: Date.now(),
              participants: Array.from(set).map(c => c.id)
            });
          } catch (e) {
            console.error('[Redis] Failed to publish broadcast:', e);
          }
        }
      } else if (data.type === 'queue' && data.category && typeof data.stake === 'number') {
        const cat = String(data.category);
        const stake = Number(data.stake);
        const list = queueByCategory.get(cat) || [];
        const other = list.find((c) => c !== ws && c.readyState === 1);
        if (other) {
          const remaining = list.filter((c) => c !== other);
          if (remaining.length) queueByCategory.set(cat, remaining); else queueByCategory.delete(cat);
          await saveQueueToRedis(cat, remaining.map(c => ({ id: c.id, queuedAt: c.queuedAt || Date.now() })));
          const duelId = '0x' + crypto.randomBytes(32).toString('hex');
          const creatorMsg = { type: 'match_found', role: 'creator', category: cat, stake, duelId };
          const joinerMsg = { type: 'match_found', role: 'joiner', category: cat, stake, duelId };
          console.log(`[WS] Pairing ${ws.id} (creator) with ${other.id} (joiner) in category '${cat}' duelId=${duelId}`);
          try { ws.send(JSON.stringify(creatorMsg)); } catch { }
          try { other.send(JSON.stringify(joinerMsg)); } catch { }
          printStatus();
        } else {
          list.push(ws);
          ws.queuedAt = Date.now();
          queueByCategory.set(cat, list);
          ws.queueCategory = cat;
          await saveQueueToRedis(cat, list.map(c => ({ id: c.id, queuedAt: c.queuedAt || Date.now() })));
          console.log(`[WS] Queued ${ws.id} in category '${cat}'. Queue size: ${list.length}`);
          try { ws.send(JSON.stringify({ type: 'queued', category: cat })); } catch { }
          printStatus();
        }
      } else if (data.type === 'leave_queue') {
        const cat = ws.queueCategory;
        if (cat) {
          const list = queueByCategory.get(cat) || [];
          const remaining = list.filter((c) => c !== ws);
          if (remaining.length) queueByCategory.set(cat, remaining); else queueByCategory.delete(cat);
          await saveQueueToRedis(cat, remaining.map(c => ({ id: c.id, queuedAt: c.queuedAt || Date.now() })));
          ws.queueCategory = undefined;
          console.log(`[WS] ${ws.id} left queue '${cat}'. New size: ${remaining.length}`);
          try { ws.send(JSON.stringify({ type: 'left_queue', category: cat })); } catch { }
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
  ws.on('close', async () => {
    const cat = ws.queueCategory;
    if (cat) {
      const list = queueByCategory.get(cat) || [];
      const remaining = list.filter((c) => c !== ws);
      if (remaining.length) queueByCategory.set(cat, remaining); else queueByCategory.delete(cat);
      await saveQueueToRedis(cat, remaining.map(c => ({ id: c.id, queuedAt: c.queuedAt || Date.now() })));
      ws.queueCategory = undefined;
    }
    await leaveRoom(ws);
    clients.delete(ws);
    console.log(`[WS] Disconnected ${ws.id}. Total clients: ${clients.size}`);
    printStatus();
  });
  ws.on('error', (err) => {
    console.error(`[WS] Client ${ws.id} error:`, err?.message || String(err));
    // Clean up on error
    if (ws.readyState === 1) {
      try {
        ws.close(1011, 'Internal server error');
      } catch (e) {
        // Connection already closed
      }
    }
  });
});

// Heartbeat interval to detect dead connections
const heartbeatInterval = setInterval(async () => {
  const now = Date.now();
  for (const ws of wss.clients) {
    if (ws.isAlive === false) {
      console.log(`[WS] Terminating dead connection ${ws.id}`);
      const cat = ws.queueCategory;
      if (cat) {
        const list = queueByCategory.get(cat) || [];
        const remaining = list.filter((c) => c !== ws);
        if (remaining.length) queueByCategory.set(cat, remaining); else queueByCategory.delete(cat);
        await saveQueueToRedis(cat, remaining.map(c => ({ id: c.id, queuedAt: c.queuedAt || Date.now() })));
      }
      await leaveRoom(ws);
      clients.delete(ws);
      try {
        ws.terminate();
      } catch (e) {
        // Already closed
      }
    } else {
      ws.isAlive = false;
      if (ws.readyState === 1) {
        try {
          // Use WebSocket ping frame (more efficient than JSON)
          ws.ping();
        } catch (e) {
          console.error(`[WS] Failed to ping ${ws.id}:`, e.message);
          // Mark as dead if ping fails
          ws.isAlive = false;
        }
      } else {
        // Connection not open, mark as dead
        ws.isAlive = false;
      }
    }
  }
}, 30000); // Every 30 seconds

// Cleanup on shutdown
process.on('SIGTERM', async () => {
  clearInterval(heartbeatInterval);
  if (redis) {
    await redis.quit();
    await redisSub?.quit();
    await redisPub?.quit();
  }
  wss.close(() => {
    console.log('[WS] Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', async () => {
  clearInterval(heartbeatInterval);
  if (redis) {
    await redis.quit();
    await redisSub?.quit();
    await redisPub?.quit();
  }
  wss.close(() => {
    console.log('[WS] Server closed');
    process.exit(0);
  });
});

server.listen(PORT, () => {
  console.log(`WS server listening on port ${PORT}`);
  console.log(`[Redis] ${useRedis ? 'Using Redis for state persistence' : 'Using in-memory storage (Redis unavailable)'}`);
  if (REDIS_HOST && REDIS_PORT) {
    console.log(`[Redis] Configured: ${REDIS_HOST}:${REDIS_PORT}`);
  }
});
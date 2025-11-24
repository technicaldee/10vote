// WebSocket utility that handles different environments properly with enhanced stability
export function getWebSocketUrl(): string {
    // Check if we're in a Farcaster miniapp
    const inFarcaster = typeof window !== 'undefined' && (window as any).__isFarcasterMiniApp;

    // Allow override via query string for testing
    const qsWsRaw = (typeof window !== 'undefined') ? new URLSearchParams(window.location.search).get('ws') : undefined;
    const qsWs = qsWsRaw ? qsWsRaw.replace(/^`|`$/g, '').trim() : undefined;

    if (qsWs) {
        return qsWs.endsWith('/ws') ? qsWs : `${qsWs.replace(/\/+$/, '')}/ws`;
    }

    // In Farcaster, we need to use the same origin as the app
    if (inFarcaster) {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const host = window.location.host;
        return `${protocol}//${host}/ws`;
    }

    // For development
    if (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')) {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const port = (import.meta as any).env?.VITE_WS_PORT || '8080';
        return `${protocol}//${window.location.hostname}:${port}/ws`;
    }

    // Check if we have a custom WebSocket URL from environment
    const envWsUrl = (import.meta as any).env?.VITE_GAME_WS_URL;
    if (envWsUrl) {
        return envWsUrl.endsWith('/ws') ? envWsUrl : `${envWsUrl.replace(/\/+$/, '')}/ws`;
    }

    // Production fallback
    return 'wss://10vote.com/ws';
}

export interface WebSocketConfig {
    url: string;
    onOpen?: () => void;
    onMessage?: (data: any) => void;
    onError?: (error: Event) => void;
    onClose?: (event: CloseEvent) => void;
    reconnect?: boolean;
    maxReconnectAttempts?: number;
    reconnectDelay?: number;
    heartbeatInterval?: number;
}

export class StableWebSocket {
    private ws: WebSocket | null = null;
    private config: Required<Omit<WebSocketConfig, 'url'>> & { url: string };
    private reconnectAttempts = 0;
    private reconnectTimeout: number | null = null;
    private heartbeatInterval: number | null = null;
    private isIntentionallyClosed = false;
    private messageQueue: string[] = [];
    private missedPongs = 0;
    private readonly maxMissedPongs = 3;

    constructor(config: WebSocketConfig) {
        this.config = {
            url: config.url,
            onOpen: config.onOpen || (() => {}),
            onMessage: config.onMessage || (() => {}),
            onError: config.onError || (() => {}),
            onClose: config.onClose || (() => {}),
            reconnect: config.reconnect !== false,
            maxReconnectAttempts: config.maxReconnectAttempts || Infinity,
            reconnectDelay: config.reconnectDelay || 1000,
            heartbeatInterval: config.heartbeatInterval || 30000,
        };
        this.connect();
    }

    private connect() {
        if (this.isIntentionallyClosed) return;

        try {
            console.log('[StableWebSocket] Connecting to:', this.config.url);
            this.ws = new WebSocket(this.config.url);

            this.ws.addEventListener('open', () => {
                console.log('[StableWebSocket] Connected successfully');
                this.reconnectAttempts = 0;
                this.missedPongs = 0; // Reset missed pongs on new connection
                this.config.onOpen();
                this.startHeartbeat();
                // Send queued messages
                while (this.messageQueue.length > 0 && this.ws?.readyState === WebSocket.OPEN) {
                    const msg = this.messageQueue.shift();
                    if (msg) this.ws.send(msg);
                }
            });

            this.ws.addEventListener('message', (event) => {
                try {
                    const data = JSON.parse(event.data);
                    // Handle heartbeat pong
                    if (data.type === 'pong') {
                        this.missedPongs = 0; // Reset counter on successful pong
                        return;
                    }
                    this.config.onMessage(data);
                } catch (e) {
                    console.error('[StableWebSocket] Failed to parse message:', e);
                }
            });

            this.ws.addEventListener('error', (error) => {
                console.error('[StableWebSocket] Connection error:', error);
                this.config.onError(error);
            });

            this.ws.addEventListener('close', (event) => {
                console.log('[StableWebSocket] Connection closed:', event.code, event.reason);
                this.stopHeartbeat();
                this.config.onClose(event);

                // Don't reconnect on normal closure (1000) or going away (1001)
                const shouldReconnect = !this.isIntentionallyClosed && 
                    this.config.reconnect && 
                    this.reconnectAttempts < this.config.maxReconnectAttempts &&
                    event.code !== 1000 && // Normal closure
                    event.code !== 1001;   // Going away

                if (shouldReconnect) {
                    const delay = Math.min(
                        this.config.reconnectDelay * Math.pow(2, this.reconnectAttempts),
                        30000 // Max 30 seconds
                    );
                    console.log(`[StableWebSocket] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts + 1})`);
                    this.reconnectTimeout = window.setTimeout(() => {
                        this.reconnectAttempts++;
                        this.connect();
                    }, delay);
                } else if (this.reconnectAttempts >= this.config.maxReconnectAttempts) {
                    console.error('[StableWebSocket] Max reconnection attempts reached');
                }
            });
        } catch (error) {
            console.error('[StableWebSocket] Failed to create connection:', error);
            if (this.config.reconnect && this.reconnectAttempts < this.config.maxReconnectAttempts) {
                const delay = Math.min(
                    this.config.reconnectDelay * Math.pow(2, this.reconnectAttempts),
                    30000
                );
                this.reconnectTimeout = window.setTimeout(() => {
                    this.reconnectAttempts++;
                    this.connect();
                }, delay);
            }
        }
    }

    private startHeartbeat() {
        this.stopHeartbeat();
        this.missedPongs = 0; // Reset on new connection
        
        this.heartbeatInterval = window.setInterval(() => {
            if (this.ws?.readyState === WebSocket.OPEN) {
                try {
                    // Send JSON ping (server handles both JSON and WebSocket frames)
                    this.ws.send(JSON.stringify({ type: 'ping' }));
                    this.missedPongs++;
                    
                    // If we miss too many pongs, the connection might be dead
                    if (this.missedPongs > this.maxMissedPongs) {
                        console.warn('[StableWebSocket] Too many missed pongs, closing connection');
                        this.missedPongs = 0;
                        if (this.ws) {
                            this.ws.close();
                        }
                    }
                } catch (e) {
                    console.error('[StableWebSocket] Heartbeat failed:', e);
                    this.missedPongs++;
                }
            } else {
                this.missedPongs = 0; // Reset if not connected
            }
        }, this.config.heartbeatInterval);
    }

    private stopHeartbeat() {
        if (this.heartbeatInterval !== null) {
            clearInterval(this.heartbeatInterval);
            this.heartbeatInterval = null;
        }
    }

    send(data: string | object) {
        const message = typeof data === 'string' ? data : JSON.stringify(data);
        
        if (this.ws?.readyState === WebSocket.OPEN) {
            try {
                this.ws.send(message);
            } catch (e) {
                console.error('[StableWebSocket] Send failed, queueing:', e);
                this.messageQueue.push(message);
            }
        } else {
            console.warn('[StableWebSocket] Not connected, queueing message');
            this.messageQueue.push(message);
        }
    }

    close() {
        this.isIntentionallyClosed = true;
        this.stopHeartbeat();
        if (this.reconnectTimeout !== null) {
            clearTimeout(this.reconnectTimeout);
            this.reconnectTimeout = null;
        }
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
    }

    get readyState(): number {
        return this.ws?.readyState ?? WebSocket.CLOSED;
    }

    get isConnected(): boolean {
        return this.ws?.readyState === WebSocket.OPEN;
    }
}

export function createWebSocket(url: string): WebSocket {
    const ws = new WebSocket(url);

    // Add debugging for all environments
    console.log('[WebSocket] Creating connection to:', url);

    ws.addEventListener('open', () => {
        console.log('[WebSocket] Connected successfully');
    });

    ws.addEventListener('error', (error) => {
        console.error('[WebSocket] Connection error:', error);

        // Additional debugging for Farcaster
        if (typeof window !== 'undefined' && (window as any).__isFarcasterMiniApp) {
            console.error('[WebSocket] Error in Farcaster environment. Check if WebSocket is allowed in miniapp manifest.');
        }
    });

    ws.addEventListener('close', (event) => {
        console.log('[WebSocket] Connection closed:', event.code, event.reason);

        // Common WebSocket close codes
        if (event.code === 1006) {
            console.warn('[WebSocket] Abnormal closure - possible network issue or server unavailable');
        } else if (event.code === 1015) {
            console.warn('[WebSocket] TLS handshake failure - check if wss:// is required');
        }
    });

    return ws;
}
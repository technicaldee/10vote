// WebSocket utility that handles different environments properly
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
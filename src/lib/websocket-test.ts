// Simple WebSocket connection test utility
import { getWebSocketUrl, createWebSocket } from './websocket';

export function testWebSocketConnection(): Promise<boolean> {
  return new Promise((resolve) => {
    try {
      const wsUrl = getWebSocketUrl();
      console.log('[WebSocket Test] Attempting connection to:', wsUrl);
      
      const ws = createWebSocket(wsUrl);
      
      const timeout = setTimeout(() => {
        ws.close();
        console.log('[WebSocket Test] Connection timeout');
        resolve(false);
      }, 5000);
      
      ws.addEventListener('open', () => {
        clearTimeout(timeout);
        console.log('[WebSocket Test] Connection successful');
        ws.close();
        resolve(true);
      });
      
      ws.addEventListener('error', (error) => {
        clearTimeout(timeout);
        console.error('[WebSocket Test] Connection failed:', error);
        resolve(false);
      });
      
    } catch (error) {
      console.error('[WebSocket Test] Failed to create connection:', error);
      resolve(false);
    }
  });
}
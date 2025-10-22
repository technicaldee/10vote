# Wallet Connection & WebSocket Fixes

## Issues Fixed

### 1. Mobile Wallet Connection (WalletConnect Support)

**Problem**: The app only worked with injected wallets, which doesn't work well on mobile phones where users have MetaMask app but browse with regular Chrome.

**Solution**: 
- Added WalletConnect v2 support alongside injected wallets
- Updated `src/lib/wallet.tsx` to include WalletConnect connector
- Modified `src/App.tsx` to show WalletConnect button on mobile (when not in Farcaster)
- Uses project ID from environment variable `VITE_WALLETCONNECT_PROJECT_ID`

**Changes Made**:
- Added `walletConnect` connector with proper metadata
- Added conditional WalletConnect button for mobile users
- Improved error messages for different environments (Farcaster, mobile, desktop)

### 2. WebSocket Connection Issues in Farcaster

**Problem**: WebSocket connections were hardcoded to `wss://10vote.com` and not following proper protocols for different environments.

**Solution**:
- Created `src/lib/websocket.ts` utility to handle WebSocket URLs dynamically
- Updated WebSocket server to handle CORS properly
- Added proper environment detection for Farcaster, development, and production
- Enhanced debugging and error handling

**Changes Made**:
- `src/lib/websocket.ts`: Smart WebSocket URL resolution
- `src/lib/websocket-test.ts`: Connection testing utility
- Updated `src/components/DuelTab.tsx` and `src/components/GameDuelScreen.tsx` to use new utility
- Enhanced `server/ws-server.js` with better CORS handling
- Updated Farcaster manifest files with `allowedOrigins` for WebSocket connections

## WebSocket URL Resolution Logic

1. **Query String Override**: `?ws=custom-url` for testing
2. **Farcaster Environment**: Uses same origin as the app (`wss://domain/ws`)
3. **Development**: Uses `ws://localhost:8080/ws` (or custom port)
4. **Environment Variable**: Uses `VITE_GAME_WS_URL` if set
5. **Production Fallback**: Uses `wss://10vote.com/ws`

## Testing

### Wallet Connection
1. **Desktop**: Should show "Connect Wallet" button for injected wallets
2. **Mobile (non-Farcaster)**: Should show both "Connect Wallet" and "WalletConnect" buttons
3. **Farcaster**: Should show "Connect Farcaster Wallet" and auto-connect when provider is ready
4. **MiniPay**: Should show "Connect MiniPay" and work with injected provider

### WebSocket Connection
1. Check browser console for WebSocket connection logs
2. Use the WebSocketTest component (in `src/components/WebSocketTest.tsx`) to test connections
3. Verify matchmaking works in different environments

## Environment Variables

Make sure these are set in your `.env`:

```
VITE_WALLETCONNECT_PROJECT_ID=d783a17fe1222625cf15cf7ede98a7e3
VITE_GAME_WS_URL=ws://localhost:8080  # for development
WS_PORT=8080
```

## Farcaster Manifest Updates

Updated both `public/.well-known/farcaster.json` and `public/farcaster.json` to include:

```json
{
  "allowedOrigins": [
    "https://10vote.com",
    "wss://10vote.com"
  ]
}
```

This ensures WebSocket connections are allowed in the Farcaster environment.

## Debugging WebSocket Issues

The new WebSocket utility includes comprehensive logging:
- Connection attempts and URLs
- Success/failure states
- Farcaster-specific error messages
- Common error code explanations (1006, 1015, etc.)

Check browser console for detailed WebSocket connection information.
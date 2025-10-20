
# 10vote Game App

Real-time trivia duels with WebSocket matchmaking and a Celo-enabled wallet experience. This repo contains:
- A React + Vite frontend (`src/`)
- A lightweight WebSocket matchmaking server (`server/ws-server.js`)
- Optional on-chain artifacts (Hardhat + `contracts/`), used when you enable blockchain validation

## Features
- Quick Match: queue by category and get paired instantly
- Live duel room: both clients join the same `duelId` and exchange events in real time
- Opponent handshake: clients broadcast a `hello` with wallet address; UI updates to show the opponent address
- Safe scoring: each client ignores its own echoed events to prevent double-counting
- Wallet & balances: integrates with Celo RPC and WalletConnect

## Prerequisites
- Node.js 18+ and npm
- A WalletConnect Project ID (optional, for wallet connection)
- A running WebSocket server (you can use the provided `ws-server.js`)

## Environment Variables
Create a `.env` file in the project root. This file is ignored by git.

Required (frontend):
- `VITE_GAME_WS_URL` — WebSocket URL for matchmaking rooms. Example: `ws://localhost:8080`
- `VITE_CELO_HTTP_RPC_URL` — HTTP RPC endpoint for Celo. Example: `https://forno.celo.org`

Optional (frontend):
- `VITE_CELO_WS_RPC_URL` — WS RPC endpoint for Celo subscriptions. Example: `wss://forno.celo.org/ws`
- `VITE_WALLETCONNECT_PROJECT_ID` — Your WalletConnect Project ID
- `VITE_SELF_APP_NAME` — Display name shown in the Self app (default: `10vote`)
- `VITE_SELF_SCOPE` — Scope identifier used by Self (default: `10vote`)
- `VITE_SELF_ENDPOINT` — Backend verification URL (default: `${window.location.origin}/api/self/verify`)
- `VITE_SELF_ENDPOINT_TYPE` — Endpoint type for SDK (e.g. `staging_https`)
- `VITE_SELF_LOGO` — Logo URL or base64 used by the Self SDK QR builder

Optional (backend):
- `SELF_SCOPE` — Scope used by backend verifier (default: `self-playground`)
- `SELF_VERIFY_ENDPOINT` — Self verifier endpoint (default: `https://playground.self.xyz/api/verify`)
- `SELF_MOCK_PASSPORT` — Set `true` to use staging/testnet (default: `false`)
- `SELF_USER_IDENTIFIER_TYPE` — User identifier type (e.g. `uuid`, default: `uuid`)
- `VITE_BLOCKSCOUT_API_URL` — Blockscout API URL for token/txn lookups. Example: `https://api.blockscout.com/api/v2`
- `VITE_CUSD_ADDRESS` — cUSD token address (defaults to mainnet if not set)
- `VITE_CELO_TOKEN_ADDRESS` — CELO token address (defaults to mainnet if not set)
- `VITE_DUEL_CONTRACT_ADDRESS` — DuelManager contract address if you enable on-chain validation

Example `.env`:
```
VITE_GAME_WS_URL=ws://localhost:8080
VITE_CELO_HTTP_RPC_URL=https://forno.celo.org
VITE_CELO_WS_RPC_URL=wss://forno.celo.org/ws
VITE_WALLETCONNECT_PROJECT_ID=your_walletconnect_project_id
VITE_BLOCKSCOUT_API_URL=https://api.blockscout.com/api/v2
# Optional overrides (these have sensible defaults in code)
# VITE_CUSD_ADDRESS=0x765DE816845861e75A25fCA122bb6898B8B1282a
# VITE_CELO_TOKEN_ADDRESS=0x471EcE3750Da237f93B8E339c5369898B8978a438
# VITE_DUEL_CONTRACT_ADDRESS=0xYourDeployedDuelManager
```

## Getting Started
1. Install dependencies:
```
npm install
```
2. Start everything at once (web + ws):
```
npm run start
```
   - Or run them separately:
```
npm run ws      # starts the matchmaking WS server (default port 8080)
npm run dev     # starts the Vite dev server (default port 3000)
```
3. Open the URL printed by Vite (defaults to `http://localhost:3000`).

## Matchmaking & Room Flow
- Frontend queues by category with `queue` (stake value is carried in the message)
- Server pairs two clients and sends `match_found` with `role` (`creator`/`joiner`) and a generated `duelId`
- Both clients then send `join` with that `duelId`
- Each client broadcasts a `hello` with its wallet address; the other side uses this to label the opponent
- Answer broadcasts carry `{ type: 'answer', index, isCorrect, from }` and each client ignores events where `from` equals its own address (prevents double-scoring)

## Build & Preview
```
npm run build
npm run start:prod  # runs vite preview + ws server concurrently
```

## Troubleshooting
- `WebSocket connection to 'wss://forno.celo.org/ws' failed` — the WS RPC is optional. The app continues using HTTP RPC. You can remove or change `VITE_CELO_WS_RPC_URL` if you prefer.
- Ensure the WS server is reachable: it listens on `WS_PORT` or defaults to `8080`. Start it with `npm run ws` and point `VITE_GAME_WS_URL` to it.

## Project Structure
- `src/components/` — UI and game logic (DuelTab, GameDuelScreen, WalletTab, Leaderboard)
- `server/ws-server.js` — simple matchmaking server (rooms, queue, broadcast)
- `contracts/` — `DuelManager.sol` and Hardhat config/scripts
- `src/lib/blockchain.ts` & `src/lib/wallet.tsx` — RPC config and wallet utilities

## Notes
- The `.env` file is intentionally excluded from version control via `.gitignore`.
- On-chain validation can be re-enabled later by configuring `VITE_DUEL_CONTRACT_ADDRESS` and using the contract paths in `DuelTab.tsx`.
  
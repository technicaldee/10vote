import { createPublicClient, createWalletClient, http, webSocket, fallback } from 'viem';
import { defineChain } from 'viem/utils';
import { Chain } from 'wagmi';

const wsUrl = import.meta.env.VITE_CELO_WS_RPC_URL as string;
const httpUrl = import.meta.env.VITE_CELO_HTTP_RPC_URL as string;

export const celoChain: Chain = {
  id: 42220,
  name: 'Celo',
  nativeCurrency: { name: 'CELO', symbol: 'CELO', decimals: 18 },
  rpcUrls: {
    default: { http: [httpUrl], webSocket: [wsUrl] },
    public: { http: [httpUrl], webSocket: [wsUrl] },
  },
};

export const viemPublicClient = createPublicClient({
  chain: defineChain({ id: celoChain.id, name: celoChain.name, nativeCurrency: celoChain.nativeCurrency, rpcUrls: { default: { http: [httpUrl], webSocket: [wsUrl] } } }),
  // Prefer WS for real-time if available, but gracefully fall back to HTTP
  transport: fallback([
    ...(wsUrl ? [webSocket(wsUrl)] : []),
    http(httpUrl),
  ]),
});

// Note: wallet client will be created via wagmi connectors

export const CUSD_ADDRESS = (import.meta.env.VITE_CUSD_ADDRESS as `0x${string}`) || '0x765DE816845861e75A25fCA122bb6898B8B1282a';
export const DUEL_CONTRACT_ADDRESS = import.meta.env.VITE_DUEL_CONTRACT_ADDRESS as `0x${string}`;
// CELO ERC20 (GoldToken) address on Celo mainnet
export const CELO_TOKEN_ADDRESS = (import.meta.env.VITE_CELO_TOKEN_ADDRESS as `0x${string}`) || '0x471EcE3750Da237f93B8E339c536989b8978a438';
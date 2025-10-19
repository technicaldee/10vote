import { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { WagmiConfig, createConfig } from 'wagmi';
import { InjectedConnector } from 'wagmi/connectors/injected';
import { WalletConnectConnector } from 'wagmi/connectors/walletConnect';
import { celoChain } from './blockchain';
import { createPublicClient, http, webSocket } from 'viem';
import { defineChain } from 'viem/utils';
import { SelfVerificationProvider } from './self';

const DEFAULT_HTTP = 'https://forno.celo.org';
const DEFAULT_WS = 'wss://forno.celo.org/ws';
const sanitize = (url?: string) => (url ? url.replace(/^`|`$/g, '').trim() : '');

const httpUrl = sanitize(import.meta.env.VITE_CELO_HTTP_RPC_URL) || DEFAULT_HTTP;
const wsUrl = sanitize(import.meta.env.VITE_CELO_WS_RPC_URL) || DEFAULT_WS;
// Hardcode WalletConnect Project ID for troubleshooting
const wcProjectId = 'd783a17fe1222625cf15cf7ede98a7e3';

const chains = [celoChain];

const viemChain = defineChain({
  id: celoChain.id,
  name: celoChain.name,
  nativeCurrency: celoChain.nativeCurrency,
  rpcUrls: { default: { http: [httpUrl], webSocket: [wsUrl] } },
});

const publicClient = createPublicClient({
  chain: viemChain,
  transport: http(httpUrl),
});

const connectors = [
  new InjectedConnector({ chains }),
  ...(wcProjectId
    ? [
        new WalletConnectConnector({
          chains,
          options: {
            projectId: wcProjectId,
            showQrModal: true,
            metadata: {
              name: '10vote',
              description: 'Real-time Quiz Duels on Celo',
              url: typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3001',
              icons: [],
            },
          },
        }),
      ]
    : []),
];

const config = createConfig({
  autoConnect: true,
  publicClient,
  connectors,
});

const queryClient = new QueryClient();

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <WagmiConfig config={config}>
        <SelfVerificationProvider>
          {children}
        </SelfVerificationProvider>
      </WagmiConfig>
    </QueryClientProvider>
  );
}
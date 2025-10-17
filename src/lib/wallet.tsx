import { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { WagmiConfig, createConfig } from 'wagmi';
import { InjectedConnector } from 'wagmi/connectors/injected';
import { WalletConnectConnector } from 'wagmi/connectors/walletConnect';
import { celoChain } from './blockchain';
import { createPublicClient, http, webSocket } from 'viem';
import { defineChain } from 'viem/utils';

const httpUrl = import.meta.env.VITE_CELO_HTTP_RPC_URL as string;
const wsUrl = import.meta.env.VITE_CELO_WS_RPC_URL as string;
const wcProjectId = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID as string;

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

const config = createConfig({
  autoConnect: true,
  publicClient,
  connectors: [
    new InjectedConnector({ chains }),
    new WalletConnectConnector({ chains, options: { projectId: wcProjectId, showQrModal: true } }),
  ],
});

const queryClient = new QueryClient();

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <WagmiConfig config={config}>{children}</WagmiConfig>
    </QueryClientProvider>
  );
}
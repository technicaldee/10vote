import { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { WagmiProvider, createConfig, http } from 'wagmi';
import { injected } from 'wagmi/connectors';
import { celoChain } from './blockchain';
import { SelfVerificationProvider } from './self';

const DEFAULT_HTTP = 'https://forno.celo.org';
const sanitize = (url?: string) => (url ? url.replace(/^`|`$/g, '').trim() : '');

const httpUrl = sanitize(import.meta.env.VITE_CELO_HTTP_RPC_URL) || DEFAULT_HTTP;

const config = createConfig({
  chains: [celoChain],
  transports: {
    [celoChain.id]: http(httpUrl),
  },
  connectors: [injected({ shimDisconnect: true })],
});

const queryClient = new QueryClient();

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <SelfVerificationProvider>{children}</SelfVerificationProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
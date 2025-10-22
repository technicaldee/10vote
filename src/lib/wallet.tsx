import { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { WagmiProvider, createConfig, http } from 'wagmi';
import { injected, walletConnect } from 'wagmi/connectors';
import { celoChain } from './blockchain';
import { SelfVerificationProvider } from './self';

const DEFAULT_HTTP = 'https://forno.celo.org';
const sanitize = (url?: string) => (url ? url.replace(/^`|`$/g, '').trim() : '');

const httpUrl = sanitize(import.meta.env.VITE_CELO_HTTP_RPC_URL) || DEFAULT_HTTP;

// WalletConnect project ID - you'll need to get this from https://cloud.walletconnect.com/
const projectId = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID || 'd783a17fe1222625cf15cf7ede98a7e3';

const config = createConfig({
  chains: [celoChain],
  transports: {
    [celoChain.id]: http(httpUrl),
  },
  connectors: [
    injected({ shimDisconnect: true }),
    walletConnect({
      projectId,
      metadata: {
        name: '10vote Game App',
        description: 'Blockchain trivia dueling game',
        url: typeof window !== 'undefined' ? window.location.origin : 'https://10vote.com',
        icons: ['https://10vote.com/favicon.ico'],
      },
      showQrModal: true,
    }),
  ],
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
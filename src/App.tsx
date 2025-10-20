import { useMemo, useState, useEffect } from 'react';
import { Swords, Wallet, Trophy } from 'lucide-react';
import { Toaster, toast } from 'sonner';
import { DuelTab } from './components/DuelTab';
import { WalletTab } from './components/WalletTab';
import { LeaderboardTab } from './components/LeaderboardTab';
import { GameDuelScreen } from './components/GameDuelScreen';
import { GameResultsScreen } from './components/GameResultsScreen';
import { useAccount, useConnect } from 'wagmi';
import { useQuery } from '@tanstack/react-query';
import { createPublicClient, http } from 'viem';
import { celoChain, CUSD_ADDRESS } from './lib/blockchain';
import { erc20Abi } from './abi/duelManager';

type Screen = 'duel' | 'wallet' | 'leaderboard' | 'game' | 'results';

export default function App() {
  const [activeTab, setActiveTab] = useState<Screen>('duel');
  const [userBalance, setUserBalance] = useState(0);
  const [gameData, setGameData] = useState<any>(null);

  const { address, isConnected } = useAccount();
  const { connectors, connect, isPending } = useConnect();
  const publicClient = useMemo(() => createPublicClient({ chain: celoChain, transport: http(import.meta.env.VITE_CELO_HTTP_RPC_URL as string) }), []);

  // Detect MiniPay & injected availability
  const isMiniPay = typeof window !== 'undefined' && (window as any).ethereum?.isMiniPay === true;
  const hasInjected = typeof window !== 'undefined' && !!(window as any).ethereum;
  const isMobile = typeof navigator !== 'undefined' && /Android|iPhone|iPad|iPod|Opera Mini|IEMobile|WPDesktop/i.test(navigator.userAgent);

  // Auto-connect if a provider is present (MiniPay or Farcaster-injected)
  const [autoConnectAttempted, setAutoConnectAttempted] = useState(false);
  useEffect(() => {
    if (!isConnected && !autoConnectAttempted && hasInjected && connectors.length > 0 && !isPending) {
      setAutoConnectAttempted(true);
      connect({ connector: connectors[0] });
    }
  }, [isConnected, autoConnectAttempted, hasInjected, connectors, connect, isPending]);
  const { data: cusdBalance } = useQuery({
    queryKey: ['cusd-balance', address],
    queryFn: async () => {
      if (!address) return 0;
      const bal = await publicClient.readContract({ address: CUSD_ADDRESS, abi: erc20Abi, functionName: 'balanceOf', args: [address] });
      return Number(bal) / 1e18;
    },
    enabled: !!address,
    refetchInterval: 15000,
  });

  useEffect(() => {
    if (isConnected && typeof cusdBalance === 'number') {
      setUserBalance(cusdBalance);
    }
  }, [isConnected, cusdBalance]);

  const startGame = (stake: number, opponent?: string, duelId?: string, spectator?: boolean, creator?: boolean, category?: string) => {
    setGameData({ stake, opponent, duelId, spectator: !!spectator, creator: !!creator, category: category || 'random' });
    setActiveTab('game');
  };

  const finishGame = (won: boolean, correctAnswers: number, totalQuestions: number, prize: number) => {
    setGameData({
      ...gameData,
      won,
      correctAnswers,
      totalQuestions,
      prize,
    });
    setActiveTab('results');
  };

  const returnToDuel = () => {
    setGameData(null);
    setActiveTab('duel');
  };
  // Gate the app: show only connect overlay until wallet is connected
  if (!isConnected) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950">
        <Toaster richColors position="top-center" />
        <div className="fixed inset-0 z-[9999] bg-slate-950/95 backdrop-blur-md flex items-center justify-center p-6">
          <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
            <h2 className="text-white text-2xl mb-2">Connect Your Wallet</h2>
            <p className="text-slate-400 mb-4">To play and track your balance on-chain, please connect a wallet.</p>
            <div className="flex flex-wrap gap-3">
              <button
                onClick={() => {
                  if (!hasInjected) {
                    const inFarcaster = typeof window !== 'undefined' && (window as any).__isFarcasterMiniApp;
                    toast.error(
                      inFarcaster
                        ? 'Wallet unavailable in Farcaster. Ensure wallet capability and sign in, then retry.'
                        : isMobile
                        ? 'No injected wallet detected. Open this site in MiniPay or MetaMask in-app browser.'
                        : 'No injected wallet detected. Install an injected wallet like MetaMask or Brave Wallet.'
                    );
                    return;
                  }
                  connect({ connector: connectors[0] });
                }}
                disabled={isPending}
                className="px-4 py-2 rounded-lg bg-emerald-600 text-white disabled:opacity-50"
              >
                {isMiniPay ? 'Connect MiniPay' : 'Connect Wallet'}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950">
      <Toaster richColors position="top-center" />
      {/* Main Content */}
      <div className="pb-20 min-h-screen">
        {activeTab === 'duel' && (
          <DuelTab 
            userBalance={isConnected ? (cusdBalance ?? 0) : userBalance} 
            onStartGame={startGame}
          />
        )}
        {activeTab === 'wallet' && (
          <WalletTab 
            userBalance={isConnected ? (cusdBalance ?? 0) : userBalance}
            onBalanceChange={() => {}}
          />
        )}
        {activeTab === 'leaderboard' && (
          <LeaderboardTab />
        )}
        {activeTab === 'game' && (
          <GameDuelScreen 
            stake={gameData?.stake || 0.10}
            opponent={gameData?.opponent}
            duelId={gameData?.duelId}
            spectator={gameData?.spectator}
            creator={gameData?.creator}
            category={gameData?.category}
            onGameFinish={finishGame}
          />
        )}
        {activeTab === 'results' && (
          <GameResultsScreen 
            won={gameData?.won}
            prize={gameData?.prize}
            correctAnswers={gameData?.correctAnswers}
            totalQuestions={gameData?.totalQuestions}
            stake={gameData?.stake}
            onRematch={() => startGame(gameData?.stake, gameData?.opponent, gameData?.duelId, false, true, gameData?.category)}
            onNewDuel={returnToDuel}
          />
        )}
      </div>

      {/* Bottom Navigation */}
      {!['game', 'results'].includes(activeTab) && (
        <nav className="fixed bottom-0 left-0 right-0 bg-slate-950/95 backdrop-blur-lg border-t border-slate-800 z-50">
          <div className="flex items-center justify-around max-w-lg mx-auto px-4 py-3">
            <button
              onClick={() => setActiveTab('duel')}
              className={`flex flex-col items-center gap-1 px-6 py-2 rounded-lg transition-colors ${
                activeTab === 'duel'
                  ? 'text-emerald-400'
                  : 'text-slate-400 hover:text-slate-300'
              }`}
            >
              <Swords className="w-6 h-6" />
              <span className="text-xs">Duel</span>
            </button>
            <button
              onClick={() => setActiveTab('wallet')}
              className={`flex flex-col items-center gap-1 px-6 py-2 rounded-lg transition-colors ${
                activeTab === 'wallet'
                  ? 'text-emerald-400'
                  : 'text-slate-400 hover:text-slate-300'
              }`}
            >
              <Wallet className="w-6 h-6" />
              <span className="text-xs">Wallet</span>
            </button>
            <button
              onClick={() => setActiveTab('leaderboard')}
              className={`flex flex-col items-center gap-1 px-6 py-2 rounded-lg transition-colors ${
                activeTab === 'leaderboard'
                  ? 'text-emerald-400'
                  : 'text-slate-400 hover:text-slate-300'
              }`}
            >
              <Trophy className="w-6 h-6" />
              <span className="text-xs">Leaderboard</span>
            </button>
          </div>
        </nav>
      )}
    </div>
  );
}

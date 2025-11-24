import { useEffect, useMemo, useRef, useState } from 'react';
import { Zap, Clock, Trophy, Sparkles, Gamepad2, CircleSlash, Dice6, Brain, FlaskConical, ScrollText, Clapperboard, Globe, Target, DollarSign, Swords } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { Button } from './ui/button';
import { Card } from './ui/card';
import { Badge } from './ui/badge';
import { ImageWithFallback } from './figma/ImageWithFallback';
import { soundEffects } from '../utils/soundEffects';
import { useAccount, useWalletClient, useChainId } from 'wagmi';
import { viemPublicClient, DUEL_CONTRACT_ADDRESS, CUSD_ADDRESS, CELO_TOKEN_ADDRESS, celoChain } from '../lib/blockchain';
import { duelManagerAbi, erc20Abi } from '../abi/duelManager';
import { toHex, encodeFunctionData } from 'viem';
import { Input } from './ui/input';
import { toast } from 'sonner';
import { useSelf } from '../lib/self';
import { getWebSocketUrl, StableWebSocket } from '../lib/websocket';
import { getReferralTag, submitReferral } from '@divvi/referral-sdk';
import { getDailyChallenge, completeDailyChallenge } from '../lib/dailyChallenge';
import { getPlayerStats } from '../lib/playerStats';

interface DuelTabProps {
  userBalance: number;
  onStartGame: (stake: number, opponent?: string, duelId?: string, spectator?: boolean, creator?: boolean, category?: string) => void;
}

const categories = [
  { id: 'random', name: 'Random', emoji: '🎲', gradient: 'from-purple-500 to-pink-500' },
  { id: 'general', name: 'General', emoji: '🧠', gradient: 'from-blue-500 to-cyan-500' },
  { id: 'sports', name: 'Sports', emoji: '⚽', gradient: 'from-green-500 to-emerald-500' },
  { id: 'science', name: 'Science', emoji: '🔬', gradient: 'from-indigo-500 to-purple-500' },
  { id: 'history', name: 'History', emoji: '📜', gradient: 'from-amber-500 to-orange-500' },
  { id: 'pop', name: 'Pop Culture', emoji: '🎬', gradient: 'from-rose-500 to-red-500' },
  { id: 'geography', name: 'Geography', emoji: '🌍', gradient: 'from-teal-500 to-green-500' },
];

const DIVVI_CONSUMER: `0x${string}` = '0x900f96DD68CA49001228348f1A2Cd28556FB62dd';

async function sendWithReferral(
  wc: any,
  to: `0x${string}`,
  abi: any,
  functionName: string,
  args: any[],
  value?: bigint
) {
  const [account] = await wc.getAddresses();
  const data = encodeFunctionData({ abi, functionName, args });
  const tag = getReferralTag({ user: account, consumer: DIVVI_CONSUMER });
  const fullData = (data + tag.slice(2)) as `0x${string}`;
  const txHash = await wc.sendTransaction({ account, to, data: fullData, value });
  const chainId = await wc.getChainId();
  try { await viemPublicClient.waitForTransactionReceipt({ hash: txHash }); } catch { }
  try { await submitReferral({ txHash, chainId }); } catch { }
  return txHash;
}

export function DuelTab({ userBalance, onStartGame }: DuelTabProps) {
  const [selectedCategory, setSelectedCategory] = useState('random');
  const [selectedToken, setSelectedToken] = useState<'cusd' | 'celo'>('cusd');
  const [inviteCode, setInviteCode] = useState('');
  const [showFriendPanel, setShowFriendPanel] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const [liveDuels, setLiveDuels] = useState<any[]>([]);
  const [waitingForMatch, setWaitingForMatch] = useState(false);
  const [waitingDuelId, setWaitingDuelId] = useState<`0x${string}` | null>(null);
  const [waitingStake, setWaitingStake] = useState<number>(0.1);
  const [stopWaitingWatch, setStopWaitingWatch] = useState<(() => void) | null>(null);
  const [waitingTime, setWaitingTime] = useState<number>(0);
  const [isComputerDuel, setIsComputerDuel] = useState(false);
  const computerTimeoutRef = useRef<number | null>(null);
  const { address, isConnected } = useAccount();
  const { data: walletClient } = useWalletClient();
  const chainId = useChainId();
  const wsRef = useRef<StableWebSocket | null>(null);
  const [wsStatus, setWsStatus] = useState<'connecting' | 'open' | 'reconnecting' | 'closed'>('connecting');
  // Get verification context from Self provider
  const { verification } = useSelf();
  const [matchMode, setMatchMode] = useState<'1v1' | '2v2'>('1v1');
  const [tokenBalance, setTokenBalance] = useState<number>(0);
  const [dailyChallenge, setDailyChallenge] = useState(() => getDailyChallenge());
  const [playerStats, setPlayerStats] = useState(() => getPlayerStats(address));
  const STAKE_AMOUNT = 0.10;
  const CELO_USD_RATE = 0.29;
  const currentTokenAddress = selectedToken === 'cusd' ? CUSD_ADDRESS : CELO_TOKEN_ADDRESS;
  const currentTokenSymbol = selectedToken === 'cusd' ? 'cUSD' : 'CELO';
  
  // Refresh daily challenge and stats
  useEffect(() => {
    setDailyChallenge(getDailyChallenge());
    if (address) {
      setPlayerStats(getPlayerStats(address));
    }
  }, [address]);

  const CategoryIcon = ({ id }: { id: string }) => {
    const common = 'w-4 h-4';
    switch (id) {
      case 'random': return <Dice6 className={common} />;
      case 'general': return <Brain className={common} />;
      case 'sports': return <Trophy className={common} />;
      case 'science': return <FlaskConical className={common} />;
      case 'history': return <ScrollText className={common} />;
      case 'pop': return <Clapperboard className={common} />;
      case 'geography': return <Globe className={common} />;
      default: return <Sparkles className={common} />;
    }
  };

  const waitForDuelCreated = async (duelId: `0x${string}`, timeoutMs = 20000) => {
    const start = Date.now();
    if (!DUEL_CONTRACT_ADDRESS) return false;
    while (Date.now() - start < timeoutMs) {
      try {
        const res = await viemPublicClient.readContract({ address: DUEL_CONTRACT_ADDRESS, abi: duelManagerAbi, functionName: 'duels', args: [duelId] });
        const player1 = (res as any)?.player1 ?? (Array.isArray(res) ? res[1] : undefined);
        if (player1 && typeof player1 === 'string' && player1 !== '0x0000000000000000000000000000000000000000') {
          return true;
        }
      } catch { }
      await new Promise((r) => setTimeout(r, 1000));
    }
    return false;
  };

  const waitForDuelJoined = async (duelId: `0x${string}`, timeoutMs = 25000) => {
    const start = Date.now();
    if (!DUEL_CONTRACT_ADDRESS) return false;
    while (Date.now() - start < timeoutMs) {
      try {
        const res = await viemPublicClient.readContract({ address: DUEL_CONTRACT_ADDRESS, abi: duelManagerAbi, functionName: 'duels', args: [duelId] });
        const player2 = (res as any)?.player2 ?? (Array.isArray(res) ? res[2] : undefined);
        if (player2 && typeof player2 === 'string' && player2 !== '0x0000000000000000000000000000000000000000') {
          return true;
        }
      } catch { }
      await new Promise((r) => setTimeout(r, 1000));
    }
    return false;
  };

  const ensureCelo = async () => {
    try {
      const wc = walletClient!;
      if (!wc) return false;
      if (chainId !== celoChain.id) {
        // attempt to switch
        // @ts-ignore
        if (wc.switchChain) {
          // @ts-ignore
          await wc.switchChain({ id: celoChain.id });
          return true;
        }
        toast.error('Network mismatch. Please switch your wallet to Celo Mainnet (42220).');
        return false;
      }
      return true;
    } catch (e) {
      toast.error('Failed to switch network. Please select Celo Mainnet in your wallet.');
      return false;
    }
  };

  // Refresh balance for selected token
  useEffect(() => {
    let cancelled = false;
    async function refresh() {
      try {
        if (!address) { setTokenBalance(0); return; }
        const bal = await viemPublicClient.readContract({ address: currentTokenAddress, abi: erc20Abi, functionName: 'balanceOf', args: [address] });
        if (!cancelled) setTokenBalance(Number(bal) / 1e18);
      } catch {
        if (!cancelled) setTokenBalance(0);
      }
    }
    refresh();
    const id = setInterval(refresh, 15000);
    return () => { cancelled = true; clearInterval(id); };
  }, [address, currentTokenAddress]);

  useEffect(() => {
    let cancelled = false;
    let reconnectToastId: string | number | null = null;

    const openToast = () => {
      if (reconnectToastId == null) {
        reconnectToastId = toast.message('Disconnected. Reconnecting…', { duration: Infinity });
      }
    };
    const closeToast = () => {
      if (reconnectToastId != null) {
        toast.dismiss(reconnectToastId);
        reconnectToastId = null;
      }
    };

    if (cancelled) return;

    const wsUrl = getWebSocketUrl();
    const ws = new StableWebSocket({
      url: wsUrl,
      onOpen: () => {
        console.log('[matchmaking] ws open');
        setWsStatus('open');
        closeToast();
      },
      onMessage: (payload) => {
        try {
          console.log('[matchmaking] ws message', payload);
          if (payload.type === 'error') {
            toast.error(payload.message || 'Matchmaking error');
          }
          if (payload.type === 'queued') {
            toast.message('Queued for Quick Match…');
            // Start computer opponent timer (4 seconds)
            if (computerTimeoutRef.current) {
              clearTimeout(computerTimeoutRef.current);
            }
            computerTimeoutRef.current = window.setTimeout(() => {
              // If still waiting after 4 seconds, start computer duel
              if (waitingForMatch && !waitingDuelId) {
                handleComputerDuel();
              }
            }, 4000);
          }
          if (payload.type === 'match_found') {
            const { role, duelId, stake } = payload as { role: 'creator' | 'joiner', duelId: `0x${string}`, stake: number };
            // Clear computer timeout if match found
            if (computerTimeoutRef.current) {
              clearTimeout(computerTimeoutRef.current);
              computerTimeoutRef.current = null;
            }
            setWaitingStake(stake);
            setWaitingDuelId(duelId);
            setWaitingForMatch(false);
            setIsComputerDuel(false);
            try { wsRef.current?.send({ type: 'status', phase: 'direct_start', duelId, extra: { role, stake } }); } catch { }
            onStartGame(stake, undefined, duelId as `0x${string}`, false, role === 'creator', selectedCategory);
          }
        } catch (e) {
          console.error('[matchmaking] failed to parse ws message', e);
        }
      },
      onError: (err) => {
        console.error('[matchmaking] ws error', err);
      },
      onClose: (evt) => {
        console.log('[matchmaking] ws closed', { code: evt.code, reason: evt.reason });
        if (cancelled) return;
        setWsStatus('reconnecting');
        openToast();
      },
      reconnect: true,
      maxReconnectAttempts: Infinity,
      reconnectDelay: 1000,
    });
    
    wsRef.current = ws;

    return () => {
      cancelled = true;
      closeToast();
      ws.close();
    };
  }, [selectedCategory]);

  useEffect(() => {
    if (!DUEL_CONTRACT_ADDRESS) {
      console.warn('DUEL_CONTRACT_ADDRESS is not set. Live duels watcher disabled.');
      return;
    }
    const unwatch = viemPublicClient.watchContractEvent({
      address: DUEL_CONTRACT_ADDRESS,
      abi: duelManagerAbi,
      eventName: 'DuelCreated',
      onLogs: (logs) => {
        const mapped = logs.map((l: any) => ({
          id: l.args.id as `0x${string}`,
          player: l.args.player1 as string,
          stake: Number(l.args.stake) / 1e18,
          token: l.args.token as string,
          category: categories.find(c => c.id === selectedCategory)?.name || 'Random',
          avatar: 'DL',
          image: 'https://images.unsplash.com/photo-1606037988094-fbc91ebdcdfb?auto=format&fit=crop&w=600&q=60',
        }));
        setLiveDuels((prev) => {
          // merge by id
          const dedup = new Map<string, any>();
          [...prev, ...mapped].forEach(d => dedup.set(d.id, d));
          return Array.from(dedup.values());
        });
      }
    });
    return () => { unwatch?.(); };
  }, [selectedCategory]);

  const handleQuickMatch = async () => {
    soundEffects.playClick();
    const stakeNum = STAKE_AMOUNT;
    if (!isConnected || !walletClient) {
      // App-level overlay will prompt connect; just return
      return;
    }
    if (!verification?.isHumanVerified) {
      toast.error('Verification required. Please Sign in with Self first in wallet tab.');
      return;
    }
    try {
      const ok = await ensureCelo();
      if (!ok) return;
      if (tokenBalance < stakeNum) {
        toast.error(`Insufficient ${currentTokenSymbol} balance for selected stake`);
        return;
      }
      if (!wsRef.current || !wsRef.current.isConnected) {
        toast.error('Matchmaking server unavailable');
        return;
      }
      // Reset waiting state
      setWaitingTime(0);
      setIsComputerDuel(false);
      if (computerTimeoutRef.current) {
        clearTimeout(computerTimeoutRef.current);
        computerTimeoutRef.current = null;
      }
      wsRef.current.send({ type: 'queue', category: selectedCategory, stake: stakeNum, token: currentTokenSymbol, identity: { human: true, proofToken: verification?.proofToken || null, ageOver21: !!verification?.ageOver21, ageOver18: !!verification?.ageOver18 } });
      setWaitingStake(stakeNum);
      setWaitingForMatch(true);
      setWaitingDuelId(null);
      
      // Start waiting timer
      const timer = setInterval(() => {
        setWaitingTime((prev) => prev + 1);
      }, 1000);
      
      // Store timer cleanup
      setStopWaitingWatch(() => () => {
        clearInterval(timer);
        if (computerTimeoutRef.current) {
          clearTimeout(computerTimeoutRef.current);
          computerTimeoutRef.current = null;
        }
      });
    } catch (e: any) {
      const msg = e?.shortMessage || e?.message || 'Failed to start Quick Match';
      if (typeof msg === 'string' && msg.includes('does not match the target chain')) {
        toast.error('Network mismatch. Switch your wallet to Celo Mainnet (42220).');
      } else {
        toast.error(msg);
      }
      setWaitingForMatch(false);
      setWaitingDuelId(null);
    }
  };

  const handleComputerDuel = async () => {
    if (!isConnected || !walletClient || !address) {
      toast.error('Wallet not connected');
      return;
    }
    if (!DUEL_CONTRACT_ADDRESS) {
      toast.error('Duel contract address not configured');
      return;
    }
    
    try {
      const wc = walletClient;
      const stakeNum = STAKE_AMOUNT;
      const stake = BigInt(Math.floor(stakeNum * 1e18));
      const duelId = randomBytes32();
      
      const ok = await ensureCelo();
      if (!ok) return;
      
      // Clear timeout
      if (computerTimeoutRef.current) {
        clearTimeout(computerTimeoutRef.current);
        computerTimeoutRef.current = null;
      }
      
      // Approve and create computer duel
      await sendWithReferral(wc, currentTokenAddress, erc20Abi, 'approve', [DUEL_CONTRACT_ADDRESS, stake]);
      await sendWithReferral(wc, DUEL_CONTRACT_ADDRESS, duelManagerAbi, 'createComputerDuel', [duelId, stake, currentTokenAddress]);
      
      setIsComputerDuel(true);
      setWaitingForMatch(false);
      setWaitingDuelId(duelId);
      toast.success('🤖 Playing against Computer Opponent!');
      
      // Leave queue
      try { wsRef.current?.send({ type: 'leave_queue' }); } catch { }
      
      // Start game with computer opponent
      onStartGame(stakeNum, '0x000000000000000000000000000000000000dEaD', duelId as `0x${string}`, false, true, selectedCategory);
    } catch (e: any) {
      const msg = e?.shortMessage || e?.message || 'Failed to start computer duel';
      toast.error(msg);
      setWaitingForMatch(false);
    }
  };

  const cancelQuickMatch = async () => {
    try {
      const wc = walletClient!;
      if (!wc || !waitingDuelId) return;
      const ok = await ensureCelo();
      if (!ok) return;
      if (!DUEL_CONTRACT_ADDRESS) { toast.error('Duel contract address not configured'); return; }
      await sendWithReferral(wc, DUEL_CONTRACT_ADDRESS, duelManagerAbi, 'cancelDuel', [waitingDuelId]);
      toast.success('Quick Match cancelled. Stake refunded.');
    } catch (e) {
      const msg = (e as any)?.shortMessage || (e as any)?.message || 'Failed to cancel duel';
      toast.error(msg);
    } finally {
      try { wsRef.current?.send({ type: 'leave_queue' }); } catch { }
      stopWaitingWatch?.();
      setStopWaitingWatch(null);
      setWaitingForMatch(false);
      setWaitingDuelId(null);
    }
  };

  const handleGameClick = (game: any) => {
    soundEffects.playClick();
    onStartGame(game.stake, game.player, game.id as `0x${string}`, true, false, selectedCategory);
  };

  const randomBytes32 = () => {
    const arr = new Uint8Array(32);
    crypto.getRandomValues(arr);
    return toHex(arr);
  };

  const createFriendDuel = async () => {
    try {
      soundEffects.playClick();
      if (!isConnected || !walletClient || !address) return;
      const wc = walletClient!;
      const stake = BigInt(Math.floor(STAKE_AMOUNT * 1e18)); // default stake in selected token
      const duelId = randomBytes32();
      // approve stake
      const ok = await ensureCelo();
      if (!ok) return;
      if (!DUEL_CONTRACT_ADDRESS) { toast.error('Duel contract address not configured'); return; }
      await sendWithReferral(wc, currentTokenAddress, erc20Abi, 'approve', [DUEL_CONTRACT_ADDRESS, stake]);
      await sendWithReferral(wc, DUEL_CONTRACT_ADDRESS, duelManagerAbi, 'createDuel', [duelId, stake, currentTokenAddress]);
      setInviteCode(duelId);
      setShowFriendPanel(true);
      toast.success('Friend duel code created');
      onStartGame(Number(stake) / 1e18, undefined, duelId as `0x${string}`, false, true, selectedCategory);
    } catch (e) {
      const msg = (e as any)?.shortMessage || (e as any)?.message || 'Failed to create friend duel';
      toast.error(msg);
    }
  };

  const shareInvite = async () => {
    try {
      if (!inviteCode) return;
      const url = new URL(window.location.href);
      url.searchParams.set('join-code', inviteCode);
      const shareUrl = url.toString();
      const shareData = { title: '10vote Duel Invite', text: `Join my duel on 10vote`, url: shareUrl };
      if ((navigator as any).share) {
        await (navigator as any).share(shareData);
      } else {
        await navigator.clipboard.writeText(shareUrl);
        toast.success('Invite link copied to clipboard');
      }
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const code = params.get('join-code') || params.get('join_code') || params.get('code');
      if (code) {
        setJoinCode(code);
        setShowFriendPanel(true);
      }
    } catch { }
  }, []);

  const joinWithCode = async () => {
    try {
      soundEffects.playClick();
      if (!isConnected || !walletClient || !joinCode) return;
      const wc = walletClient!;
      // approve stake equal to duel's stake? For simplicity assume same default stake amount
      const stake = BigInt(Math.floor(STAKE_AMOUNT * 1e18));
      const ok = await ensureCelo();
      if (!ok) return;
      if (!DUEL_CONTRACT_ADDRESS) { toast.error('Duel contract address not configured'); return; }
      await sendWithReferral(wc, currentTokenAddress, erc20Abi, 'approve', [DUEL_CONTRACT_ADDRESS, stake]);
      await sendWithReferral(wc, DUEL_CONTRACT_ADDRESS, duelManagerAbi, 'joinDuel', [joinCode as `0x${string}`]);
      toast.success('Joined duel. Starting…');
      onStartGame(Number(stake) / 1e18, undefined, joinCode as `0x${string}`, false, false, selectedCategory);
    } catch (e) {
      const msg = (e as any)?.shortMessage || (e as any)?.message || 'Failed to join duel';
      toast.error(msg);
    }
  };

  return (
    <div className="max-w-lg mx-auto px-4 py-6 relative">
      {/* Animated background */}
      <div className="absolute top-0 left-0 right-0 h-64 bg-gradient-to-b from-emerald-500/5 to-transparent pointer-events-none rounded-3xl blur-2xl" />
      {waitingForMatch && (
        <div className="absolute inset-0 z-50 bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-6">
          <Card className="bg-slate-900 border-slate-800 p-6 w-full max-w-md text-center">
            <div className="text-3xl mb-2 animate-pulse">⏳</div>
            <h3 className="text-white text-xl mb-1">Searching for opponent...</h3>
            <p className="text-slate-400 mb-2">
              {categories.find(c => c.id === selectedCategory)?.emoji} {categories.find(c => c.id === selectedCategory)?.name} • {selectedToken === 'cusd' ? `$${waitingStake.toFixed(2)} cUSD` : `${waitingStake} CELO (~$${(waitingStake * CELO_USD_RATE).toFixed(2)})`}
            </p>
            <div className="mb-4">
              <div className="text-sm text-slate-500 mb-2">Waiting: {waitingTime}s</div>
              {waitingTime >= 3 && (
                <div className="text-emerald-400 text-sm animate-pulse">
                  🤖 Computer opponent will join in {Math.max(0, 4 - waitingTime)}s...
                </div>
              )}
            </div>
            <div className="flex items-center justify-center gap-3">
              <Button onClick={cancelQuickMatch} variant="outline" className="border-slate-700 text-slate-300">Cancel</Button>
            </div>
          </Card>
        </div>
      )}

      {/* Daily Challenge Banner */}
      {!dailyChallenge.completed && (
        <Card className="mb-6 bg-gradient-to-r from-purple-500/20 via-pink-500/20 to-orange-500/20 border-2 border-purple-400/50 relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent animate-shimmer" />
          <div className="p-4 relative z-10">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="text-3xl">🎯</div>
                <div>
                  <div className="text-white font-bold text-lg">Daily Challenge</div>
                  <div className="text-slate-300 text-sm">{dailyChallenge.description}</div>
                  <div className="text-emerald-400 text-xs mt-1">Reward: ${dailyChallenge.reward.toFixed(2)} cUSD</div>
                </div>
              </div>
              <Badge className="bg-purple-500/30 text-purple-300 border-purple-400/50">
                {dailyChallenge.targetScore} correct
              </Badge>
            </div>
          </div>
        </Card>
      )}

      {/* Player Stats Summary */}
      {playerStats && playerStats.totalGames > 0 && (
        <Card className="mb-6 bg-slate-800/60 border-slate-700 p-4">
          <div className="grid grid-cols-4 gap-2 text-center">
            <div>
              <div className="text-slate-400 text-xs mb-1">Games</div>
              <div className="text-lg text-white font-bold">{playerStats.totalGames}</div>
            </div>
            <div>
              <div className="text-slate-400 text-xs mb-1">Wins</div>
              <div className="text-lg text-emerald-400 font-bold">{playerStats.wins}</div>
            </div>
            <div>
              <div className="text-slate-400 text-xs mb-1">Streak</div>
              <div className="text-lg text-yellow-400 font-bold">{playerStats.currentStreak}</div>
            </div>
            <div>
              <div className="text-slate-400 text-xs mb-1">Best</div>
              <div className="text-lg text-blue-400 font-bold">{playerStats.bestStreak}</div>
            </div>
          </div>
        </Card>
      )}

      {/* Header with crypto theme */}
      <div className="flex items-center justify-between mb-8 relative z-10">
        <div className="flex items-center gap-3">
          <div className="relative">
            <Avatar className="w-14 h-14 border-2 border-emerald-400 shadow-lg shadow-emerald-400/30">
              <AvatarImage src="" />
              <AvatarFallback className="bg-gradient-to-br from-emerald-600 to-emerald-700 text-white">YOU</AvatarFallback>
            </Avatar>
            <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-emerald-500 rounded-full border-2 border-slate-950 flex items-center justify-center">
              <Sparkles className="w-3 h-3 text-white" />
            </div>
          </div>
          <div>
            <div className="text-slate-400 text-sm flex items-center gap-1">
              <ImageWithFallback
                src="https://images.unsplash.com/photo-1626163015484-81fc7e3b90d8?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxjcnlwdG8lMjBjb2lucyUyMG1vbmV5fGVufDF8fHx8MTc2MDU1MDI3MXww&ixlib=rb-4.1.0&q=80&w=1080"
                alt="cUSD"
                className="w-4 h-4 rounded-full inline"
              />
              Your Balance
            </div>
            <div className="text-3xl text-emerald-400 drop-shadow-glow">
              {selectedToken === 'cusd' ? (
                <>${tokenBalance.toFixed(2)} cUSD</>
              ) : (
                <>
                  {tokenBalance.toFixed(4)} CELO <span className="text-slate-400 text-sm">(~${(tokenBalance * CELO_USD_RATE).toFixed(2)} USD)</span>
                </>
              )}
            </div>
            <div className="mt-2 flex gap-2">
              <Button 
                variant={selectedToken === 'cusd' ? 'default' : 'outline'} 
                onClick={() => {
                  soundEffects.playClick();
                  setSelectedToken('cusd');
                }} 
                className={`${selectedToken === 'cusd' ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-500/50' : 'border-slate-600 text-slate-400 hover:border-emerald-500 hover:text-emerald-400'} transition-all`}
              >
                <DollarSign className="w-4 h-4 mr-1" />
                cUSD
              </Button>
              <Button 
                variant={selectedToken === 'celo' ? 'default' : 'outline'} 
                onClick={() => {
                  soundEffects.playClick();
                  setSelectedToken('celo');
                }} 
                className={`${selectedToken === 'celo' ? 'bg-yellow-600 text-white shadow-lg shadow-yellow-500/50' : 'border-slate-600 text-slate-400 hover:border-yellow-500 hover:text-yellow-400'} transition-all`}
              >
                <Sparkles className="w-4 h-4 mr-1" />
                CELO
              </Button>
            </div>
            <Badge className="bg-emerald-400/15 text-emerald-300 border-emerald-400/30 mt-1">{currentTokenSymbol} • Celo Mainnet</Badge>
          </div>
        </div>
        <div className="text-4xl"><Swords className="w-10 h-10 text-slate-500" /></div>
      </div>

      {/* Category Selector - Gamy UI */}
      <div className="mb-6 relative z-10">
        <div className="flex items-center gap-2 mb-3">
          <Gamepad2 className="w-5 h-5 text-emerald-400" />
          <h3 className="text-white">Select Category</h3>
          <Sparkles className="w-4 h-4 text-yellow-400" />
        </div>
        <div className="grid grid-cols-4 gap-2">
          {categories.map((category) => {
            const isSelected = selectedCategory === category.id;
            return (
              <button
                key={category.id}
                onClick={() => {
                  soundEffects.playClick();
                  setSelectedCategory(category.id);
                }}
                className={`relative p-3 rounded-xl transition-all duration-300 transform ${isSelected
                    ? `bg-gradient-to-br ${category.gradient} shadow-xl scale-105`
                    : 'bg-slate-800/60 hover:bg-slate-700/80 hover:scale-105'
                  }`}
              >
                {isSelected && (
                  <>
                    <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-white/20 to-transparent animate-pulse" />
                    <div className="absolute -top-1 -right-1 w-5 h-5 bg-emerald-400 rounded-full flex items-center justify-center border-2 border-slate-950 shadow-lg">
                      <Sparkles className="w-3 h-3 text-white" />
                    </div>
                  </>
                )}
                <div className="relative z-10 flex flex-col items-center gap-1">
                  <span className="text-2xl drop-shadow-lg">{category.emoji}</span>
                  <span className={`text-xs ${isSelected ? 'text-white font-semibold' : 'text-slate-400'}`}>
                    {category.name}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Mode Toggle: 1v1 vs 2v2 - Improved Design */}
      <div className="mb-4 relative z-10">
        <div className="flex items-center gap-2 mb-2">
          <Swords className="w-4 h-4 text-emerald-400" />
          <h3 className="text-white text-sm font-semibold">Game Mode</h3>
        </div>
        <div className="relative bg-slate-800/60 p-1 rounded-xl border border-slate-700">
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              onClick={() => {
                soundEffects.playClick();
                setMatchMode('1v1');
              }}
              className={`flex-1 h-12 rounded-lg transition-all ${
                matchMode === '1v1' 
                  ? 'bg-gradient-to-r from-emerald-500 to-emerald-600 text-white shadow-lg shadow-emerald-500/50' 
                  : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
              }`}
            >
              <div className="flex items-center justify-center gap-2">
                <Swords className="w-4 h-4" />
                <span className="font-semibold">1v1 Duel</span>
              </div>
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                soundEffects.playClick();
                if (matchMode === '2v2') {
                  toast.message('2v2 squad mode is coming soon!');
                } else {
                  setMatchMode('2v2');
                }
              }}
              className={`flex-1 h-12 rounded-lg transition-all relative ${
                matchMode === '2v2' 
                  ? 'bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-lg shadow-purple-500/50' 
                  : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
              }`}
            >
              <div className="flex items-center justify-center gap-2">
                <Trophy className="w-4 h-4" />
                <span className="font-semibold">2v2 Squad</span>
                <Badge className="ml-1 bg-purple-500/30 text-purple-300 text-[10px] px-1 py-0">Soon</Badge>
              </div>
            </Button>
          </div>
        </div>
        <div className="mt-2 text-xs text-slate-400 flex items-center gap-1">
          {matchMode === '1v1' ? (
            <>
              <Sparkles className="w-3 h-3 text-emerald-400" />
              <span>Classic one-on-one battle mode</span>
            </>
          ) : (
            <>
              <Clock className="w-3 h-3 text-purple-400" />
              <span>Team up with a partner (coming soon)</span>
            </>
          )}
        </div>
      </div>

      {/* Main Action Button with gaming vibe */}
      <div className="mb-4 relative z-10">
        <Button
          onClick={() => {
            if (matchMode === '2v2') {
              toast.message('2v2 squad mode is coming soon');
              return;
            }
            handleQuickMatch();
          }}
          disabled={wsStatus !== 'open'}
          className="w-full h-28 bg-gradient-to-r from-emerald-500 via-emerald-600 to-emerald-500 hover:from-emerald-600 hover:via-emerald-700 hover:to-emerald-600 text-white shadow-2xl shadow-emerald-500/60 rounded-2xl text-2xl relative overflow-hidden group disabled:opacity-60 disabled:cursor-not-allowed"
        >
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent translate-x-[-200%] group-hover:translate-x-[200%] transition-transform duration-700" />
          <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAiIGhlaWdodD0iMjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMSIgY3k9IjEiIHI9IjEiIGZpbGw9InJnYmEoMjU1LDI1NSwyNTUsMC4xKSIvPjwvc3ZnPg==')] opacity-20" />
          <div className="flex items-center gap-4 relative z-10">
            <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center animate-pulse">
              <Zap className="w-7 h-7" fill="currentColor" />
            </div>
            <div className="text-left">
              <div className="flex items-center gap-2">
                <Zap className="w-5 h-5" /> <span>{matchMode === '2v2' ? 'Squad Match' : 'Quick Match'}</span>
              </div>
              <div className="text-sm opacity-90 flex items-center gap-1">
                <CategoryIcon id={selectedCategory} /> {categories.find(c => c.id === selectedCategory)?.name} • {selectedToken === 'cusd' ? `$${STAKE_AMOUNT.toFixed(2)} cUSD` : `${STAKE_AMOUNT} CELO (~$${(STAKE_AMOUNT * CELO_USD_RATE).toFixed(2)})`}
              </div>
            </div>
          </div>
        </Button>
      </div>

      {/* Practice Mode Button */}
      <div className="mb-4 relative z-10">
        <Button
          onClick={() => {
            soundEffects.playClick();
            onStartGame(0, undefined, undefined, false, false, selectedCategory);
          }}
          className="w-full h-16 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 hover:from-indigo-600 hover:via-purple-600 hover:to-pink-600 text-white shadow-xl shadow-purple-500/50 rounded-2xl text-lg relative overflow-hidden group"
        >
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent translate-x-[-200%] group-hover:translate-x-[200%] transition-transform duration-700" />
          <div className="flex items-center gap-3 relative z-10 justify-center">
            <Brain className="w-5 h-5" />
            <span>Practice Mode (Free)</span>
          </div>
        </Button>
      </div>

      {/* Play with a Friend Button */}
      <div className="mb-8 relative z-10 space-y-3">
        <Button
          onClick={() => setShowFriendPanel((v) => !v)}
          className="w-full h-20 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 hover:from-blue-600 hover:via-purple-600 hover:to-pink-600 text-white shadow-xl shadow-purple-500/50 rounded-2xl text-xl relative overflow-hidden group"
        >
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent translate-x-[-200%] group-hover:translate-x-[200%] transition-transform duration-700" />
          <div className="flex items-center gap-3 relative z-10">
            <div className="text-left">
              <div className="flex items-center gap-2">
                <span>Play with a Friend</span>
                <Target className="w-4 h-4" />
              </div>
              <div className="text-xs opacity-90">
                Create a duel or join by code
              </div>
            </div>
          </div>
        </Button>
        {showFriendPanel && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Button onClick={createFriendDuel} className="bg-gradient-to-r from-blue-600 to-purple-600 text-white">Create Duel Code</Button>
              {inviteCode && (
                <>
                  <Input readOnly value={inviteCode} className="bg-slate-800 border-slate-700 text-white font-mono text-xs" />
                  <Button onClick={() => navigator.clipboard.writeText(inviteCode)} variant="outline">Copy</Button>
                  <Button onClick={shareInvite} variant="outline">Share</Button>
                </>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Input placeholder="Paste duel code to join" value={joinCode} onChange={(e) => setJoinCode(e.target.value)} className="bg-slate-800 border-slate-700 text-white font-mono text-xs" />
              <Button onClick={joinWithCode} variant="outline">Join</Button>
            </div>
          </div>
        )}
      </div>

      {/* Open Games with images */}
      <div className="relative z-10">
        <div className="flex items-center gap-2 mb-4">
          <Gamepad2 className="w-6 h-6 text-emerald-400" />
          <h2 className="text-2xl text-white">Live Duels</h2>
          <Badge className="bg-red-500/20 text-red-400 border-red-400/30 animate-pulse">
            <span className="w-2 h-2 bg-red-400 rounded-full inline-block mr-1 animate-ping" />
            LIVE
          </Badge>
        </div>
        <div className="space-y-3">
          {liveDuels.length === 0 && (
            <Card className="bg-slate-800/60 border-slate-700 p-6 flex items-center gap-3 justify-center">
              <CircleSlash className="w-6 h-6 text-slate-400" />
              <span className="text-slate-400">No live duels right now</span>
            </Card>
          )}
          {liveDuels.map((game) => (
            <Card
              key={game.id as string}
              className="bg-slate-800/60 border-slate-700 hover:border-emerald-400/50 transition-all cursor-pointer overflow-hidden group hover:shadow-xl hover:shadow-emerald-500/20 backdrop-blur-sm hover:scale-[1.02]"
              onClick={() => handleGameClick(game)}
            >
              <div className="flex items-center gap-0 relative">
                {/* Category Image */}
                <div className="w-24 h-24 relative overflow-hidden flex-shrink-0">
                  <ImageWithFallback
                    src={game.image}
                    alt={game.category}
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                  />
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent to-slate-800/60" />
                </div>

                {/* Game Info */}
                <div className="flex-1 p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Avatar className="w-12 h-12 border-2 border-emerald-400/50 shadow-lg">
                      <AvatarFallback className="bg-gradient-to-br from-slate-700 to-slate-800 text-emerald-400">
                        {game.avatar}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <div className="text-white flex items-center gap-2">
                        {game.player}
                        <Swords className="w-3 h-3 text-slate-400" />
                      </div>
                      <div className="text-emerald-400 text-sm">{game.category}</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <Badge className="bg-gradient-to-r from-emerald-400/30 to-emerald-500/20 text-emerald-400 border-emerald-400/50 shadow-lg px-3 py-1">
                      <DollarSign className="w-3 h-3" /> ${Number(game.stake).toFixed(2)}
                    </Badge>
                    <div className="text-slate-500 text-xs mt-1 flex items-center gap-1 justify-end">
                      <Clock className="w-3 h-3" />
                      2m ago
                    </div>
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}

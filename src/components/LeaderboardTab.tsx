import { useEffect, useMemo, useState } from 'react';
import { Trophy, Medal, Crown, TrendingUp, Sparkles } from 'lucide-react';
import { Avatar, AvatarFallback } from './ui/avatar';
import { Card } from './ui/card';
import { Badge } from './ui/badge';
import { Tabs, TabsList, TabsTrigger } from './ui/tabs';
import { soundEffects } from '../utils/soundEffects';
import { viemPublicClient, DUEL_CONTRACT_ADDRESS } from '../lib/blockchain';
import { duelManagerAbi } from '../abi/duelManager';
import { useSelf } from '../lib/self';
import { useAccount } from 'wagmi';

type Period = 'daily' | 'weekly' | 'alltime';

export function LeaderboardTab() {
  const [period, setPeriod] = useState<Period>('weekly');
  type PlayerStat = { address: string; wins: number; losses: number; winnings: number; totalStaked: number };
  const [players, setPlayers] = useState<PlayerStat[]>([]);
  const { verification } = useSelf();

  useEffect(() => {
    let cancelled = false;
    async function fetchLeaderboard() {
      try {
        const latest = await viemPublicClient.getBlockNumber();
        const windowBlocks = period === 'daily' ? 17280n : period === 'weekly' ? 120960n : 500000n;
        const fromBlock = latest > windowBlocks ? latest - windowBlocks : 0n;
        const createdLogs = await viemPublicClient.getContractEvents({ address: DUEL_CONTRACT_ADDRESS, abi: duelManagerAbi, eventName: 'DuelCreated', fromBlock, toBlock: latest });
        const joinedLogs = await viemPublicClient.getContractEvents({ address: DUEL_CONTRACT_ADDRESS, abi: duelManagerAbi, eventName: 'DuelJoined', fromBlock, toBlock: latest });
        const addresses = new Set<string>();
        createdLogs.forEach((l: any) => addresses.add(String(l.args.player1)));
        joinedLogs.forEach((l: any) => addresses.add(String(l.args.player2)));
        const stats: PlayerStat[] = [];
        for (const addr of addresses) {
          const s: any = await viemPublicClient.readContract({ address: DUEL_CONTRACT_ADDRESS, abi: duelManagerAbi, functionName: 'stats', args: [addr as `0x${string}`] });
          stats.push({ address: addr, wins: Number(s.wins ?? s[0] ?? 0), losses: Number(s.losses ?? s[1] ?? 0), winnings: Number(s.winnings ?? s[2] ?? 0) / 1e18, totalStaked: Number(s.totalStaked ?? s[3] ?? 0) / 1e18 });
        }
        if (!cancelled) setPlayers(stats.sort((a, b) => b.winnings - a.winnings));
      } catch (e) {
        console.error(e);
      }
    }
    fetchLeaderboard();
    const unwatchConfirm = viemPublicClient.watchContractEvent({ address: DUEL_CONTRACT_ADDRESS, abi: duelManagerAbi, eventName: 'ResultConfirmed', onLogs: () => fetchLeaderboard() });
    return () => { cancelled = true; unwatchConfirm?.(); };
  }, [period]);

  const { address } = useAccount();
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const isAddressVerified = (addr: string) => !!(verification?.isHumanVerified && address && addr.toLowerCase() === address.toLowerCase());
  const filteredPlayers = useMemo(() => verifiedOnly ? players.filter(p => isAddressVerified(p.address)) : players, [players, verifiedOnly, verification, address]);
  const topThree = filteredPlayers.slice(0, 3);
  const others = filteredPlayers.slice(3, 8).map((p, i) => ({ ...p, rank: i + 4 }));
  const prize = period === 'daily' ? 25 : period === 'weekly' ? 100 : 500;
  const userRank = 0;
  const userWinnings = 0;


  useEffect(() => {
    let cancelled = false;
    async function fetchLeaderboard() {
      try {
        const latest = await viemPublicClient.getBlockNumber();
        const windowBlocks = period === 'daily' ? 17280n : period === 'weekly' ? 120960n : 500000n;
        const fromBlock = latest > windowBlocks ? latest - windowBlocks : 0n;
        const createdLogs = await viemPublicClient.getContractEvents({ address: DUEL_CONTRACT_ADDRESS, abi: duelManagerAbi, eventName: 'DuelCreated', fromBlock, toBlock: latest });
        const joinedLogs = await viemPublicClient.getContractEvents({ address: DUEL_CONTRACT_ADDRESS, abi: duelManagerAbi, eventName: 'DuelJoined', fromBlock, toBlock: latest });
        const addresses = new Set<string>();
        createdLogs.forEach((l: any) => addresses.add(String(l.args.player1)));
        joinedLogs.forEach((l: any) => addresses.add(String(l.args.player2)));
        const stats: PlayerStat[] = [];
        for (const addr of addresses) {
          const s: any = await viemPublicClient.readContract({ address: DUEL_CONTRACT_ADDRESS, abi: duelManagerAbi, functionName: 'stats', args: [addr as `0x${string}`] });
          stats.push({ address: addr, wins: Number(s.wins ?? s[0] ?? 0), losses: Number(s.losses ?? s[1] ?? 0), winnings: Number(s.winnings ?? s[2] ?? 0) / 1e18, totalStaked: Number(s.totalStaked ?? s[3] ?? 0) / 1e18 });
        }
        if (!cancelled) setPlayers(stats.sort((a, b) => b.winnings - a.winnings));
      } catch (e) {
        console.error(e);
      }
    }
    fetchLeaderboard();
    const unwatchConfirm = viemPublicClient.watchContractEvent({ address: DUEL_CONTRACT_ADDRESS, abi: duelManagerAbi, eventName: 'ResultConfirmed', onLogs: () => fetchLeaderboard() });
    return () => { cancelled = true; unwatchConfirm?.(); };
  }, [period]);

  return (
    <div className="max-w-lg mx-auto px-4 py-6 relative">
      {/* Animated background */}
      <div className="absolute top-10 right-10 w-32 h-32 bg-yellow-500/10 rounded-full blur-3xl animate-pulse" />
      <div className="absolute bottom-20 left-10 w-40 h-40 bg-emerald-500/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
      
      {/* Header */}
      <div className="text-center mb-2 relative z-10">
        <div className="flex items-center justify-center gap-2 mb-2">
          <Trophy className="w-10 h-10 text-yellow-400 drop-shadow-glow animate-bounce" />
          <h1 className="text-4xl text-white drop-shadow-lg">Leaderboard</h1>
          <Sparkles className="w-6 h-6 text-emerald-400" />
        </div>
        <p className="text-slate-400 text-lg">🏆 Compete for bonus prizes</p>
      </div>
      <div className="flex items-center justify-center mb-6 gap-2">
        {verification?.isHumanVerified ? (
          <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-400/30">Verified Player</Badge>
        ) : (
          <Badge className="bg-amber-500/20 text-amber-400 border-amber-400/30">Unverified (verify in Wallet tab)</Badge>
        )}
      </div>

      {/* Period Toggle */}
      <Tabs value={period} onValueChange={(v) => { soundEffects.playClick(); setPeriod(v as Period); }} className="mb-6 relative z-10">
        <TabsList className="grid w-full grid-cols-3 bg-slate-800/80 border-2 border-slate-700 backdrop-blur-sm">
          <TabsTrigger
            value="daily"
            className="text-white data-[state=active]:bg-gradient-to-r data-[state=active]:from-emerald-500 data-[state=active]:to-emerald-600 data-[state=active]:text-white"
          >
            📅 Daily
          </TabsTrigger>
          <TabsTrigger
            value="weekly"
            className="text-white data-[state=active]:bg-gradient-to-r data-[state=active]:from-emerald-500 data-[state=active]:to-emerald-600 data-[state=active]:text-white"
          >
            📊 Weekly
          </TabsTrigger>
          <TabsTrigger
            value="alltime"
            className="text-white data-[state=active]:bg-gradient-to-r data-[state=active]:from-emerald-500 data-[state=active]:to-emerald-600 data-[state=active]:text-white"
          >
            ⭐ All-Time
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Prize Pool */}
      <Card className="bg-gradient-to-br from-yellow-500/30 to-yellow-600/20 border-2 border-yellow-400/70 mb-6 p-6 shadow-2xl shadow-yellow-500/30 relative overflow-hidden z-10">
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent animate-shimmer" />
        <div className="text-center relative z-10">
          <div className="text-yellow-300 text-sm mb-2 flex items-center justify-center gap-2">
            <Sparkles className="w-4 h-4" />
            Bonus Prize Pool
            <Sparkles className="w-4 h-4" />
          </div>
          <div className="text-5xl text-yellow-400 drop-shadow-lg mb-2">💰 ${prize} cUSD</div>
          <div className="text-yellow-200 text-sm">Split among top 3 players</div>
        </div>
      </Card>

      {/* Top 3 */}
      <div className="mb-6 relative z-10">
        <div className="grid grid-cols-3 gap-3 mb-4">
          {/* 2nd Place */}
          <div className="pt-8">
            <Card className="bg-slate-800/60 border-slate-600 p-3 text-center backdrop-blur-sm hover:scale-105 transition-transform">
              <div className="relative">
                <Avatar className="w-16 h-16 mx-auto mb-2 border-2 border-slate-400 shadow-lg">
                  <AvatarFallback className="bg-gradient-to-br from-slate-700 to-slate-800 text-white">
                    {topThree[1]?.address ? topThree[1].address.slice(2,4).toUpperCase() : '--'}
                  </AvatarFallback>
                </Avatar>
                <div className="absolute -top-2 left-1/2 transform -translate-x-1/2 w-8 h-8 bg-slate-600 rounded-full flex items-center justify-center border-2 border-slate-400 shadow-lg">
                  <span className="text-lg">🥈</span>
                </div>
              </div>
              <div className="text-white text-sm truncate mb-1">{topThree[1]?.address ?? '—'}</div>
              <div className="text-emerald-400">${topThree[1]?.winnings.toFixed(2) ?? '0.00'}</div>
              <div className="text-slate-400 text-xs">{topThree[1]?.wins ?? 0}W-{topThree[1]?.losses ?? 0}L</div>
            </Card>
          </div>

          {/* 1st Place */}
          <div>
            <Card className="bg-gradient-to-br from-yellow-500/30 to-yellow-600/20 border-2 border-yellow-400 p-3 text-center shadow-2xl shadow-yellow-500/40 hover:scale-110 transition-transform relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent animate-shimmer" />
              <div className="relative z-10">
                <Avatar className="w-20 h-20 mx-auto mb-2 border-2 border-yellow-400 shadow-xl shadow-yellow-500/50">
                  <AvatarFallback className="bg-gradient-to-br from-yellow-600 to-yellow-700 text-white">
                    {topThree[0]?.address ? topThree[0].address.slice(2,4).toUpperCase() : '--'}
                  </AvatarFallback>
                </Avatar>
                <div className="absolute -top-2 left-1/2 transform -translate-x-1/2 w-10 h-10 bg-gradient-to-br from-yellow-400 to-yellow-500 rounded-full flex items-center justify-center border-2 border-yellow-300 shadow-xl shadow-yellow-500/50 animate-pulse">
                  <span className="text-2xl">👑</span>
                </div>
              </div>
              <div className="text-white truncate mb-1 relative z-10">{topThree[0]?.address ?? '—'}</div>
              <div className="text-yellow-400 text-xl drop-shadow-lg relative z-10">${topThree[0]?.winnings.toFixed(2) ?? '0.00'}</div>
              <div className="text-slate-400 text-xs relative z-10">{topThree[0]?.wins ?? 0}W-{topThree[0]?.losses ?? 0}L</div>
            </Card>
          </div>

          {/* 3rd Place */}
          <div className="pt-8">
            <Card className="bg-slate-800/60 border-amber-700 p-3 text-center backdrop-blur-sm hover:scale-105 transition-transform">
              <div className="relative">
                <Avatar className="w-16 h-16 mx-auto mb-2 border-2 border-amber-700 shadow-lg">
                  <AvatarFallback className="bg-gradient-to-br from-slate-700 to-slate-800 text-white">
                    {topThree[2]?.address ? topThree[2].address.slice(2,4).toUpperCase() : '--'}
                  </AvatarFallback>
                </Avatar>
                <div className="absolute -top-2 left-1/2 transform -translate-x-1/2 w-8 h-8 bg-amber-700 rounded-full flex items-center justify-center border-2 border-amber-600 shadow-lg">
                  <span className="text-lg">🥉</span>
                </div>
              </div>
              <div className="text-white text-sm truncate mb-1">{topThree[2]?.address ?? '—'}</div>
              <div className="text-emerald-400">${topThree[2]?.winnings.toFixed(2) ?? '0.00'}</div>
              <div className="text-slate-400 text-xs">{topThree[2]?.wins ?? 0}W-{topThree[2]?.losses ?? 0}L</div>
            </Card>
          </div>
        </div>
      </div>

      {/* Ranked List */}
      <div className="space-y-2 mb-6 relative z-10">
        {others.map((player) => (
          <Card key={player.rank} className="bg-slate-800/60 border-slate-700 p-4 hover:border-emerald-400/30 transition-all hover:scale-[1.02] backdrop-blur-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="text-2xl text-slate-500 w-10 h-10 flex items-center justify-center bg-slate-700/50 rounded-lg">
                  {player.rank}
                </div>
                <Avatar className="w-10 h-10 border border-emerald-400/30">
                  <AvatarFallback className="bg-gradient-to-br from-slate-700 to-slate-800 text-emerald-400">
                    {player.address.slice(2,4).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <div className="text-white flex items-center gap-2">
                    <span>{player.address}</span>
                    {isAddressVerified(player.address) && (
                      <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-400/30">Verified</Badge>
                    )}
                  </div>
                  <div className="text-slate-400 text-sm">⚔️ {player.wins}W-{player.losses}L</div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-emerald-400 text-lg">💰 ${player.winnings.toFixed(2)}</div>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* My Rank Card */}
      <Card className="bg-gradient-to-br from-emerald-500/30 to-emerald-600/20 border-2 border-emerald-400/70 p-5 sticky bottom-24 shadow-2xl shadow-emerald-500/30 backdrop-blur-sm relative overflow-hidden z-10">
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent animate-shimmer" />
        <div className="flex items-center justify-between relative z-10">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 bg-emerald-400/20 px-3 py-2 rounded-lg">
              <TrendingUp className="w-6 h-6 text-emerald-400 animate-bounce" />
              <div className="text-3xl text-emerald-400 drop-shadow-glow">#{userRank}</div>
            </div>
            <div>
              <div className="text-white flex items-center gap-1">
                🎯 Your Rank
              </div>
              <div className="text-emerald-300 text-sm">{period === 'daily' ? '📅 Today' : period === 'weekly' ? '📊 This Week' : '⭐ All Time'}</div>
            </div>
          </div>
          <div className="text-right">
            <div className="text-emerald-400 text-2xl drop-shadow-lg">💰 ${userWinnings.toFixed(2)}</div>
            <Badge className="bg-emerald-400/30 text-emerald-300 border-emerald-400/50 mt-1 px-3 py-1">
              🚀 Keep climbing!
            </Badge>
          </div>
        </div>
      </Card>
    </div>
  );
}

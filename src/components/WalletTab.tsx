import { useMemo, useState, useEffect } from 'react';
import { ArrowDownToLine, ArrowUpFromLine, Copy, Check, TrendingUp, TrendingDown, DollarSign } from 'lucide-react';
import { Button } from './ui/button';
import { Card } from './ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Badge } from './ui/badge';
import { ImageWithFallback } from './figma/ImageWithFallback';
import { soundEffects } from '../utils/soundEffects';
import { useAccount, useDisconnect, useWalletClient } from 'wagmi';
import { useQuery } from '@tanstack/react-query';
import { erc20Abi } from '../abi/duelManager';
import { CUSD_ADDRESS, viemPublicClient } from '../lib/blockchain';
import { createPublicClient, http, encodeFunctionData } from 'viem';
import { celoChain } from '../lib/blockchain';
import { toast } from 'sonner';
import { useSelf } from '../lib/self';
import { getUniversalLink } from '@selfxyz/core';
import { SelfQRcodeWrapper, SelfAppBuilder, type SelfApp } from '@selfxyz/qrcode';
import { ethers } from 'ethers';
import { getReferralTag, submitReferral } from '@divvi/referral-sdk';

interface WalletTabProps {
  userBalance: number;
  onBalanceChange: (newBalance: number) => void;
}

export function WalletTab({ userBalance, onBalanceChange }: WalletTabProps) {
  const [copied, setCopied] = useState(false);
  const [depositDialogOpen, setDepositDialogOpen] = useState(false);
  const [withdrawDialogOpen, setWithdrawDialogOpen] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [withdrawAddress, setWithdrawAddress] = useState('');
  const [verifyDialogOpen, setVerifyDialogOpen] = useState(false);
  const [proofToken, setProofToken] = useState('');
  const { address, isConnected } = useAccount();
  const { disconnect } = useDisconnect();
  const { data: walletClient } = useWalletClient();
  const { verification, verifyWithProof, logoutSelf } = useSelf();
  const [selfApp, setSelfApp] = useState<SelfApp | null>(null);
  const [universalLink, setUniversalLink] = useState('');
  const publicClient = useMemo(() => createPublicClient({ chain: celoChain, transport: http(import.meta.env.VITE_CELO_HTTP_RPC_URL as string) }), []);
  const shortAddress = (addr?: string) => (addr ? `${addr.slice(0, 6)}…${addr.slice(-4)}` : '');
  const shortHex = (hex?: string) => (hex ? `${hex.slice(0, 10)}…${hex.slice(-8)}` : '');

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

  const { data: transactions } = useQuery({
    queryKey: ['recent-tx', address],
    queryFn: async () => {
      if (!address) return [] as any[];
      const res = await fetch(`/api/celo/txlist?address=${address}&sort=desc`);
      const json = await res.json();
      if (json.result && Array.isArray(json.result)) return json.result.slice(0, 10);
      return [] as any[];
    },
    enabled: !!address,
    refetchInterval: 30000,
  });

  const copyAddress = () => {
    if (!address) return;
    navigator.clipboard.writeText(address);
    soundEffects.playClick();
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDeposit = () => {
    // Simulate deposit
    setDepositDialogOpen(false);
  };

  const handleWithdraw = async () => {
    const amount = parseFloat(withdrawAmount);
    const available = isConnected ? (cusdBalance ?? 0) : userBalance;
    const wc = walletClient;
    if (!isConnected || !wc) return;
    if (amount > 0 && amount <= available && withdrawAddress) {
      try {
        const value = BigInt(Math.floor(amount * 1e18));
        await sendWithReferral(wc, CUSD_ADDRESS as `0x${string}`, erc20Abi, 'transfer', [withdrawAddress as `0x${string}`, value]);
        setWithdrawDialogOpen(false);
        setWithdrawAmount('');
        setWithdrawAddress('');
        toast.success('Withdrawal transaction submitted');
      } catch (e) {
        const msg = (e as any)?.shortMessage || (e as any)?.message || 'Withdrawal failed';
        toast.error(msg);
      }
    }
  };

  useEffect(() => {
    try {
      const app = new SelfAppBuilder({
        version: 2,
        appName: import.meta.env.VITE_SELF_APP_NAME || '10vote',
        scope: import.meta.env.VITE_SELF_SCOPE || '10vote',
        endpoint: import.meta.env.VITE_SELF_ENDPOINT || `${window.location.origin}/api/self/verify`,
        logoBase64: import.meta.env.VITE_SELF_LOGO || 'https://i.postimg.cc/mrmVf9hm/self.png',
        userId: (address as string) || ethers.ZeroAddress,
        endpointType: import.meta.env.VITE_SELF_ENDPOINT_TYPE || 'staging_https',
        userIdType: 'hex',
        userDefinedData: '10vote',
        disclosures: {
          minimumAge: 18,
          nationality: true,
          gender: true,
        },
      }).build();
      setSelfApp(app);
      setUniversalLink(getUniversalLink(app));
    } catch (error) {
      console.error('Failed to initialize Self app:', error);
    }
  }, [address]);

  return (
    <div className="max-w-lg mx-auto px-4 py-6 relative">
      <div className="">
      {/* Crypto background image */}
      <div className="absolute top-0 left-0 right-0 h-64 overflow-hidden opacity-10 rounded-3xl blur-sm pointer-events-none">
        <ImageWithFallback
          src="https://images.unsplash.com/photo-1626163015484-81fc7e3b90d8?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxjcnlwdG8lMjBjb2lucyUyMG1vbmV5fGVufDF8fHx8MTc2MDU1MDI3MXww&ixlib=rb-4.1.0&q=80&w=1080"
          alt="Crypto background"
          className="w-full h-full object-cover"
        />
      </div>
      
      {/* Wallet Connect */}
      <div className="flex items-center justify-between mb-4">
        {isConnected ? (
          <div className="text-sm text-slate-300 flex items-center gap-3 min-w-0">
            <span className="font-mono block flex-1 min-w-0 truncate" title={address || ''}>{shortAddress(address)}</span>
            <Button variant="outline" onClick={() => disconnect()}>Disconnect</Button>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-slate-400">
            <span>Connect your wallet to manage funds.</span>
          </div>
        )}
      </div>

      {/* Self Verification */}
      <div className="flex items-center justify-between mb-6">
        {verification?.isHumanVerified ? (
          <div className="flex items-center gap-3">
            <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-400/30">Verified Human ✅</Badge>
            {verification?.ageOver21 ? (
              <Badge className="bg-sky-500/20 text-sky-400 border-sky-400/30">Age 21+</Badge>
            ) : verification?.ageOver18 ? (
              <Badge className="bg-sky-500/20 text-sky-400 border-sky-400/30">Age 18+</Badge>
            ) : null}
            <Button variant="outline" onClick={() => logoutSelf()}>Clear Verification</Button>
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <Badge className="bg-amber-500/20 text-amber-400 border-amber-400/30">Unverified</Badge>
            <Dialog open={verifyDialogOpen} onOpenChange={setVerifyDialogOpen}>
              <DialogTrigger asChild>
                <Button className="bg-emerald-500 hover:bg-emerald-600">Sign in with Self</Button>
              </DialogTrigger>
              <DialogContent className="bg-slate-900 border-slate-700 text-white w-[92vw] max-w-sm sm:max-w-md">
                <DialogHeader>
                  <DialogTitle className="text-emerald-400">Verify with Self Protocol</DialogTitle>
                </DialogHeader>
                <div className="space-y-3">
                  <p className="text-sm text-slate-400">
                    Scan the QR code with the Self app, or paste a proof token (JWT) below.
                    If redirected back with <code>?self_jwt=</code>, it will be captured automatically.
                  </p>
                  {selfApp ? (
                    <div className="flex flex-col items-center gap-2">
                      <SelfQRcodeWrapper
                        selfApp={selfApp}
                        onSuccess={() => {
                          toast.success('Self verification complete');
                          verifyWithProof('verified-via-qr');
                          setVerifyDialogOpen(false);
                        }}
                        onError={() => {
                          toast.error('Error: Failed to verify identity');
                        }}
                      />
                      {universalLink ? (
                        <a href={universalLink} target="_blank" rel="noreferrer" className="text-xs text-emerald-400 underline">
                          Open in Self App
                        </a>
                      ) : null}
                    </div>
                  ) : (
                    <div>Loading QR Code...</div>
                  )}
                  <Label className="text-slate-300">Self Proof Token</Label>
                  <Input value={proofToken} onChange={(e) => setProofToken(e.target.value)} placeholder="eyJhbGciOi..." className="bg-slate-800 border-slate-700 text-slate-300" />
                  <div className="flex gap-3">
                    <Button onClick={() => { if (proofToken.trim()) { verifyWithProof(proofToken.trim()); setVerifyDialogOpen(false); setProofToken(''); toast.success('Verification saved'); } }} className="bg-emerald-500 hover:bg-emerald-600">Verify</Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        )}
      </div>

      </div>

      {/* Balance Header */}
      <div className="text-center mb-8 relative z-10">
        <div className="text-slate-400 mb-2 flex items-center justify-center gap-2">
          💰 Total Available Balance
        </div>
        <div className="text-7xl text-emerald-400 mb-6 drop-shadow-glow animate-pulse">
          ${isConnected ? (cusdBalance ?? 0).toFixed(2) : userBalance.toFixed(2)}
        </div>
        <Badge className="bg-emerald-400/20 text-emerald-400 border-emerald-400/30 px-4 py-2">
          cUSD on Celo Network 🌐
        </Badge>
      </div>

      {/* Action Buttons */}
      <div className="grid grid-cols-2 gap-4 mb-8 relative z-10">
        <Dialog open={depositDialogOpen} onOpenChange={setDepositDialogOpen}>
          <DialogTrigger asChild>
            <Button 
              onClick={() => soundEffects.playClick()}
              className="h-16 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white rounded-xl text-lg shadow-lg shadow-emerald-500/30 hover:scale-105 transition-transform"
            >
              <ArrowDownToLine className="w-5 h-5 mr-2" />
              Deposit
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-slate-900 border-slate-700 text-white w-[92vw] max-w-sm sm:max-w-md overflow-x-hidden">
            <DialogHeader>
              <DialogTitle className="text-2xl text-emerald-400">Deposit cUSD</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label className="text-slate-300">Your Celo Address</Label>
                <div className="flex items-center gap-2 mt-2 min-w-0">
                  <Input
                    value={address || ''}
                    readOnly
                    className="bg-slate-800 border-slate-700 text-slate-300 font-mono text-sm truncate min-w-0 flex-1"
                  />
                  <Button
                    onClick={copyAddress}
                    variant="outline"
                    size="icon"
                    className="border-slate-700 hover:bg-slate-800 shrink-0"
                  >
                    {copied ? (
                      <Check className="w-4 h-4 text-emerald-400" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </Button>
                </div>
              </div>
              <div className="bg-slate-800 rounded-lg p-4 text-sm text-slate-400">
                <p>Send cUSD to this address on the Celo network. Your balance will update automatically once the transaction is confirmed.</p>
              </div>
              <Button
                onClick={handleDeposit}
                className="w-full bg-emerald-500 hover:bg-emerald-600"
              >
                Done
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={withdrawDialogOpen} onOpenChange={setWithdrawDialogOpen}>
          <DialogTrigger asChild>
            <Button
              onClick={() => soundEffects.playClick()}
              variant="outline"
              className="h-16 border-2 border-emerald-400/40 bg-emerald-400/10 hover:bg-emerald-400/20 text-emerald-400 rounded-xl text-lg hover:scale-105 transition-transform backdrop-blur-sm"
            >
              <ArrowUpFromLine className="w-5 h-5 mr-2" />
              Withdraw
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-slate-900 border-slate-700 text-white w-[92vw] max-w-sm sm:max-w-md overflow-x-hidden">
            <DialogHeader>
              <DialogTitle className="text-2xl text-emerald-400">Withdraw cUSD</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="bg-slate-800 rounded-lg p-4 text-sm text-slate-300">
                <p className="mb-2">Your funds are automatically held in your connected Celo wallet.</p>
                <p className="mb-2">To withdraw to another address or exchange, open your wallet (e.g., Valora, MetaMask) and send cUSD directly from there.</p>
                <p className="text-slate-400">This app does not custody funds and does not process withdrawals on your behalf.</p>
              </div>
              <div>
                <Label className="text-slate-300">Your Celo Address</Label>
                <div className="flex items-center gap-2 mt-2 min-w-0">
                  <Input
                    value={address || ''}
                    readOnly
                    className="bg-slate-800 border-slate-700 text-slate-300 font-mono text-xs truncate min-w-0 flex-1"
                  />
                  <Button
                    onClick={copyAddress}
                    variant="outline"
                    size="icon"
                    className="border-slate-700 hover:bg-slate-800 shrink-0"
                  >
                    {copied ? (
                      <Check className="w-4 h-4 text-emerald-400" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </Button>
                </div>
              </div>
              <div className="flex">
                <Button onClick={() => setWithdrawDialogOpen(false)} className="w-full bg-emerald-500 hover:bg-emerald-600">
                  Got it
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Transaction History */}
      <div className="relative z-10">
        <h2 className="text-xl text-white mb-4 flex items-center gap-2">
          📋 Transaction History
        </h2>
        <div className="space-y-2">
          {(transactions || []).map((tx: any) => (
            <Card key={tx.hash} className="bg-slate-800/60 border-slate-700 p-4 hover:border-emerald-400/30 transition-all hover:scale-[1.01] backdrop-blur-sm">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`${tx.from?.toLowerCase() === address?.toLowerCase() ? 'bg-red-500/20' : 'bg-emerald-500/20'} w-10 h-10 rounded-full flex items-center justify-center`}>
                    {tx.from?.toLowerCase() === address?.toLowerCase() ? (
                      <ArrowUpFromLine className="w-5 h-5 text-red-400" />
                    ) : (
                      <ArrowDownToLine className="w-5 h-5 text-emerald-400" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="text-white font-mono truncate max-w-[220px] min-w-0" title={tx.hash}>{shortHex(tx.hash)}</div>
                    <div className="text-slate-400 text-sm">Block {tx.blockNumber}</div>
                  </div>
                </div>
                <a href={`https://explorer.celo.org/mainnet/tx/${tx.hash}`} target="_blank" className="text-emerald-400 text-xs underline shrink-0">View</a>
              </div>
            </Card>
          ))}
          {!isConnected && (
            <div className="text-slate-400 text-sm">Connect your wallet to load recent transactions.</div>
          )}
        </div>
      </div>
    </div>
  );
}

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
  try { await viemPublicClient.waitForTransactionReceipt({ hash: txHash }); } catch {}
  try { await submitReferral({ txHash, chainId }); } catch {}
  return txHash;
}

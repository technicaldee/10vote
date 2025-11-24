/// <reference types="vite/client" />
import { useState, useEffect, useRef } from 'react';
import { useAccount, useWalletClient } from 'wagmi';
import { Clock, Check, X, Sparkles } from 'lucide-react';
import { Avatar, AvatarFallback } from './ui/avatar';
import { Button } from './ui/button';
import { Progress } from './ui/progress';
import { soundEffects } from '../utils/soundEffects';
import { AbstractArt } from './AbstractArt';
import { selectQuestions, DEFAULT_QUESTION_COUNT, NormalizedQuestion } from '../lib/questions';
import { useSelf } from '../lib/self';
import { toast } from 'sonner';
import { getWebSocketUrl, StableWebSocket } from '../lib/websocket';
import { DUEL_CONTRACT_ADDRESS, celoChain } from '../lib/blockchain';
import { duelManagerAbi } from '../abi/duelManager';
import { encodeFunctionData } from 'viem';
import { getReferralTag, submitReferral } from '@divvi/referral-sdk';

interface GameDuelScreenProps {
  stake: number;
  opponent?: string;
  duelId?: string;
  spectator?: boolean;
  creator?: boolean;
  category?: string;
  onGameFinish: (won: boolean, correctAnswers: number, totalQuestions: number, prize: number) => void;
}

const mockQuestions = [
  {
    question: "What is the capital of France?",
    options: ["London", "Berlin", "Paris", "Madrid"],
    correct: 2,
    image: "https://images.unsplash.com/photo-1570097703229-b195d6dd291f?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxlaWZmZWwlMjB0b3dlciUyMHBhcmlzfGVufDF8fHx8MTc2MDUxNDYwNHww&ixlib=rb-4.1.0&q=80&w=1080",
  },
  {
    question: "Which planet is known as the Red Planet?",
    options: ["Venus", "Mars", "Jupiter", "Saturn"],
    correct: 1,
    image: "https://images.unsplash.com/photo-1647323968696-0ea09525407c?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxtYXJzJTIwcGxhbmV0JTIwc3BhY2V8ZW58MXx8fHwxNzYwNDg2NTE5fDA&ixlib=rb-4.1.0&q=80&w=1080",
  },
  {
    question: "Who painted the Mona Lisa?",
    options: ["Van Gogh", "Picasso", "Leonardo da Vinci", "Michelangelo"],
    correct: 2,
    image: "https://images.unsplash.com/photo-1423742774270-6884aac775fa?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxtb25hJTIwbGlzYSUyMHBhaW50aW5nfGVufDF8fHx8MTc2MDUzMjAzMHww&ixlib=rb-4.1.0&q=80&w=1080",
  },
  {
    question: "What is the largest ocean on Earth?",
    options: ["Atlantic", "Indian", "Arctic", "Pacific"],
    correct: 3,
    image: "https://images.unsplash.com/photo-1629499987313-e14f1fd6a58b?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxvY2VhbiUyMHdhdmVzJTIwcGFjaWZpY3xlbnwxfHx8fDE3NjA1NTAyNjh8MA&ixlib=rb-4.1.0&q=80&w=1080",
  },
  {
    question: "In what year did World War II end?",
    options: ["1943", "1944", "1945", "1946"],
    correct: 2,
    image: "https://images.unsplash.com/photo-1596489408595-7e85d8650cf8?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHx3b3JsZCUyMHdhciUyMG1lbW9yaWFsfGVufDF8fHx8MTc2MDUyOTE5NHww&ixlib=rb-4.1.0&q=80&w=1080",
  },
  {
    question: "What is the smallest prime number?",
    options: ["0", "1", "2", "3"],
    correct: 2,
    image: "https://images.unsplash.com/photo-1653361860636-36f2fb89eab9?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxtYXRoZW1hdGljcyUyMG51bWJlcnN8ZW58MXx8fHwxNzYwNTUwMjY5fDA&ixlib=rb-4.1.0&q=80&w=1080",
  },
  {
    question: "Which element has the chemical symbol 'O'?",
    options: ["Gold", "Oxygen", "Osmium", "Oganesson"],
    correct: 1,
    image: "https://images.unsplash.com/photo-1614934273187-c83f8780fad9?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxjaGVtaXN0cnklMjBsYWJvcmF0b3J5JTIwc2NpZW5jZXxlbnwxfHx8fDE3NjA0NjY5NjF8MA&ixlib=rb-4.1.0&q=80&w=1080",
  },
  {
    question: "Who wrote 'Romeo and Juliet'?",
    options: ["Charles Dickens", "William Shakespeare", "Jane Austen", "Mark Twain"],
    correct: 1,
    image: "https://images.unsplash.com/photo-1632743050362-0c61a1ad2462?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxzaGFrZXNwZWFyZSUyMHRoZWF0ZXJ8ZW58MXx8fHwxNzYwNTUwMjcwfDA&ixlib=rb-4.1.0&q=80&w=1080",
  },
  {
    question: "What is the tallest mammal?",
    options: ["Elephant", "Giraffe", "Polar Bear", "Moose"],
    correct: 1,
    image: "https://images.unsplash.com/photo-1710279714774-71371394b371?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxnaXJhZmZlJTIwc2FmYXJpfGVufDF8fHx8MTc2MDU0MzkyOHww&ixlib=rb-4.1.0&q=80&w=1080",
  },
  {
    question: "Which country is home to the kangaroo?",
    options: ["New Zealand", "South Africa", "Australia", "Brazil"],
    correct: 2,
    image: "https://images.unsplash.com/photo-1691998548138-e9a30e2e32e6?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxrYW5nYXJvbyUyMGF1c3RyYWxpYXxlbnwxfHx8fDE3NjA1NDA1NTd8MA&ixlib=rb-4.1.0&q=80&w=1080",
  },
];

export function GameDuelScreen({ stake, opponent, duelId, spectator, creator, category, onGameFinish }: GameDuelScreenProps) {
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [timeLeft, setTimeLeft] = useState(10);
  const [playerScore, setPlayerScore] = useState(0);
  const [opponentScore, setOpponentScore] = useState(0);
  const [playerAnswers, setPlayerAnswers] = useState<boolean[]>([]);
  const [opponentDisplay, setOpponentDisplay] = useState<string>(opponent || 'Opponent');
  const [isLive, setIsLive] = useState<boolean>(!!duelId && !spectator);
  const [hasOpponentHello, setHasOpponentHello] = useState<boolean>(false);
  const isComputerOpponent = opponent === '0x000000000000000000000000000000000000dEaD';
  const computerAnswerTimeoutRef = useRef<number | null>(null);
  const [questions, setQuestions] = useState<NormalizedQuestion[]>([]);
  const [clientId, setClientId] = useState<string | null>(null);
  const joinedRef = useRef<boolean>(false);
  const isSpectator = !!spectator;
  const isCreator = !!creator;

  const wsRef = useRef<StableWebSocket | null>(null);
  const { address } = useAccount();
  const { data: walletClient } = useWalletClient();
  const helloIntervalRef = useRef<number | null>(null);
  const helloAttemptsRef = useRef<number>(0);
  const { verification } = useSelf();
  const [confirmingResult, setConfirmingResult] = useState(false);

  const question = questions[currentQuestion];
  const opponentName = isComputerOpponent ? '🤖 Computer' : (hasOpponentHello ? opponentDisplay : (opponent || 'Opponent'));

  const shorten = (addr?: string) => {
    if (!addr || addr.length < 10) return addr || 'Opponent';
    return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
  };

  // Generate a unique game session ID that persists for this game instance
  const gameSessionIdRef = useRef<string | null>(null);
  const lastGameKeyRef = useRef<string>('');
  
  // Load deterministic questions based on category and duelId (or address)
  useEffect(() => {
    // Create a unique key for this game session
    const gameKey = `${duelId || 'solo'}:${category || 'random'}:${address || 'local'}`;
    
    // If this is a new game (different key), reset the session ID
    if (gameKey !== lastGameKeyRef.current) {
      gameSessionIdRef.current = null;
      lastGameKeyRef.current = gameKey;
    }
    
    // For duels: use duelId as seed (both players get same questions for fairness)
    // For solo games: generate unique seed per game session
    let seed: string;
    
    if (duelId) {
      // In a duel, both players should get the same questions
      seed = `duel:${duelId}`;
    } else {
      // For solo games, generate a unique seed per game session
      // Use a combination of address, timestamp, and random component
      if (!gameSessionIdRef.current) {
        const timestamp = Date.now();
        const random = Math.random().toString(36).substring(2, 15);
        const addr = address || 'local';
        gameSessionIdRef.current = `solo:${addr}:${timestamp}:${random}`;
      }
      seed = gameSessionIdRef.current;
    }
    
    const cat = category || 'random';
    const list = selectQuestions(cat, DEFAULT_QUESTION_COUNT, seed);
    setQuestions(list);
    setCurrentQuestion(0);
    setSelectedAnswer(null);
    setShowResult(false);
    setTimeLeft(10);
    setPlayerScore(0);
    setOpponentScore(0);
    setPlayerAnswers([]);
  }, [duelId, address, category]);

  useEffect(() => {
    if (!duelId) return;
    
    const wsUrl = getWebSocketUrl();
    const ws = new StableWebSocket({
      url: wsUrl,
      onOpen: () => {
        console.log('[game] ws open');
        try {
          ws.send({ type: 'join', roomId: duelId });
        } catch { }
      },
      onMessage: (payload) => {
        try {
          if (payload?.type === 'joined') {
            joinedRef.current = true;
            const id = typeof payload.clientId === 'string' ? payload.clientId : null;
            setClientId(id);
            console.log('[game] joined ack', { roomId: payload.roomId, clientId: id });
            // Begin hello handshake only after joined ack
            const sendHello = () => {
              const ev: any = { type: 'hello' };
              if (address) ev.address = address;
              if (verification?.isHumanVerified) {
                ev.identity = { human: true, ageOver21: !!verification.ageOver21, ageOver18: !!verification.ageOver18 };
              }
              const s = wsRef.current;
              if (s && s.isConnected) {
                s.send({ type: 'broadcast', event: ev });
                // Also send initial score and address
                s.send({ type: 'broadcast', event: { type: 'score_update', score: playerScore, from: address } });
                if (address) {
                  s.send({ type: 'broadcast', event: { type: 'address_update', address: address, from: address } });
                }
              }
            };
            try { sendHello(); helloAttemptsRef.current = 1; } catch { }
            helloIntervalRef.current = window.setInterval(() => {
              if (hasOpponentHello || helloAttemptsRef.current >= 5) {
                if (helloIntervalRef.current) { clearInterval(helloIntervalRef.current); helloIntervalRef.current = null; }
                return;
              }
              try { sendHello(); helloAttemptsRef.current += 1; } catch { }
            }, 2000);
            return;
          }
          if (payload?.type === 'event' && payload?.event) {
            const ev = payload.event;
            const senderId: string | undefined = typeof payload.senderId === 'string' ? payload.senderId : undefined;
            const isSelf = !!senderId && !!clientId && senderId === clientId;
            if (ev.type === 'hello') {
              if (!isSelf) {
                if (ev.address) setOpponentDisplay(ev.address);
                setIsLive(true);
                setHasOpponentHello(true);
                if (helloIntervalRef.current) { clearInterval(helloIntervalRef.current); helloIntervalRef.current = null; }
                console.log('[game] hello received from opponent', { senderId });
              }
            } else if (ev.type === 'answer') {
              if (!isSelf) {
                if (ev.isCorrect) setOpponentScore((s) => s + 1);
                console.log('[game] opponent answer', { senderId, isCorrect: ev.isCorrect });
              }
            } else if (ev.type === 'score_update') {
              // Real-time score update
              if (!isSelf && ev.score !== undefined) {
                setOpponentScore(ev.score);
                console.log('[game] opponent score update', { senderId, score: ev.score });
              }
            } else if (ev.type === 'address_update') {
              // Real-time address update
              if (!isSelf && ev.address) {
                setOpponentDisplay(ev.address);
                console.log('[game] opponent address update', { senderId, address: ev.address });
              }
            }
          }
        } catch { }
      },
      onError: (e) => { console.error('[game] ws error', e); },
      onClose: (evt) => {
        console.error('[game] ws closed', { code: evt.code, reason: evt.reason });
        if (helloIntervalRef.current) { clearInterval(helloIntervalRef.current); helloIntervalRef.current = null; }
      },
      reconnect: true,
      maxReconnectAttempts: 10,
      reconnectDelay: 2000,
    });
    
    wsRef.current = ws;
    
    // Initialize computer opponent if applicable
    if (isComputerOpponent && !hasOpponentHello) {
      setHasOpponentHello(true);
      setIsLive(true);
      setOpponentDisplay('🤖 Computer');
    }
    
    return () => {
      ws.close();
      if (helloIntervalRef.current) { clearInterval(helloIntervalRef.current); helloIntervalRef.current = null; }
      if (computerAnswerTimeoutRef.current) { clearTimeout(computerAnswerTimeoutRef.current); computerAnswerTimeoutRef.current = null; }
    };
  }, [duelId, category, verification?.isHumanVerified, verification?.ageOver18, verification?.ageOver21]);

  useEffect(() => {
    if (showResult || isSpectator) return;

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          handleTimeout();
          return 10;
        }
        if (prev <= 4) {
          soundEffects.playTick();
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [currentQuestion, showResult, isSpectator]);

  const handleTimeout = () => {
    if (selectedAnswer === null) {
      soundEffects.playWrong();
      setShowResult(true);
      setPlayerAnswers([...playerAnswers, false]);
      // Do not simulate opponent in live matches
      if (!isLive) {
        const opponentCorrect = Math.random() > 0.3;
        if (opponentCorrect) {
          setOpponentScore(opponentScore + 1);
        }
      }
      setTimeout(nextQuestion, 2000);
    }
  };

  const handleAnswer = (index: number) => {
    if (showResult || isSpectator || !question) return;
    if (isLive && !verification?.isHumanVerified) {
      toast.error('Verification required. Sign in with Self  in wallet tab to answer in live matches.');
      return;
    }

    soundEffects.playClick();
    setSelectedAnswer(index);
    setShowResult(true);

    const isCorrect = index === question.correct;
    setPlayerAnswers([...playerAnswers, isCorrect]);

    const newScore = isCorrect ? playerScore + 1 : playerScore;
    if (isCorrect) {
      soundEffects.playCorrect();
      setPlayerScore(newScore);
    } else {
      soundEffects.playWrong();
    }

    // Broadcast answer, score, and address to room participants/spectators in real-time
    try {
      const ws = wsRef.current;
      if (ws && ws.isConnected && !isSpectator && joinedRef.current) {
        const newScore = isCorrect ? playerScore + 1 : playerScore;
        // Send answer
        ws.send({ type: 'broadcast', event: { type: 'answer', index, isCorrect, from: address || 'local' } });
        // Send real-time score update
        ws.send({ type: 'broadcast', event: { type: 'score_update', score: newScore, from: address || 'local' } });
        // Send address update if available
        if (address) {
          ws.send({ type: 'broadcast', event: { type: 'address_update', address: address, from: address } });
        }
      }
    } catch { }

    // Simulate computer opponent answer (with difficulty - 60% correct rate)
    if (isComputerOpponent && question) {
      // Clear any existing timeout
      if (computerAnswerTimeoutRef.current) {
        clearTimeout(computerAnswerTimeoutRef.current);
      }
      // Computer answers after 1-3 seconds (simulating thinking time)
      const thinkTime = 1000 + Math.random() * 2000;
      computerAnswerTimeoutRef.current = window.setTimeout(() => {
        const computerCorrect = Math.random() < 0.6; // 60% accuracy
        const computerAnswer = computerCorrect ? question.correct : Math.floor(Math.random() * question.options.length);
        if (computerCorrect) {
          setOpponentScore((s) => s + 1);
        }
        console.log('[game] Computer opponent answered', { correct: computerCorrect, answer: computerAnswer });
      }, thinkTime);
    } else if (!isLive) {
      // For practice mode, simulate random opponent
      const opponentCorrect = Math.random() > 0.3;
      if (opponentCorrect) {
        setOpponentScore(opponentScore + 1);
      }
    }

    setTimeout(nextQuestion, 2000);
  };

  const confirmResultOnChain = async (winnerAddress: string) => {
    if (!duelId || !walletClient || !address || !DUEL_CONTRACT_ADDRESS) {
      console.warn('[GameDuelScreen] Cannot confirm result - missing required data');
      return false;
    }

    try {
      setConfirmingResult(true);
      const wc = walletClient;
      
      // Ensure we're on Celo
      const chainId = await wc.getChainId();
      if (chainId !== celoChain.id) {
        toast.error('Please switch to Celo Mainnet');
        return false;
      }

      // For computer duels, use finishComputerDuel; otherwise use confirmResult
      const [account] = await wc.getAddresses();
      const functionName = isComputerOpponent ? 'finishComputerDuel' : 'confirmResult';
      const data = encodeFunctionData({
        abi: duelManagerAbi,
        functionName: functionName as any,
        args: [duelId as `0x${string}`, winnerAddress as `0x${string}`],
      });
      
      const DIVVI_CONSUMER: `0x${string}` = '0x900f96DD68CA49001228348f1A2Cd28556FB62dd';
      const tag = getReferralTag({ user: account, consumer: DIVVI_CONSUMER });
      const fullData = (data + tag.slice(2)) as `0x${string}`;
      
      const txHash = await wc.sendTransaction({
        account,
        to: DUEL_CONTRACT_ADDRESS,
        data: fullData,
      });
      
      toast.success('Confirming result on-chain...', { description: 'Transaction submitted' });
      
      // Wait for transaction
      const { viemPublicClient } = await import('../lib/blockchain');
      await viemPublicClient.waitForTransactionReceipt({ hash: txHash });
      
      // Submit referral
      try {
        await submitReferral({ txHash, chainId });
      } catch (e) {
        console.warn('[GameDuelScreen] Referral submission failed:', e);
      }
      
      toast.success('Result confirmed! Prize will be distributed.');
      return true;
    } catch (error: any) {
      console.error('[GameDuelScreen] Failed to confirm result:', error);
      const msg = error?.shortMessage || error?.message || 'Failed to confirm result';
      toast.error(msg);
      return false;
    } finally {
      setConfirmingResult(false);
    }
  };

  const nextQuestion = async () => {
    if (currentQuestion < (questions.length || 0) - 1) {
      setCurrentQuestion(currentQuestion + 1);
      setSelectedAnswer(null);
      setShowResult(false);
      setTimeLeft(10);
    } else {
      // Game finished - determine winner
      const won = playerScore >= opponentScore;
      const totalPool = stake * 2;
      const fee = totalPool * 0.05;
      const prize = won ? totalPool - fee : 0;
      
      // If this is a live match with duelId, confirm result on-chain
      // BOTH players must confirm - this ensures proper on-chain settlement
      // Skip for practice mode (stake === 0)
      if (duelId && isLive && address && opponentDisplay && opponentDisplay !== 'Opponent' && stake > 0) {
        const winnerAddress = won ? address : opponentDisplay;
        // Always confirm - the contract requires both players to confirm
        const confirmed = await confirmResultOnChain(winnerAddress);
        if (!confirmed) {
          toast.error('Failed to confirm result on-chain. Please try again or contact support.');
        }
      }
      
      onGameFinish(won, playerScore, questions.length || DEFAULT_QUESTION_COUNT, prize);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 px-4 py-6 relative overflow-hidden" data-duel-id={duelId} data-role={isCreator ? 'creator' : (isSpectator ? 'spectator' : 'participant')}>
      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-10 w-32 h-32 bg-emerald-500/5 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-20 right-10 w-40 h-40 bg-blue-500/5 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
      </div>

      <div className="max-w-lg mx-auto relative z-10">
        {/* Timer and Round Counter */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <div className="text-slate-400 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-emerald-400" />
              Question {currentQuestion + 1}/{questions.length || DEFAULT_QUESTION_COUNT}
            </div>
            <div className="flex items-center gap-2">
              <Clock className={`w-5 h-5 ${timeLeft <= 3 ? 'text-red-400 animate-pulse' : 'text-emerald-400'}`} />
              <span className={`text-2xl ${timeLeft <= 3 ? 'text-red-400 animate-pulse' : 'text-emerald-400'}`}>
                {timeLeft}s
              </span>
            </div>
          </div>
          <Progress
            value={(timeLeft / 10) * 100}
            className={`h-2 bg-slate-800 transition-colors ${timeLeft <= 3 ? 'bg-red-900/30' : ''}`}
          />
        </div>

        {/* Scoreboard */}
        <div className="flex items-center justify-between mb-6 bg-gradient-to-br from-slate-800/80 to-slate-800/50 backdrop-blur-sm rounded-xl p-4 border border-slate-700 shadow-lg">
          <div className="flex items-center gap-3">
            <Avatar className="w-12 h-12 border-2 border-emerald-400 shadow-lg shadow-emerald-400/20">
              <AvatarFallback className="bg-gradient-to-br from-emerald-600 to-emerald-700 text-white">YOU</AvatarFallback>
            </Avatar>
            <div>
              <div className="text-white text-sm">You</div>
              <div className="text-3xl text-emerald-400">{playerScore}</div>
            </div>
          </div>
          <div className="text-slate-500 text-2xl">⚔️</div>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <div className="text-white text-sm">{shorten(opponentName)}</div>
              <div className="text-3xl text-blue-400">{opponentScore}</div>
            </div>
            <Avatar className="w-12 h-12 border-2 border-blue-400 shadow-lg shadow-blue-400/20">
              <AvatarFallback className="bg-gradient-to-br from-blue-600 to-blue-700 text-white">
                {hasOpponentHello ? (opponentName.substring(0, 2).toUpperCase()) : 'OP'}
              </AvatarFallback>
            </Avatar>
          </div>
        </div>

        {/* Question with Abstract Art */}
        <div className="mb-6">
          <div className="bg-gradient-to-br from-slate-800/90 to-slate-800/60 backdrop-blur-sm border-2 border-emerald-400/30 rounded-2xl overflow-hidden shadow-2xl shadow-emerald-500/10">
            <div className="relative h-48 overflow-hidden">
              {question && (
                <AbstractArt text={question.question} className="w-full h-full" />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-slate-900/50 to-transparent" />
            </div>
            <div className="p-6 -mt-8 relative z-10">
              <p className="text-white text-xl text-center">{question ? question.question : 'Loading question...'}</p>
            </div>
          </div>
        </div>

        {/* Answer Options */}
        <div className="space-y-3">
          {(question?.options ?? []).map((option, index) => {
            const isSelected = selectedAnswer === index;
            const isCorrect = question ? index === question.correct : false;
            const showCorrect = showResult && isCorrect;
            const showIncorrect = showResult && isSelected && !isCorrect;

            return (
              <Button
                key={index}
                onClick={() => handleAnswer(index)}
                disabled={showResult || isSpectator || !question}
                className={`w-full h-16 text-lg justify-start px-6 rounded-xl transition-all transform hover:scale-[1.02] active:scale-[0.98] ${showCorrect
                    ? 'bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-500 hover:to-emerald-600 border-2 border-emerald-400 shadow-lg shadow-emerald-500/50 animate-pulse text-white'
                    : showIncorrect
                      ? 'bg-gradient-to-r from-red-500 to-red-600 hover:from-red-500 hover:to-red-600 border-2 border-red-400 shadow-lg shadow-red-500/50 text-white'
                      : isSelected
                        ? 'bg-emerald-400/20 border-2 border-emerald-400 text-white'
                        : 'bg-slate-800/80 backdrop-blur-sm hover:bg-slate-700 border-2 border-slate-700 hover:border-emerald-400/30 text-white'
                  }`}
                variant="outline"
              >
                <span className="flex-1 text-left text-white">{option}</span>
                {showCorrect && <Check className="w-6 h-6 animate-bounce text-white" />}
                {showIncorrect && <X className="w-6 h-6 text-white" />}
              </Button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

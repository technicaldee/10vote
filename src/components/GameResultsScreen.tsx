import { useEffect } from 'react';
import { Trophy, TrendingUp, Clock, Zap, Sparkles, Star } from 'lucide-react';
import { Button } from './ui/button';
import { Card } from './ui/card';
import { Badge } from './ui/badge';
import { ImageWithFallback } from './figma/ImageWithFallback';
import { soundEffects } from '../utils/soundEffects';

interface GameResultsScreenProps {
  won: boolean;
  prize: number;
  correctAnswers: number;
  totalQuestions: number;
  stake: number;
  onRematch: () => void;
  onNewDuel: () => void;
}

export function GameResultsScreen({
  won,
  prize,
  correctAnswers,
  totalQuestions,
  stake,
  onRematch,
  onNewDuel,
}: GameResultsScreenProps) {
  const totalPool = stake * 2;
  const fee = totalPool * 0.05;
  const accuracy = Math.round((correctAnswers / totalQuestions) * 100);

  useEffect(() => {
    if (won) {
      soundEffects.playVictory();
      setTimeout(() => soundEffects.playCoin(), 500);
    } else {
      soundEffects.playDefeat();
    }
  }, [won]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 px-4 py-12 flex items-center justify-center relative overflow-hidden">
      {/* Animated background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {won ? (
          <>
            <div className="absolute top-0 left-1/4 w-2 h-2 bg-yellow-400 rounded-full animate-ping" style={{ animationDelay: '0s' }} />
            <div className="absolute top-10 right-1/3 w-2 h-2 bg-emerald-400 rounded-full animate-ping" style={{ animationDelay: '0.5s' }} />
            <div className="absolute top-20 left-1/2 w-2 h-2 bg-blue-400 rounded-full animate-ping" style={{ animationDelay: '1s' }} />
            <div className="absolute top-5 right-1/4 w-2 h-2 bg-purple-400 rounded-full animate-ping" style={{ animationDelay: '1.5s' }} />
            <Sparkles className="absolute top-32 left-10 w-8 h-8 text-yellow-400/30 animate-pulse" />
            <Star className="absolute bottom-32 right-10 w-6 h-6 text-emerald-400/30 animate-pulse" style={{ animationDelay: '0.5s' }} />
          </>
        ) : (
          <>
            <div className="absolute top-20 left-10 w-32 h-32 bg-slate-700/10 rounded-full blur-3xl" />
            <div className="absolute bottom-20 right-10 w-40 h-40 bg-slate-600/10 rounded-full blur-3xl" />
          </>
        )}
      </div>

      <div className="max-w-lg mx-auto w-full relative z-10">
        {/* Result Header with Image */}
        <div className="text-center mb-8 relative">
          {won && (
            <div className="absolute -top-10 left-1/2 transform -translate-x-1/2 w-full">
              <ImageWithFallback
                src="https://images.unsplash.com/photo-1587321066078-939f6f2b67fb?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxjZWxlYnJhdGlvbiUyMGNvbmZldHRpJTIwd2lubmVyfGVufDF8fHx8MTc2MDU1MDI2N3ww&ixlib=rb-4.1.0&q=80&w=1080"
                alt="Victory celebration"
                className="w-full h-32 object-cover rounded-2xl opacity-30 blur-sm"
              />
            </div>
          )}
          <div
            className={`inline-flex items-center justify-center w-28 h-28 rounded-full mb-6 relative ${
              won
                ? 'bg-gradient-to-br from-emerald-500/30 to-emerald-600/20 border-4 border-emerald-400 shadow-2xl shadow-emerald-500/50'
                : 'bg-gradient-to-br from-slate-700/50 to-slate-800/50 border-4 border-slate-600'
            }`}
          >
            {won && (
              <div className="absolute inset-0 rounded-full bg-emerald-400/20 animate-ping" />
            )}
            <Trophy
              className={`w-14 h-14 relative z-10 ${won ? 'text-emerald-400 drop-shadow-lg' : 'text-slate-500'}`}
            />
          </div>
          <h1
            className={`text-6xl mb-3 drop-shadow-lg ${
              won ? 'text-emerald-400 animate-pulse' : 'text-slate-400'
            }`}
          >
            {won ? '🎉 VICTORY!' : '😔 DEFEAT'}
          </h1>
          <p className="text-slate-400 text-lg">
            {won ? 'Congratulations on your win!' : 'Better luck next time!'}
          </p>
        </div>

        {/* Prize Display */}
        {won && (
          <Card className="bg-gradient-to-br from-emerald-500/30 to-emerald-600/20 border-2 border-emerald-400/70 mb-6 p-8 shadow-2xl shadow-emerald-500/30 relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent animate-shimmer" />
            <div className="text-center relative z-10">
              <div className="text-emerald-200 mb-3 flex items-center justify-center gap-2">
                <Sparkles className="w-5 h-5" />
                You Won
                <Sparkles className="w-5 h-5" />
              </div>
              <div className="text-6xl text-emerald-400 mb-5 drop-shadow-lg animate-pulse">
                💰 ${prize.toFixed(2)} cUSD
              </div>
              <div className="flex items-center justify-center gap-6 text-sm bg-slate-900/50 rounded-lg p-3">
                <div className="text-slate-300">
                  Total Pool: <span className="text-emerald-300">${totalPool.toFixed(2)}</span>
                </div>
                <div className="text-slate-300">
                  Platform Fee: <span className="text-slate-400">${fee.toFixed(2)}</span>
                </div>
              </div>
            </div>
          </Card>
        )}

        {!won && (
          <Card className="bg-slate-800/60 border-slate-700 mb-6 p-6 backdrop-blur-sm">
            <div className="text-center">
              <div className="text-slate-400 mb-2">Lost Stake</div>
              <div className="text-4xl text-slate-300 mb-2">
                ${stake.toFixed(2)} cUSD
              </div>
              <p className="text-slate-500 text-sm">Keep practicing to improve!</p>
            </div>
          </Card>
        )}

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3 mb-8">
          <Card className={`border-slate-700 p-5 ${won ? 'bg-gradient-to-br from-slate-800/80 to-slate-800/60 border-emerald-400/30' : 'bg-slate-800/50'}`}>
            <div className="flex flex-col items-center gap-2">
              <TrendingUp className={`w-7 h-7 ${accuracy >= 70 ? 'text-emerald-400' : 'text-slate-400'}`} />
              <div className={`text-3xl ${accuracy >= 70 ? 'text-emerald-400' : 'text-white'}`}>{accuracy}%</div>
              <div className="text-xs text-slate-400">Accuracy</div>
            </div>
          </Card>
          <Card className={`border-slate-700 p-5 ${won ? 'bg-gradient-to-br from-slate-800/80 to-slate-800/60 border-emerald-400/30' : 'bg-slate-800/50'}`}>
            <div className="flex flex-col items-center gap-2">
              <Trophy className="w-7 h-7 text-yellow-400" />
              <div className="text-3xl text-white">
                {correctAnswers}/{totalQuestions}
              </div>
              <div className="text-xs text-slate-400">Correct</div>
            </div>
          </Card>
          <Card className={`border-slate-700 p-5 ${won ? 'bg-gradient-to-br from-slate-800/80 to-slate-800/60 border-emerald-400/30' : 'bg-slate-800/50'}`}>
            <div className="flex flex-col items-center gap-2">
              <Clock className="w-7 h-7 text-blue-400" />
              <div className="text-3xl text-white">3.2s</div>
              <div className="text-xs text-slate-400">Avg Time</div>
            </div>
          </Card>
        </div>

        {/* Actions */}
        <div className="space-y-3">
          <Button
            onClick={() => {
              soundEffects.playClick();
              onRematch();
            }}
            className="w-full h-16 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white text-lg rounded-xl shadow-xl shadow-emerald-500/40 relative overflow-hidden group"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent translate-x-[-200%] group-hover:translate-x-[200%] transition-transform duration-700" />
            <Zap className="w-6 h-6 mr-2 relative z-10" fill="currentColor" />
            <span className="relative z-10">Rematch - ${stake.toFixed(2)} cUSD</span>
          </Button>
          <Button
            onClick={() => {
              soundEffects.playClick();
              onNewDuel();
            }}
            variant="outline"
            className="w-full h-14 border-2 border-slate-700 bg-slate-800/50 hover:bg-slate-700 text-white text-lg rounded-xl backdrop-blur-sm"
          >
            New Duel
          </Button>
        </div>

        {/* Achievement Badge */}
        {won && accuracy === 100 && (
          <div className="mt-6 text-center animate-bounce">
            <Badge className="bg-gradient-to-r from-yellow-500/30 to-yellow-600/20 text-yellow-400 border-2 border-yellow-400/70 px-6 py-3 text-base shadow-lg shadow-yellow-500/30">
              ⭐ Perfect Score Achievement! ⭐
            </Badge>
          </div>
        )}

        {won && accuracy >= 80 && accuracy < 100 && (
          <div className="mt-6 text-center">
            <Badge className="bg-gradient-to-r from-emerald-500/20 to-emerald-600/10 text-emerald-400 border-emerald-400/50 px-4 py-2">
              🌟 Excellent Performance!
            </Badge>
          </div>
        )}
      </div>
    </div>
  );
}

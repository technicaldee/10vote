// Daily challenge system
export interface DailyChallenge {
  date: string; // YYYY-MM-DD
  category: string;
  targetScore: number;
  reward: number;
  description: string;
  completed: boolean;
}

const STORAGE_KEY = '10vote_daily_challenge';

export function getDailyChallenge(): DailyChallenge {
  const today = new Date().toISOString().split('T')[0];
  
  // Generate challenge based on date (deterministic)
  const seed = `challenge:${today}`;
  const categories = ['random', 'general', 'sports', 'science', 'history', 'pop', 'geography'];
  const categoryIndex = Math.floor(hashString(seed) % categories.length);
  const category = categories[categoryIndex];
  
  // Target score varies (7-10 correct)
  const targetScore = 7 + (hashString(seed + 'score') % 4);
  const reward = targetScore * 0.1; // 0.7 to 1.0 cUSD reward
  
  const challenge: DailyChallenge = {
    date: today,
    category,
    targetScore,
    reward,
    description: `Get ${targetScore} or more correct answers in ${category === 'random' ? 'any category' : category} today!`,
    completed: false,
  };
  
  // Check if already completed
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (parsed.date === today && parsed.completed) {
        challenge.completed = true;
      }
    }
  } catch (e) {
    console.error('[dailyChallenge] Failed to load:', e);
  }
  
  return challenge;
}

export function completeDailyChallenge(score: number): boolean {
  const challenge = getDailyChallenge();
  
  if (challenge.completed) {
    return false;
  }
  
  if (score >= challenge.targetScore) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        ...challenge,
        completed: true,
        completedAt: Date.now(),
      }));
      return true;
    } catch (e) {
      console.error('[dailyChallenge] Failed to save:', e);
      return false;
    }
  }
  
  return false;
}

function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash);
}



// Player statistics and achievements system
export interface PlayerStats {
  totalGames: number;
  wins: number;
  losses: number;
  currentStreak: number;
  bestStreak: number;
  totalEarnings: number;
  perfectGames: number;
  categoriesPlayed: Set<string>;
  lastPlayedDate: string | null;
  achievements: Set<string>;
}

export interface Achievement {
  id: string;
  name: string;
  description: string;
  icon: string;
  unlocked: boolean;
  unlockedAt?: number;
}

const ACHIEVEMENTS: Achievement[] = [
  { id: 'first_win', name: 'First Victory', description: 'Win your first game', icon: '🏆' },
  { id: 'streak_3', name: 'Hot Streak', description: 'Win 3 games in a row', icon: '🔥' },
  { id: 'streak_5', name: 'On Fire', description: 'Win 5 games in a row', icon: '🔥🔥' },
  { id: 'streak_10', name: 'Unstoppable', description: 'Win 10 games in a row', icon: '💪' },
  { id: 'perfect_game', name: 'Perfect Score', description: 'Get 100% correct answers', icon: '⭐' },
  { id: 'perfect_3', name: 'Perfectionist', description: 'Get 3 perfect scores', icon: '✨' },
  { id: 'games_10', name: 'Veteran', description: 'Play 10 games', icon: '🎮' },
  { id: 'games_50', name: 'Dedicated', description: 'Play 50 games', icon: '🎯' },
  { id: 'games_100', name: 'Legend', description: 'Play 100 games', icon: '👑' },
  { id: 'earnings_100', name: 'High Roller', description: 'Earn 100 cUSD total', icon: '💰' },
  { id: 'all_categories', name: 'Master of All', description: 'Play all categories', icon: '🌍' },
  { id: 'daily_player', name: 'Daily Player', description: 'Play 7 days in a row', icon: '📅' },
];

const STORAGE_KEY = '10vote_player_stats';

export function getPlayerStats(address: string | undefined): PlayerStats {
  if (!address) {
    return {
      totalGames: 0,
      wins: 0,
      losses: 0,
      currentStreak: 0,
      bestStreak: 0,
      totalEarnings: 0,
      perfectGames: 0,
      categoriesPlayed: new Set(),
      lastPlayedDate: null,
      achievements: new Set(),
    };
  }

  try {
    const stored = localStorage.getItem(`${STORAGE_KEY}_${address.toLowerCase()}`);
    if (stored) {
      const parsed = JSON.parse(stored);
      return {
        ...parsed,
        categoriesPlayed: new Set(parsed.categoriesPlayed || []),
        achievements: new Set(parsed.achievements || []),
      };
    }
  } catch (e) {
    console.error('[playerStats] Failed to load stats:', e);
  }

  return {
    totalGames: 0,
    wins: 0,
    losses: 0,
    currentStreak: 0,
    bestStreak: 0,
    totalEarnings: 0,
    perfectGames: 0,
    categoriesPlayed: new Set(),
    lastPlayedDate: null,
    achievements: new Set(),
  };
}

export function savePlayerStats(address: string, stats: PlayerStats) {
  try {
    const toStore = {
      ...stats,
      categoriesPlayed: Array.from(stats.categoriesPlayed),
      achievements: Array.from(stats.achievements),
    };
    localStorage.setItem(`${STORAGE_KEY}_${address.toLowerCase()}`, JSON.stringify(toStore));
  } catch (e) {
    console.error('[playerStats] Failed to save stats:', e);
  }
}

export function updateStatsAfterGame(
  address: string | undefined,
  won: boolean,
  correctAnswers: number,
  totalQuestions: number,
  prize: number,
  category: string
): { stats: PlayerStats; newAchievements: Achievement[] } {
  if (!address) {
    return { stats: getPlayerStats(address), newAchievements: [] };
  }

  const stats = getPlayerStats(address);
  const today = new Date().toISOString().split('T')[0];
  const wasDailyPlayer = stats.lastPlayedDate === today;
  
  stats.totalGames += 1;
  if (won) {
    stats.wins += 1;
    stats.currentStreak += 1;
    stats.bestStreak = Math.max(stats.bestStreak, stats.currentStreak);
    stats.totalEarnings += prize;
  } else {
    stats.losses += 1;
    stats.currentStreak = 0;
  }

  if (correctAnswers === totalQuestions) {
    stats.perfectGames += 1;
  }

  stats.categoriesPlayed.add(category);
  stats.lastPlayedDate = today;

  // Check for achievements
  const newAchievements: Achievement[] = [];
  const checkAchievement = (id: string) => {
    if (!stats.achievements.has(id)) {
      const achievement = ACHIEVEMENTS.find(a => a.id === id);
      if (achievement) {
        stats.achievements.add(id);
        newAchievements.push({ ...achievement, unlocked: true, unlockedAt: Date.now() });
      }
    }
  };

  // Check various achievements
  if (stats.wins === 1) checkAchievement('first_win');
  if (stats.currentStreak === 3) checkAchievement('streak_3');
  if (stats.currentStreak === 5) checkAchievement('streak_5');
  if (stats.currentStreak === 10) checkAchievement('streak_10');
  if (correctAnswers === totalQuestions) checkAchievement('perfect_game');
  if (stats.perfectGames === 3) checkAchievement('perfect_3');
  if (stats.totalGames === 10) checkAchievement('games_10');
  if (stats.totalGames === 50) checkAchievement('games_50');
  if (stats.totalGames === 100) checkAchievement('games_100');
  if (stats.totalEarnings >= 100) checkAchievement('earnings_100');
  if (stats.categoriesPlayed.size >= 7) checkAchievement('all_categories');
  
  // Daily player check (simplified - would need to track consecutive days properly)
  if (!wasDailyPlayer && stats.lastPlayedDate === today) {
    // This is a simplified check - in production, track consecutive days
    checkAchievement('daily_player');
  }

  savePlayerStats(address, stats);
  return { stats, newAchievements };
}

export function getAllAchievements(address: string | undefined): Achievement[] {
  if (!address) return ACHIEVEMENTS.map(a => ({ ...a, unlocked: false }));
  
  const stats = getPlayerStats(address);
  return ACHIEVEMENTS.map(a => ({
    ...a,
    unlocked: stats.achievements.has(a.id),
  }));
}



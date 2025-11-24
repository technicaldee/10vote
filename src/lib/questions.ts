import general from '../questions/general.json';
import history from '../questions/history.json';
import geography from '../questions/geography.json';
import science from '../questions/science.json';
import pop from '../questions/pop-culture.json';
import sports from '../questions/sport.json';

export type RawQuestion = {
  quizName?: string;
  category?: string;
  question: string;
  options: string[];
  correctAnswer: string;
  imageURL?: string;
};

export type NormalizedQuestion = {
  id: string;
  category: string;
  question: string;
  options: string[];
  correct: number;
};

const CATEGORY_MAP: Record<string, RawQuestion[]> = {
  general: general as RawQuestion[],
  history: history as RawQuestion[],
  geography: geography as RawQuestion[],
  science: science as RawQuestion[],
  pop: pop as RawQuestion[],
  sports: sports as RawQuestion[],
};

// Seeded PRNG utilities
function xmur3(str: string) {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return h >>> 0;
  };
}

function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6D2B79F5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function seededRandom(seedStr: string) {
  const seed = xmur3(seedStr)();
  return mulberry32(seed);
}

function shuffle<T>(arr: T[], rnd: () => number) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function normalize(categoryId: string, raw: RawQuestion[], rnd: () => number): NormalizedQuestion[] {
  return raw.map((q, idx) => {
    const correctIdx = Math.max(0, q.options.findIndex((o) => o.trim() === q.correctAnswer.trim()));
    const id = `${categoryId}-${idx}`;
    return {
      id,
      category: categoryId,
      question: q.question,
      options: q.options,
      correct: correctIdx === -1 ? Math.floor(rnd() * q.options.length) : correctIdx,
    } as NormalizedQuestion;
  });
}

// Get daily seed based on current date (changes daily at midnight UTC)
export function getDailySeed(): string {
    const today = new Date();
    const month = String(today.getUTCMonth() + 1).padStart(2, '0');
    const day = String(today.getUTCDate()).padStart(2, '0');
    const dateStr = `${today.getUTCFullYear()}-${month}-${day}`;
    return `daily:${dateStr}`;
}

// Get daily question set index (rotates daily)
export function getDailyQuestionSetIndex(totalSets: number): number {
    const seed = getDailySeed();
    const rnd = seededRandom(seed);
    return Math.floor(rnd() * totalSets);
}

export function selectQuestions(categoryId: string, count: number, seed: string): NormalizedQuestion[] {
    // Incorporate daily seed to ensure questions change daily
    const dailySeed = getDailySeed();
    // Create a combined seed - the seed parameter should already be unique per game session
    const combinedSeed = `${dailySeed}:${seed}:${categoryId}:${count}`;
    const rnd = seededRandom(combinedSeed);
    const categories = Object.keys(CATEGORY_MAP);
    const clampCount = Math.max(1, Math.min(count, 50));

    // Build normalized pools per category
    const pools: Record<string, NormalizedQuestion[]> = {};
    for (const cat of categories) {
        pools[cat] = normalize(cat, CATEGORY_MAP[cat], rnd);
    }

    const pickFromPool = (pool: NormalizedQuestion[], howMany: number): NormalizedQuestion[] => {
        // Shuffle the pool multiple times for better randomization
        let shuffled = shuffle(pool, rnd);
        // Additional shuffle pass for more randomness
        shuffled = shuffle(shuffled, rnd);
        // Ensure we don't pick duplicates by tracking used question IDs
        const used = new Set<string>();
        const result: NormalizedQuestion[] = [];
        
        for (const q of shuffled) {
            if (result.length >= howMany) break;
            if (!used.has(q.id)) {
                used.add(q.id);
                result.push(q);
            }
        }
        
        // If we still need more questions and have exhausted unique ones, allow repeats
        // but shuffle options to make it feel different
        while (result.length < howMany && shuffled.length > 0) {
            const q = shuffled[result.length % shuffled.length];
            // Create a variant by shuffling options
            const optionsCopy = [...q.options];
            const correctAnswer = optionsCopy[q.correct];
            const shuffledOptions = shuffle(optionsCopy, rnd);
            const newCorrect = shuffledOptions.indexOf(correctAnswer);
            
            result.push({
                ...q,
                id: `${q.id}-v${result.length}`,
                options: shuffledOptions,
                correct: newCorrect >= 0 ? newCorrect : 0,
            });
        }
        
        return result;
    };

    if (categoryId !== 'random') {
        return pickFromPool(pools[categoryId] || [], clampCount);
    }

    // Random mode: mix across categories with at least one from each when possible
    const sequence: string[] = [];
    const perCatInitial = Math.min(clampCount, categories.length);
    // Ensure first round includes unique categories (up to count)
    const initialCats = shuffle(categories, rnd).slice(0, perCatInitial);
    sequence.push(...initialCats);
    // Fill remaining picks randomly
    while (sequence.length < clampCount) {
        sequence.push(categories[Math.floor(rnd() * categories.length)]);
    }

    const usedByCat: Record<string, Set<string>> = {};
    for (const cat of categories) usedByCat[cat] = new Set();

    const result: NormalizedQuestion[] = [];
    for (const cat of sequence) {
        const pool = pools[cat];
        // pick first unused question from shuffled pool
        const shuffled = shuffle(pool, rnd);
        const next = shuffled.find((q) => !usedByCat[cat].has(q.id));
        if (next) {
            usedByCat[cat].add(next.id);
            result.push(next);
        } else if (pool.length > 0) {
            // If all questions in category are used, pick a random one anyway
            // but shuffle its options to make it feel different
            const fallback = pool[Math.floor(rnd() * pool.length)];
            const optionsCopy = [...fallback.options];
            const correctAnswer = optionsCopy[fallback.correct];
            const shuffledOptions = shuffle(optionsCopy, rnd);
            const newCorrect = shuffledOptions.indexOf(correctAnswer);
            
            result.push({
                ...fallback,
                id: `${fallback.id}-v${result.length}`,
                options: shuffledOptions,
                correct: newCorrect >= 0 ? newCorrect : 0,
            });
        }
    }

    return result.slice(0, clampCount);
}

export const DEFAULT_QUESTION_COUNT = 10;
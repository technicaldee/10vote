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

export function selectQuestions(categoryId: string, count: number, seed: string): NormalizedQuestion[] {
  const rnd = seededRandom(`${seed}:${categoryId}:${count}`);
  const categories = Object.keys(CATEGORY_MAP);
  const clampCount = Math.max(1, Math.min(count, 50));

  // Build normalized pools per category
  const pools: Record<string, NormalizedQuestion[]> = {};
  for (const cat of categories) {
    pools[cat] = normalize(cat, CATEGORY_MAP[cat], rnd);
  }

  const pickFromPool = (pool: NormalizedQuestion[], howMany: number): NormalizedQuestion[] => {
    const shuffled = shuffle(pool, rnd);
    return shuffled.slice(0, Math.min(howMany, shuffled.length));
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
    }
  }

  return result.slice(0, clampCount);
}

export const DEFAULT_QUESTION_COUNT = 10;
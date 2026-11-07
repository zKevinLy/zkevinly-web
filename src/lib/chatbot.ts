// Reply picker for the fake chat bot. Pure functions, no storage, no network.

import type { BotReply, BotRule } from '../config/chatbot';

const EMOJI = /\p{Extended_Pictographic}/u;
const EMOJI_RUN = /(\p{Extended_Pictographic}(?:\uFE0F|\u200D\p{Extended_Pictographic})*)/gu;

interface Brain {
  rules: BotRule[];
  question: BotReply[];
  fallback: BotReply[];
}

const pick = <T>(items: T[], rng: () => number): T => items[Math.floor(rng() * items.length)];

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^\p{L}\p{N}'-]+/u)
    .filter(Boolean);
}

/** Scores a rule by how many of the visitor's words start with one of its keywords. */
function score(words: string[], rule: BotRule): number {
  let total = 0;
  for (const word of words) {
    if (
      rule.keywords.some((k) =>
        k.length <= 3 ? word === k || word === `${k}s` : word.startsWith(k),
      )
    )
      total += 1;
  }
  return total;
}

export function getReply(input: string, brain: Brain, rng: () => number = Math.random): BotReply {
  const text = input.trim();
  const words = tokenize(text);

  let best: BotRule | null = null;
  let bestScore = 0;
  for (const rule of brain.rules) {
    const s = score(words, rule);
    if (s > bestScore) {
      best = rule;
      bestScore = s;
    }
  }
  if (best) return pick(best.replies, rng);

  // Emoji in, emoji out: echo what they sent, with a little extra.
  if (EMOJI.test(text)) {
    const sent = text.match(EMOJI_RUN) ?? [];
    const echoed = sent.slice(0, 3).join('');
    if (echoed) return { emoji: `${echoed}❗`, motion: 'bounce' };
  }

  if (text.endsWith('?')) return pick(brain.question, rng);
  return pick(brain.fallback, rng);
}

const STOPWORDS = new Set(
  (
    'a an the and or but if so to of in on at for with from by as is are was were be been am ' +
    'i me my you your we our they them it its this that these those do does did can could ' +
    "would should will just please hey hi hello pls im ive dont cant wont i'm i've i'll don't can't won't it's that's"
  ).split(' '),
);

/**
 * Turns what the visitor typed into a short GIF search query: letters only,
 * filler words dropped, at most six words, plus an optional bias word such as
 * "reaction". Returns "" when there is nothing searchable (e.g. emoji only).
 */
export function toSearchQuery(text: string, suffix = ''): string {
  const words = tokenize(text).filter((word) => /\p{L}/u.test(word));
  if (!words.length) return '';

  const meaningful = words.filter((word) => !STOPWORDS.has(word));
  const chosen = (meaningful.length ? meaningful : words).slice(0, 6);
  return [...chosen, suffix].filter(Boolean).join(' ');
}

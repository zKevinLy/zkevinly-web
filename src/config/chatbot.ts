/**
 * Fake chat bot content. It only ever answers with GIFs or emoji.
 *
 * GIFs come from a live search of what the visitor typed (see `gifSearch`).
 * The emoji rules below are the fallback for when that search is unavailable
 * or finds nothing, and for messages that are emoji only.
 *
 * Emoji matching: each word the visitor types is compared against `keywords` by prefix
 * ("thank" matches "thanks", "thank-you"…). The rule with the most matches wins;
 * ties go to the earlier rule. Nothing is sent anywhere or stored.
 */

export type Motion = 'bounce' | 'wiggle' | 'spin' | 'pop';

export interface BotReply {
  /** Shown large when there is no `gif`, and used as the GIF's alt text. */
  emoji: string;
  motion?: Motion;
  /**
   * Set at runtime from the live GIF search. The emoji above is kept as the alt
   * text and as the fallback if the GIF fails to load.
   */
  gif?: string;
  /** Alt text for the GIF (its title from KLIPY). */
  alt?: string;
}

export interface BotRule {
  keywords: string[];
  replies: BotReply[];
}

export const chatbot = {
  name: 'Bob the Bot',
  greeting: { emoji: '👋', motion: 'wiggle' } satisfies BotReply,
  placeholder: 'Search KLIPY',

  /**
   * Live GIF search. Each message the visitor sends is turned into a short search
   * query and sent to /api/gif (worker/), which asks KLIPY. If that fails or finds
   * nothing, the bot falls back to the emoji rules below.
   */
  gifSearch: {
    endpoint: '/api/gif',
    /** Appended to every query to bias results toward reaction GIFs. */
    suffix: 'reaction',
    timeoutMs: 4000,
  },

  rules: [
    {
      keywords: ['hi', 'hello', 'hey', 'yo', 'sup', 'howdy', 'morning', 'evening'],
      replies: [
        { emoji: '👋😄', motion: 'wiggle' },
        { emoji: '🫡✨', motion: 'pop' },
      ],
    },
    {
      keywords: ['bye', 'goodbye', 'cya', 'later', 'night'],
      replies: [
        { emoji: '👋😢', motion: 'wiggle' },
        { emoji: '🫡💤', motion: 'pop' },
      ],
    },
    {
      keywords: ['thank', 'thx', 'ty', 'appreciate', 'cheers'],
      replies: [
        { emoji: '🙏😊', motion: 'pop' },
        { emoji: '🫶✨', motion: 'bounce' },
      ],
    },
    {
      keywords: ['love', 'awesome', 'amazing', 'great', 'cool', 'nice', 'best'],
      replies: [
        { emoji: '🥰💖', motion: 'bounce' },
        { emoji: '😎🤙', motion: 'pop' },
      ],
    },
    {
      keywords: ['lol', 'haha', 'funny', 'joke', 'lmao', 'hilarious', 'rofl'],
      replies: [
        { emoji: '😂🤣', motion: 'bounce' },
        { emoji: '💀💀💀', motion: 'wiggle' },
      ],
    },
    {
      keywords: ['sad', 'cry', 'bad', 'tired', 'sorry', 'hate', 'worst', 'ugh'],
      replies: [
        { emoji: '🫂💙', motion: 'pop' },
        { emoji: '😢🍦', motion: 'wiggle' },
      ],
    },
    {
      keywords: ['help', 'support', 'stuck', 'confused', 'lost'],
      replies: [
        { emoji: '🤔💭', motion: 'wiggle' },
        { emoji: '🆘🤷', motion: 'bounce' },
      ],
    },
    {
      keywords: ['bug', 'error', 'code', 'dev', 'program', 'fix', 'crash', 'broken', 'script'],
      replies: [
        { emoji: '🐛🔧', motion: 'wiggle' },
        { emoji: '🔥💻🔥', motion: 'bounce' },
        { emoji: '🤯🧑‍💻', motion: 'pop' },
      ],
    },
    {
      keywords: ['windows', 'powershell', 'activate', 'winutil', 'debloat', 'microsoft'],
      replies: [
        { emoji: '🪟🧹', motion: 'wiggle' },
        { emoji: '🧙‍♂️✨💻', motion: 'pop' },
      ],
    },
    {
      keywords: ['nuvio', 'movie', 'show', 'watch', 'stream', 'film', 'tv', 'anime', 'netflix'],
      replies: [
        { emoji: '🍿🎬', motion: 'bounce' },
        { emoji: '📺😍', motion: 'pop' },
      ],
    },
    {
      keywords: ['music', 'song', 'listen', 'playlist', 'spotify'],
      replies: [
        { emoji: '🎵🎧', motion: 'bounce' },
        { emoji: '🕺💃', motion: 'wiggle' },
      ],
    },
    {
      keywords: ['github', 'repo', 'git', 'commit', 'star', 'open-source', 'opensource'],
      replies: [
        { emoji: '🐙⭐', motion: 'spin' },
        { emoji: '🍴📦', motion: 'pop' },
      ],
    },
    {
      keywords: ['ai', 'bot', 'robot', 'gpt', 'claude', 'chatgpt', 'llm', 'real', 'human'],
      replies: [
        { emoji: '🤖❓', motion: 'wiggle' },
        { emoji: '🤖🤫', motion: 'pop' },
      ],
    },
    {
      keywords: ['who', 'name', 'kevin', 'about'],
      replies: [
        { emoji: '🧑‍💻🇺🇸', motion: 'pop' },
        { emoji: '🕵️❓', motion: 'wiggle' },
      ],
    },
    {
      keywords: ['food', 'eat', 'pizza', 'hungry', 'lunch', 'dinner', 'burger', 'coffee'],
      replies: [
        { emoji: '🍕😋', motion: 'bounce' },
        { emoji: '☕🙏', motion: 'wiggle' },
      ],
    },
    {
      keywords: ['money', 'free', 'cheap', 'price', 'buy', 'pay', 'cost', 'rich'],
      replies: [
        { emoji: '💸💸💸', motion: 'bounce' },
        { emoji: '🆓🎉', motion: 'pop' },
      ],
    },
    {
      keywords: ['sleep', 'bed', 'nap', 'zzz', 'boring', 'bored'],
      replies: [
        { emoji: '😴💤', motion: 'wiggle' },
        { emoji: '🥱🛌', motion: 'pop' },
      ],
    },
    {
      keywords: ['cat', 'kitten', 'dog', 'puppy', 'pet'],
      replies: [
        { emoji: '🐱💕', motion: 'bounce' },
        { emoji: '🐶🦴', motion: 'wiggle' },
      ],
    },
    {
      keywords: ['yes', 'yeah', 'yep', 'sure', 'ok', 'okay', 'agree', 'true'],
      replies: [
        { emoji: '👍✨', motion: 'pop' },
        { emoji: '✅😎', motion: 'bounce' },
      ],
    },
    {
      keywords: ['no', 'nope', 'nah', 'never', 'false', 'wrong'],
      replies: [
        { emoji: '🙅‍♂️', motion: 'wiggle' },
        { emoji: '👎😬', motion: 'pop' },
      ],
    },
    {
      keywords: ['wow', 'omg', 'whoa', 'insane', 'crazy', 'wtf'],
      replies: [
        { emoji: '😮🤯', motion: 'bounce' },
        { emoji: '🫨😳', motion: 'wiggle' },
      ],
    },
  ] satisfies BotRule[],

  /** Visitor typed a question but nothing matched. */
  question: [
    { emoji: '🤔', motion: 'wiggle' },
    { emoji: '🤷‍♂️', motion: 'pop' },
  ] satisfies BotReply[],

  /** Nothing matched at all. */
  fallback: [
    { emoji: '🙃', motion: 'wiggle' },
    { emoji: '👀', motion: 'pop' },
    { emoji: '😎', motion: 'bounce' },
    { emoji: '✨🫡✨', motion: 'pop' },
    { emoji: '🦆', motion: 'bounce' },
    { emoji: '🧐', motion: 'wiggle' },
  ] satisfies BotReply[],
};
